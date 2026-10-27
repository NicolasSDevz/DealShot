// Versão de exemplo do src/lib/adminDb.ts para o modo de visualização.
export interface AdminAccount {
  id: string;
  companyName?: string;
  email?: string;
  status?: string;
  plan?: string;
  billingCycle?: string;
  subscriptionExpiresAt?: { toDate?: () => Date } | Date | null;
  notes?: string;
  [key: string]: unknown;
}
export interface AdminAccountStats {
  accountId: string;
  totalPropostas: number;
  abertas: number;
  fechados: number;
  perdidos: number;
  valorTotalFechado: number;
  valorEmAberto: number;
  ticketMedio: number;
  taxaConversao: number;
  lastActivity: Date | null;
  orcamentosEsteMes: number;
  trafegoPagoGoogle: { total: number; fechados: number };
  trafegoPagoMeta: { total: number; fechados: number };
}
export interface AdminEntry {
  uid: string;
  email?: string;
  [key: string]: unknown;
}
export interface AdminCompanyProfile {
  companyName?: string;
  logoUrl?: string | null;
  [key: string]: unknown;
}

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const accounts: AdminAccount[] = [
  { id: "a1", companyName: "Brilho Limpeza Pós-Obra", email: "contato@brilholimpeza.com.br", status: "active", plan: "sem_limite", billingCycle: "mensal", subscriptionExpiresAt: inDays(20) },
  { id: "a2", companyName: "Clean Up Serviços", email: "cleanup@gmail.com", status: "active", plan: "sem_limite", billingCycle: "mensal", subscriptionExpiresAt: inDays(3) },
  { id: "a3", companyName: "Limpa Fácil", email: "limpafacil@gmail.com", status: "suspended", plan: "sem_limite", billingCycle: "mensal", subscriptionExpiresAt: inDays(-8) },
  { id: "a4", companyName: "Casa Nova Limpezas", email: "casanova@outlook.com", status: "pending_payment", plan: "sem_limite", billingCycle: "mensal", subscriptionExpiresAt: null },
];

export async function adminListAccounts() {
  return accounts;
}
export async function adminListAdmins(): Promise<AdminEntry[]> {
  return [{ uid: "demo", email: "admin@arrowshot.com.br" }];
}
export async function adminAddAdmin() {}
export async function adminRemoveAdmin() {}
export async function adminCreateTestAccount() {}
export async function adminRenewSubscription() {}
export async function adminSetAccountStatus() {}
export async function adminSetAccountPlan() {}
export async function adminSetAccountNotes() {}
export async function adminDeleteAccount() {}
export async function adminGetCompanyProfiles(): Promise<Record<string, AdminCompanyProfile>> {
  return {};
}
export async function adminGetDashboardStats(): Promise<AdminAccountStats[]> {
  return accounts.map((a, i) => ({
    accountId: a.id,
    totalPropostas: 12 - i * 3,
    abertas: 4 - i,
    fechados: 6 - i,
    perdidos: 2,
    valorTotalFechado: 32000 - i * 7000,
    valorEmAberto: 9000 - i * 1500,
    ticketMedio: 4800 - i * 300,
    taxaConversao: 0.5 - i * 0.08,
    lastActivity: inDays(-i * 4),
    orcamentosEsteMes: 5 - i,
    trafegoPagoGoogle: { total: 4, fechados: 2 },
    trafegoPagoMeta: { total: 3, fechados: 1 },
  }));
}
