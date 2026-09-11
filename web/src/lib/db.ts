import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions } from "./firebase";
import type { Deal } from "./calc";

/**
 * E-mail de "definir senha" (conta nova) ou "redefinir senha" (esqueci a minha), com a marca da
 * Arrow Shot, mandado via Resend pela function sendAuthEmail -- no lugar do e-mail padrão do
 * Firebase, que ainda sai com o nome antigo do projeto ("Converteu") e cai fácil em spam por sair
 * de um domínio genérico sem SPF/DKIM configurado por nós.
 */
export async function sendBrandedAuthEmail(email: string, type: "reset" | "invite") {
  const call = httpsCallable(functions, "sendAuthEmail");
  await call({ email, type });
}

// Oferta de lançamento: link de checkout único na Kiwify (sem grade de planos) -- cola aqui assim
// que o Nicolas mandar. Enquanto estiver vazio, quem tem pagamento pendente fica na tela de
// "acesso bloqueado" sem next step (nada quebra, só não tem pra onde redirecionar ainda).
export const KIWIFY_CHECKOUT_URL = "";

/**
 * Link de checkout da Kiwify com o accountId no parâmetro de rastreamento "s1" -- a Kiwify
 * devolve esse valor de volta no payload do webhook (ver web/api/kiwify-webhook.ts), e é assim
 * que a gente sabe pra qual conta liberar o acesso depois que o pagamento é confirmado. Sem isso,
 * não teria como saber automaticamente quem pagou o quê.
 */
export function buildKiwifyCheckoutUrl(accountId: string): string | null {
  if (!KIWIFY_CHECKOUT_URL) return null;
  const url = new URL(KIWIFY_CHECKOUT_URL);
  url.searchParams.set("s1", accountId);
  return url.toString();
}

export interface AccountStatus {
  companyName?: string;
  email?: string;
  status?: string;
  plan?: string;
  billingCycle?: string;
  /** Contador vitalício de orçamentos já criados -- só é usado (e só sobe) pro limite do plano Teste. */
  proposalsCreatedCount?: number;
  subscriptionExpiresAt: Date | null;
  isExpired: boolean;
  isSuspended: boolean;
  isActiveAndValid: boolean;
  /** Quais itens do checklist de atendimento já estão marcados como prática consolidada. */
  checklistAtendimento?: Record<string, boolean>;
}

/** Salva o checklist de boas práticas de atendimento (ver ChecklistPanel.tsx) -- só o dono da conta vê. */
export async function saveChecklistAtendimento(accountId: string, items: Record<string, boolean>) {
  await setDoc(doc(db, "accounts", accountId), { checklistAtendimento: items }, { merge: true });
}

/** Lê o status/assinatura de uma conta (mesma lógica de firebase-client.js: getAccountStatus). */
export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  const snap = await getDoc(doc(db, "accounts", accountId));
  if (!snap.exists()) throw new Error("Conta não encontrada.");
  const data = snap.data() as Record<string, unknown>;
  const expiresAt = (data.subscriptionExpiresAt as { toDate?: () => Date })?.toDate?.() ?? null;
  const isExpired = expiresAt ? expiresAt < new Date() : true;
  const isSuspended = data.status !== "active";
  return {
    ...(data as object),
    subscriptionExpiresAt: expiresAt,
    isExpired,
    isSuspended,
    isActiveAndValid: !isExpired && !isSuspended,
  };
}

function proposalsCol(accountId: string) {
  return collection(db, "accounts", accountId, "proposals");
}

// Mesmo formato "deal" usado no app antigo (app.js): guardamos o objeto inteiro em `dados`
// e replicamos clienteNome/status/valor no nível raiz pra leitura rápida (usado pelas
// métricas do admin em adminGetDashboardStats).
export function toProposalPayload(dealLike: Deal) {
  const { id: _id, ...rest } = dealLike;
  return {
    clienteNome: dealLike.clientName || "",
    clienteEmail: dealLike.clienteEmail || null,
    status: dealLike.stage || "aberto",
    valor: Number(dealLike.valorFinal) || 0,
    dados: rest,
  };
}

export function fromProposalDoc(id: string, data: Record<string, unknown>) {
  return {
    ...((data.dados as object) || {}),
    id,
    clientName: data.clienteNome,
    stage: data.status,
    valorFinal: data.valor,
  };
}

export async function listProposals(accountId: string) {
  const snap = await getDocs(proposalsCol(accountId));
  return snap.docs.map((d) => fromProposalDoc(d.id, d.data()));
}

/** Erro específico do limite de orçamentos/mês do plano — deixa quem chama mostrar uma mensagem própria. */
export class ProposalLimitError extends Error {}

/**
 * Cria a proposta via /api/create-proposal (Admin SDK) em vez de escrever direto no Firestore:
 * é lá que o limite mensal do plano é validado de verdade, já que as regras de segurança não
 * conseguem contar quantos documentos já existem numa subcoleção.
 */
export async function createProposal(accountId: string, dealLike: Deal) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Não autenticado.");
  const res = await fetch("/api/create-proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ accountId, payload: toProposalPayload(dealLike) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 403) throw new ProposalLimitError(text || "Limite do plano atingido.");
    throw new Error(text || "Falha ao criar proposta.");
  }
  const { id } = (await res.json()) as { id: string };
  return id;
}

export async function updateProposal(accountId: string, id: string, dealLike: Deal) {
  const payload = { ...toProposalPayload(dealLike), atualizadoEm: serverTimestamp() };
  await updateDoc(doc(db, "accounts", accountId, "proposals", id), payload);
}

export async function deleteProposal(accountId: string, id: string) {
  await deleteDoc(doc(db, "accounts", accountId, "proposals", id));
}

export interface CompanyProfile {
  companyName?: string;
  logoUrl?: string | null;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  /** Frase curta sobre a empresa (ex: "10 anos de experiência em limpeza pós-obra") -- aparece no PDF. */
  descricao?: string;
  /** Há quantos anos no mercado -- vira um diferencial de autoridade na apresentação/PDF. */
  anosExperiencia?: string;
  /** Quantas obras já entregou -- idem. */
  obrasEntregues?: string;
}

export async function getCompanyProfile(accountId: string): Promise<CompanyProfile> {
  const snap = await getDoc(doc(db, "accounts", accountId, "companyProfile", "profile"));
  return snap.exists() ? (snap.data() as CompanyProfile) : { companyName: "", logoUrl: null };
}

export async function saveCompanyProfile(accountId: string, data: Omit<CompanyProfile, "logoUrl">) {
  await setDoc(doc(db, "accounts", accountId, "companyProfile", "profile"), data, { merge: true });
}

/** Erro específico do upload da logo — deixa quem chama distinguir isso de uma falha geral ao salvar. */
export class LogoUploadError extends Error {}

export async function uploadCompanyLogo(accountId: string, file: File) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const fileRef = ref(storage, `company-logos/${accountId}/logo.${ext}`);
  try {
    await uploadBytes(fileRef, file);
  } catch (err) {
    console.error("Falha ao enviar a logo", err);
    throw new LogoUploadError("Os outros dados foram salvos, mas não deu pra enviar a logo agora. Tente de novo em instantes.");
  }
  const logoUrl = await getDownloadURL(fileRef);
  await setDoc(doc(db, "accounts", accountId, "companyProfile", "profile"), { logoUrl }, { merge: true });
  return logoUrl;
}

export async function clearCompanyLogo(accountId: string) {
  await setDoc(doc(db, "accounts", accountId, "companyProfile", "profile"), { logoUrl: null }, { merge: true });
}

export function buildWhatsAppShareLink(numero: string, mensagem: string) {
  const digits = String(numero).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
}
