// Mesma "cara" do src/lib/db.ts, mas tudo em memória com dados de exemplo.
import { emptyDeal, calcDeal, type Deal } from "../src/lib/calc";

export async function sendBrandedAuthEmail() {}
export const KIWIFY_CHECKOUT_URL = "";
export function buildKiwifyCheckoutUrl(): string | null {
  return null;
}

export interface AccountStatus {
  companyName?: string;
  email?: string;
  status?: string;
  plan?: string;
  billingCycle?: string;
  proposalsCreatedCount?: number;
  subscriptionExpiresAt: Date | null;
  isExpired: boolean;
  isSuspended: boolean;
  isActiveAndValid: boolean;
  checklistAtendimento?: Record<string, boolean>;
}

export interface CompanyProfile {
  companyName?: string;
  logoUrl?: string | null;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  descricao?: string;
  anosExperiencia?: string;
  obrasEntregues?: string;
}

const q = new URLSearchParams(window.location.search);
const empty = q.get("vazio") === "1";

let checklist: Record<string, boolean> = { 0: true, 1: true, 3: true };

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function mk(i: number, p: Partial<Deal>): Deal {
  const d: Deal = { ...emptyDeal(), id: `d${i}`, obraNumero: i, ...p };
  d.valorFinal = calcDeal(d).valorFinal;
  return d;
}

const base = {
  dias: "2",
  margem: "48",
  impostoPct: "6",
  proLabore: "300",
  almocoQtd: "4",
  almocoValor: "25",
  qtd: { auxiliar: "3", lider: "1", supervisor: "0", administrativo: "0" },
};

let deals: Deal[] = empty
  ? []
  : [
      mk(1, { ...base, clientName: "Marina Couto", obraNome: "Casa Alphaville", clientType: "Residência", metragem: "150", stage: "fechado", createdAt: daysAgo(40), closedAt: daysAgo(35), leadSource: "Indicação", formaPagamento: "Pix", valorPago: "5000" }),
      mk(2, { ...base, clientName: "Construtora Vértice", obraNome: "Edifício Aurora — 12 unidades", clientType: "Obra/Construtora", metragem: "980", dias: "6", qtd: { auxiliar: "6", lider: "2", supervisor: "1", administrativo: "0" }, stage: "aguardando", createdAt: daysAgo(3), sentAt: daysAgo(2), followUpDate: daysAgo(-1).slice(0, 10), leadSource: "Tráfego pago", leadSourcePaidChannel: "Google" }),
      mk(3, { ...base, clientName: "Rafael Nunes", obraNome: "Apto 142 — Moema", clientType: "Apartamento", metragem: "120", stage: "aberto", createdAt: daysAgo(1), leadSource: "Tráfego pago", leadSourcePaidChannel: "Meta" }),
      mk(4, { ...base, clientName: "Clínica Sorriso", obraNome: "Sala 304", clientType: "Sala comercial", metragem: "80", dias: "1", stage: "perdido", createdAt: daysAgo(20), leadSource: "Google Meu Negócio" }),
      mk(5, { ...base, clientName: "Condomínio Jardins", obraNome: "Áreas comuns", clientType: "Condomínio", metragem: "400", dias: "3", stage: "fechado", createdAt: daysAgo(12), closedAt: daysAgo(9), leadSource: "Recorrente", formaPagamento: "Parcelado", parcelas: "3", valorPago: "2500" }),
      mk(6, { ...base, clientName: "Beatriz Lima", obraNome: "Sobrado Vila Mariana", clientType: "Residência", metragem: "210", dias: "3", stage: "aguardando", createdAt: daysAgo(6), sentAt: daysAgo(5), followUpDate: daysAgo(1).slice(0, 10), leadSource: "Redes sociais" }),
      mk(7, { ...base, clientName: "Loja Bella Moda", obraNome: "Loja Shopping Ibirapuera", clientType: "Sala comercial", metragem: "95", dias: "1", stage: "fechado", createdAt: daysAgo(70), closedAt: daysAgo(66), leadSource: "Google Meu Negócio", formaPagamento: "Cartão de crédito", parcelas: "2", valorPago: "2100" }),
    ];

let company: CompanyProfile = {
  companyName: "Brilho Limpeza Pós-Obra",
  logoUrl: null,
  cnpj: "12.345.678/0001-90",
  endereco: "Rua das Palmeiras, 120 — São Paulo/SP",
  telefone: "(11) 9 8888-7777",
  email: "contato@brilholimpeza.com.br",
  descricao: "Limpeza pós-obra com equipe própria e treinada.",
  anosExperiencia: "8",
  obrasEntregues: "320",
};

export async function saveChecklistAtendimento(_a: string, items: Record<string, boolean>) {
  checklist = items;
}

export async function getAccountStatus(): Promise<AccountStatus> {
  const exp = new Date();
  exp.setDate(exp.getDate() + 20);
  const st = q.get("status") || "active";
  return {
    companyName: company.companyName,
    email: "contato@brilholimpeza.com.br",
    status: st,
    plan: "sem_limite",
    billingCycle: "mensal",
    proposalsCreatedCount: deals.length,
    subscriptionExpiresAt: exp,
    isExpired: false,
    isSuspended: st !== "active",
    isActiveAndValid: st === "active",
    checklistAtendimento: checklist,
  };
}

export function toProposalPayload(d: Deal) {
  return d;
}
export function fromProposalDoc(id: string, data: Record<string, unknown>) {
  return { ...data, id };
}

export async function listProposals() {
  return deals.map((d) => ({ ...d }));
}

export class ProposalLimitError extends Error {}

export async function createProposal(_a: string, d: Deal) {
  const id = `d${Date.now()}`;
  deals = [...deals, { ...d, id, createdAt: new Date().toISOString() }];
  return id;
}
export async function updateProposal(_a: string, id: string, d: Deal) {
  deals = deals.map((x) => (x.id === id ? { ...d, id } : x));
}
export async function deleteProposal(_a: string, id: string) {
  deals = deals.filter((x) => x.id !== id);
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  return { ...company };
}
export async function saveCompanyProfile(_a: string, data: Omit<CompanyProfile, "logoUrl">) {
  company = { ...company, ...data };
}
export class LogoUploadError extends Error {}
export async function uploadCompanyLogo() {
  return "";
}
export async function clearCompanyLogo() {}
export function buildWhatsAppShareLink(numero: string, mensagem: string) {
  return `https://wa.me/${String(numero).replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;
}
