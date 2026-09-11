export interface Deal {
  id: string | null;
  obraNumero: number | null;
  obraNome: string;
  endereco: string;
  responsavel: string;
  dataInicio: string;
  dataTermino: string;
  dataVisitaTecnica: string;
  /** Anotações da vistoria técnica (superfície, sujidade, estado da obra etc.) — entra no PDF. */
  observacoesVisita: string;
  clientName: string;
  clienteEmail: string;
  clientePhone: string;
  clientType: string;
  leadSource: string;
  /** Qual plataforma de tráfego pago (Google ou Meta) — só quando leadSource === "Tráfego pago". */
  leadSourcePaidChannel: string;
  stage: string;
  createdAt: string;
  closedAt: string | null;
  sentAt: string | null;
  followUpDate: string;
  /** Só relevante quando stage === "fechado": como foi (ou vai ser) pago. */
  formaPagamento: string;
  /** Valor já recebido do cliente (R$) — pode ser menor que valorFinal quando o pagamento é parcelado/faseado. */
  valorPago: string;
  /** Só relevante quando formaPagamento é "Cartão de crédito" ou "Parcelado": em quantas vezes. */
  parcelas: string;

  metragem: string;
  dias: string;
  margem: string;

  vtQtd: string;
  vtValor: string;
  almocoQtd: string;
  almocoValor: string;
  estacionamento: string;
  pedagio: string;
  combKmPorLitro: string;
  combValorLitro: string;
  combKmRodar: string;

  qtd: Record<string, string>;
  diaria: Record<string, string>;
  /** % de encargos (INSS, FGTS, férias, 13º) sobre a mão de obra -- 0 pra quem só trabalha com diarista informal. */
  encargosPct: string;
  /** Quanto o próprio dono precisa receber por esse serviço -- separado do lucro da empresa. */
  proLabore: string;

  visitaTecnica: string;
  rateioAdm: string;
  /** % de imposto sobre o preço de venda (ex: alíquota do Simples Nacional) -- entra junto com a
   * margem na conta do preço sugerido, igual um markup, porque imposto sobre serviço incide sobre
   * o que o cliente paga, não sobre o custo. */
  impostoPct: string;
  /** % extra sobre o custo total pra cobrir desperdício de produto, pano estragado, imprevisto na obra etc. */
  gorduraPct: string;
  valorPagamento: string;
  valorFinal?: number;

  /** Produtos/materiais de limpeza usados no serviço, somados ao cálculo automático por faixa. */
  produtos: ProdutoItem[];
  /** Override manual do % de materiais sobre o custo-base — vazio usa a faixa automática (4/8/12%). */
  materialPctManual: string;

  /** Mostra uma segunda opção mais cara na apresentação/PDF do cliente -- técnica de ancoragem de
   * preço: com 2 opções, o cliente compara as duas entre si em vez de comparar com o concorrente. */
  ofertarPremium: boolean;
  /** O que a opção Premium tem a mais além do escopo padrão (ex: "vidros externos em altura, relatório fotográfico"). */
  premiumDescricao: string;
  /** Valor da opção Premium (R$) -- decidido por quem faz o orçamento, não calculado automaticamente. */
  premiumValor: string;
}

export interface ProdutoItem {
  nome: string;
  /** Ácido / alcalino / neutro / outro -- ajuda a lembrar de não misturar produtos incompatíveis. */
  categoria: string;
  /** Opcional, só pra identificar qual produto específico foi usado (ex: reposição, comparação de preço). */
  marca: string;
  quantidade: string;
  valorUnitario: string;
}

/** Categorias de produto de limpeza -- útil pra não misturar ácido com alcalino sem querer. */
export const PRODUTO_CATEGORIAS = ["Ácido", "Alcalino", "Neutro", "Outro"];

/** Abaixo disso o orçamento é considerado arriscado -- o app avisa e pede confirmação antes de salvar. */
export const MARGEM_MINIMA_SAUDAVEL = 0.3;

export const ROLES = [
  { key: "auxiliar", label: "Auxiliar de limpeza" },
  { key: "lider", label: "Líder" },
  { key: "supervisor", label: "Supervisor" },
  { key: "administrativo", label: "Administrativo (ADM)" },
] as const;

export const LEAD_SOURCES = ["Google Meu Negócio", "Tráfego pago", "Redes sociais", "Indicação", "Recorrente", "Outro"];

export const CLIENT_TYPES = ["Residência", "Apartamento", "Sala comercial", "Condomínio", "Obra/Construtora", "Outro"];

/** Só relevante quando stage === "fechado" — como o cliente pagou (ou vai pagar). */
export const FORMAS_PAGAMENTO = ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto", "Transferência", "Parcelado"];

/** Só relevante quando leadSource === "Tráfego pago" — qual plataforma trouxe o lead. */
export const PAID_TRAFFIC_CHANNELS = ["Google", "Meta"];

/**
 * Estimativa de gasto de produtos por m², de acordo com o tipo de imóvel — obra/construtora
 * suja muito mais que uma residência já limpa, por exemplo. São valores de partida pra dar um
 * cruzamento rápido com o que foi lançado manualmente em "produtos" — ajuste conforme a
 * experiência real da empresa.
 */
export const PRODUCT_RATE_PER_M2: Record<string, number> = {
  "Residência": 1.5,
  "Apartamento": 1.5,
  "Sala comercial": 1.8,
  "Condomínio": 1.8,
  "Obra/Construtora": 3.5,
  "Outro": 1.5,
};

export function estimateProductCostByArea(clientType: string, metragem: number): number {
  const rate = PRODUCT_RATE_PER_M2[clientType] ?? PRODUCT_RATE_PER_M2["Outro"];
  return metragem * rate;
}

// Funil simplificado: Em aberto -> Aguardando resposta -> Fechado / Perdido.
export const STAGES = [
  { id: "aberto", label: "Em aberto" },
  { id: "aguardando", label: "Aguardando resposta" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
] as const;

export function emptyDeal(): Deal {
  return {
    id: null,
    obraNumero: null,
    obraNome: "",
    endereco: "",
    responsavel: "",
    dataInicio: "",
    dataTermino: "",
    dataVisitaTecnica: "",
    observacoesVisita: "",
    clientName: "",
    clienteEmail: "",
    clientePhone: "",
    clientType: "Residência",
    leadSource: "Google Meu Negócio",
    leadSourcePaidChannel: "",
    stage: "aberto",
    createdAt: new Date().toISOString(),
    closedAt: null,
    sentAt: null,
    followUpDate: "",
    formaPagamento: "",
    valorPago: "0",
    parcelas: "",

    metragem: "",
    dias: "",
    margem: "48",

    vtQtd: "",
    vtValor: "",
    almocoQtd: "",
    almocoValor: "",
    estacionamento: "",
    pedagio: "",
    combKmPorLitro: "",
    combValorLitro: "",
    combKmRodar: "",

    qtd: { auxiliar: "1", lider: "0", supervisor: "0", administrativo: "0" },
    diaria: { auxiliar: "120", lider: "180", supervisor: "150", administrativo: "150" },
    encargosPct: "0",
    proLabore: "",

    visitaTecnica: "",
    rateioAdm: "",
    impostoPct: "",
    gorduraPct: "8",
    valorPagamento: "",
    produtos: [],
    materialPctManual: "",

    ofertarPremium: false,
    premiumDescricao: "",
    premiumValor: "",
  };
}

export function emptyProduto(): ProdutoItem {
  return { nome: "", categoria: "Neutro", marca: "", quantidade: "1", valorUnitario: "" };
}

export const PLANS = [
  { id: "teste", label: "Teste", limit: 3 },
  { id: "start", label: "Start", limit: 15 },
  { id: "cresce", label: "Converte", limit: 40 },
  { id: "sem_limite", label: "Ilimitado", limit: null },
] as const;
export type PlanId = (typeof PLANS)[number]["id"];

export type BillingCycle = "mensal" | "anual";

/** Preços fixos dos planos pagos (o Teste é sempre gratuito, não passa pelo Asaas). */
export const PLAN_PRICES: Record<Exclude<PlanId, "teste">, Record<BillingCycle, number>> = {
  start: { mensal: 24.9, anual: 249 },
  cresce: { mensal: 39.9, anual: 399 },
  sem_limite: { mensal: 59.9, anual: 599 },
};

/** Limite de orçamentos do plano (null = ilimitado; plano desconhecido/antigo = sem limite). */
export function planLimit(planId: string | undefined): number | null {
  return PLANS.find((p) => p.id === planId)?.limit ?? null;
}

export function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/**
 * O plano Teste é um limite vitalício (os 3 orçamentos do teste, e só) -- diferente dos planos
 * pagos, cujo limite é por mês porque acompanha o ciclo de cobrança da assinatura. Se o Teste
 * também resetasse por mês, a conta ganharia 3 orçamentos grátis todo mês pra sempre, sem nunca
 * precisar assinar.
 */
export function planResetsMonthly(planId: string | undefined): boolean {
  return planId !== "teste";
}

/**
 * Quantos orçamentos já contam pro limite do plano -- só os do mês nos planos pagos. No Teste é
 * o contador vitalício da conta (lifetimeUsed, vindo de accounts/{id}.proposalsCreatedCount) --
 * NÃO dá pra contar quantas propostas existem agora, porque apagar uma abriria espaço pra criar
 * outra e o "trial" nunca acabaria. Se lifetimeUsed ainda não veio (conta carregando), cai no
 * total de propostas como aproximação só pra não travar a tela.
 */
export function usedForPlanLimit(deals: { createdAt: string }[], planId: string | undefined, lifetimeUsed?: number): number {
  if (!planResetsMonthly(planId)) {
    return lifetimeUsed ?? deals.length;
  }
  return deals.filter((d) => isThisMonth(d.createdAt)).length;
}

export function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/** Arredonda pra centavos -- sem isso, somar/subtrair valores com dízima de ponto flutuante
 * (ex: em Resultados, faturado - custos) pode fechar 1 centavo "errado" mesmo com a matemática
 * certa, porque cada valor é arredondado pra exibição de forma independente. */
export function roundCents(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function formatBRL(value: number | undefined | null): string {
  return (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data de término = início + (dias - 1), já que 1 dia de serviço começa e termina no mesmo dia. */
export function computeDataTermino(dataInicio: string, dias: string): string {
  const n = num(dias);
  if (!dataInicio || n <= 0) return "";
  const d = new Date(dataInicio + "T00:00:00");
  d.setDate(d.getDate() + (n - 1));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Formata enquanto digita: (51) 9 9805-8521 (celular) ou (51) 3805-8521 (fixo). */
export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length <= 2) return ddd ? `(${ddd}` : "";
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) {
    // fixo: 8 dígitos -> (DD) NNNN-NNNN
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  // celular: 9 dígitos -> (DD) 9 NNNN-NNNN
  return `(${ddd}) ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
}

export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    const p4 = digits.slice(9, 11);
    let out = p1;
    if (p2) out += `.${p2}`;
    if (p3) out += `.${p3}`;
    if (p4) out += `-${p4}`;
    return out;
  }
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 8);
  const p4 = digits.slice(8, 12);
  const p5 = digits.slice(12, 14);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `/${p4}`;
  if (p5) out += `-${p5}`;
  return out;
}

export function formatDateBR(v: string | null | undefined): string {
  if (!v) return "Não informada";
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}

const MATERIAL_TIERS = [
  { ate: 1000, pct: 0.04 },
  { ate: 2000, pct: 0.08 },
  { ate: Infinity, pct: 0.12 },
];

function materialPercent(base: number) {
  const tier = MATERIAL_TIERS.find((t) => base <= t.ate);
  return tier ? tier.pct : MATERIAL_TIERS[MATERIAL_TIERS.length - 1].pct;
}

export function calcDeal(d: Deal) {
  const dias = num(d.dias);

  const vtTotal = roundCents(dias * num(d.vtQtd) * num(d.vtValor));
  const almocoTotal = roundCents(dias * num(d.almocoQtd) * num(d.almocoValor));
  const estacionamento = num(d.estacionamento);
  const pedagio = num(d.pedagio);
  const combustivelTotal = roundCents(
    num(d.combKmPorLitro) > 0 ? dias * (num(d.combKmRodar) / num(d.combKmPorLitro)) * num(d.combValorLitro) : 0,
  );
  const apoioTotal = roundCents(vtTotal + almocoTotal + estacionamento + pedagio + combustivelTotal);

  let maoDeObraTotal = 0;
  ROLES.forEach((r) => {
    maoDeObraTotal += num(d.qtd[r.key]) * num(d.diaria[r.key]) * dias;
  });
  maoDeObraTotal = roundCents(maoDeObraTotal);

  // Encargos (INSS/FGTS/férias/13º) incidem sobre a mão de obra; pró-labore é o que o dono
  // precisa receber, separado do lucro -- as duas coisas que quem não tem contador mais esquece
  // de colocar na conta, e por isso acaba trabalhando por menos do que devia.
  const encargosTotal = roundCents(maoDeObraTotal * (num(d.encargosPct) / 100));
  const proLaboreTotal = num(d.proLabore);

  const baseParaMaterial = maoDeObraTotal + encargosTotal + proLaboreTotal + apoioTotal + num(d.rateioAdm) + num(d.visitaTecnica);
  const materialPct = d.materialPctManual !== "" && d.materialPctManual != null
    ? num(d.materialPctManual) / 100
    : materialPercent(baseParaMaterial);
  const custoProdutos = roundCents((d.produtos || []).reduce((s, p) => s + num(p.quantidade || "1") * num(p.valorUnitario), 0));
  const materiaisTotal = roundCents(baseParaMaterial * materialPct + custoProdutos);

  const custosAntesDaGordura = roundCents(baseParaMaterial + materiaisTotal);

  // "Gordura de segurança": cobre desperdício de produto, pano/ferramenta estragada e imprevisto
  // na obra -- entra automaticamente no custo, então o preço sugerido já nasce protegido em vez
  // de depender de o usuário lembrar de "arredondar pra cima".
  const gorduraPct = num(d.gorduraPct) / 100;
  const gorduraValor = roundCents(custosAntesDaGordura * gorduraPct);
  const custosOperacionais = roundCents(custosAntesDaGordura + gorduraValor);

  // Imposto (ex: alíquota do Simples Nacional) incide sobre o preço de venda, não sobre o custo --
  // por isso entra na mesma conta de "markup" da margem, em vez de ser somado aos custos antes de
  // calcular o preço (senão o valor digitado em % nunca refletia no preço final).
  const margem = Math.min(num(d.margem) / 100, 0.95);
  const impostoPct = Math.min(num(d.impostoPct) / 100, 0.5);
  const percentualSobreVenda = Math.min(margem + impostoPct, 0.95);
  const precoVendaSugerido = roundCents(
    percentualSobreVenda < 1 ? custosOperacionais / (1 - percentualSobreVenda) : custosOperacionais,
  );

  const valorPagamento = d.valorPagamento !== "" && d.valorPagamento != null ? num(d.valorPagamento) : precoVendaSugerido;

  const valorFinal = roundCents(valorPagamento);
  const impostoTotal = roundCents(valorFinal * impostoPct);
  const lucroRS = roundCents(valorFinal - custosOperacionais - impostoTotal);
  const margemReal = valorFinal > 0 ? (valorFinal - custosOperacionais - impostoTotal) / valorFinal : 0;
  const markupRealFinal = custosOperacionais > 0 ? (valorFinal - custosOperacionais - impostoTotal) / custosOperacionais : 0;
  const metragem = num(d.metragem);
  const custoPorM2 = metragem > 0 ? roundCents(custosOperacionais / metragem) : 0;
  const margemAbaixoDoSaudavel = valorFinal > 0 && margemReal < MARGEM_MINIMA_SAUDAVEL;

  return {
    vtTotal,
    almocoTotal,
    combustivelTotal,
    apoioTotal,
    maoDeObraTotal,
    encargosTotal,
    proLaboreTotal,
    materiaisTotal,
    materialPct,
    custoProdutos,
    impostoTotal,
    gorduraValor,
    custosAntesDaGordura,
    custosOperacionais,
    precoVendaSugerido,
    lucroRS,
    valorFinal,
    margemReal,
    markupRealFinal,
    custoPorM2,
    margemAbaixoDoSaudavel,
  };
}
