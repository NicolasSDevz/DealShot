import { useEffect, useState, type ReactElement } from "react";
import {
  getAccountStatus,
  listProposals,
  createProposal,
  updateProposal,
  deleteProposal,
  getCompanyProfile,
  saveCompanyProfile,
  uploadCompanyLogo,
  buildKiwifyCheckoutUrl,
  ProposalLimitError,
  type AccountStatus,
  type CompanyProfile,
} from "../lib/db";
import { useAuth } from "../context/useAuth";
import { useDialog } from "../context/useDialog";
import { planLimit, planResetsMonthly, usedForPlanLimit, PLANS, type Deal, type PlanId, type BillingCycle } from "../lib/calc";
import QuoteForm from "./QuoteForm";
import ProposalsBoard from "./ProposalsBoard";
import SalesOverview from "./SalesOverview";
import ChecklistPanel from "./ChecklistPanel";
import CompanySetupForm from "./CompanySetupForm";
import ThemeToggle from "./ThemeToggle";
import Modal from "./Modal";
import UsageBadge from "./UsageBadge";
import LimitModal from "./LimitModal";
import UpgradeModal from "./UpgradeModal";
import { UserIcon, LogoutIcon, RocketIcon, CalculatorIcon, KanbanIcon, ChartIcon, CheckCircleIcon, PlusIcon } from "./Icons";

type Tab = "calc" | "funil" | "painel" | "checklist";

const TAB_HASH: Record<Tab, string> = { calc: "orcamento", funil: "propostas", painel: "resultados", checklist: "checklist" };

function tabFromHash(): Tab {
  const h = window.location.hash.replace("#", "");
  const found = (Object.keys(TAB_HASH) as Tab[]).find((t) => TAB_HASH[t] === h);
  return found || "calc";
}

// Teste de oferta única (ver SignupPage.tsx): esconde o badge de uso ("X/Y orçamentos") e o
// botão de assinatura no topo enquanto a grade de planos normal fica de lado. Só mude pra
// true de novo quando os planos voltarem.
const SHOW_PLAN_UI = false;

// A princípio a logo nunca sobe pro Storage -- fica só no navegador de quem está usando (some ao
// recarregar a página), pra não gravar nada no banco de dados por enquanto. Muda pra true quando
// isso fizer sentido de novo (ex: ligado a um plano pago).
const SAVE_LOGO_TO_SERVER = false;

export default function AccountShell({ accountId, asAdmin = false }: { accountId: string; asAdmin?: boolean }) {
  const { logout } = useAuth();
  const { confirmDialog, alertDialog } = useDialog();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTabState] = useState<Tab>(() => tabFromHash());
  // A aba fica no endereço (#propostas etc.): recarregar a página ou usar o "voltar" do
  // navegador/celular mantém a pessoa onde estava, em vez de sempre cair na calculadora.
  function setTab(t: Tab) {
    setTabState(t);
    const hash = TAB_HASH[t];
    if (window.location.hash !== `#${hash}`) window.history.pushState(null, "", `#${hash}`);
  }
  useEffect(() => {
    const onPop = () => setTabState(tabFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [showCompanyEditor, setShowCompanyEditor] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Logo escolhida no plano Teste: só em memória, nunca sobe pro Storage -- some ao recarregar.
  const [ephemeralLogoUrl, setEphemeralLogoUrl] = useState<string | null>(null);

  async function loadAll() {
    const s = await getAccountStatus(accountId);
    setStatus(s);
    if (!s.isActiveAndValid) return;
    const [profile, proposals] = await Promise.all([getCompanyProfile(accountId), listProposals(accountId)]);
    setCompany(profile);
    setDeals(proposals as unknown as Deal[]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        console.error("Falha ao carregar conta", e);
        if (!cancelled) setLoadErr("Não foi possível carregar essa conta.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  if (loadErr) {
    return (
      <div className="auth-screen">
        <div className="panel auth-panel">
          <h2 className="panel-title">Erro</h2>
          <p className="panel-help">{loadErr}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="auth-screen">
        <div className="panel auth-panel">
          <p className="panel-help">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!status.isActiveAndValid) {
    const rawStatus = (status as { status?: string }).status;
    const needsPayment = rawStatus === "pending_payment" || rawStatus === "payment_failed";
    const blockedMessage = rawStatus === "pending_payment"
      ? "Falta confirmar o pagamento pra ativar sua conta."
      : rawStatus === "payment_failed"
        ? "A última cobrança não passou. Atualize o pagamento pra continuar usando."
        : status.isSuspended
          ? "Conta suspensa. Fale com o suporte para reativar."
          : "Assinatura vencida. Fale com o suporte para renovar.";
    return (
      <div className="auth-screen">
        <div className="panel auth-panel">
          <h2 className="panel-title">Acesso bloqueado</h2>
          <p className="panel-help">{blockedMessage}</p>
          {needsPayment && !asAdmin && (
            <button
              className="save-btn"
              style={{ width: "100%", marginBottom: 8 }}
              onClick={async () => {
                const checkoutUrl = buildKiwifyCheckoutUrl(accountId);
                if (!checkoutUrl) {
                  await alertDialog("O link de pagamento ainda não foi configurado. Fale com o suporte.");
                  return;
                }
                window.location.href = checkoutUrl;
              }}
            >
              Assinar agora
            </button>
          )}
          {!asAdmin && (
            <button className="save-btn" style={{ width: "100%" }} onClick={() => logout()}>
              Sair
            </button>
          )}
        </div>
      </div>
    );
  }

  async function handleSaveCompany(data: Omit<CompanyProfile, "logoUrl">, file: File | null) {
    await saveCompanyProfile(accountId, data);
    // Salva os dados de texto primeiro, independente da logo — assim uma falha só no envio
    // da imagem (ex: sem internet no momento) não faz parecer que nada foi salvo.
    setCompany(await getCompanyProfile(accountId));
    if (file) {
      await uploadCompanyLogo(accountId, file);
      setCompany(await getCompanyProfile(accountId));
    }
    setShowCompanyEditor(false);
  }

  // Mescla a logo "só nesta sessão" (plano Teste) com o perfil salvo, pra ela aparecer nos
  // PDFs e no banner de "complete o perfil" mesmo sem estar gravada no banco.
  const companyForDisplay: CompanyProfile | null = company
    ? { ...company, logoUrl: company.logoUrl || ephemeralLogoUrl }
    : company;

  const companyIncomplete =
    !!companyForDisplay &&
    (!companyForDisplay.companyName || !companyForDisplay.endereco || !companyForDisplay.telefone || !companyForDisplay.logoUrl);

  async function handleSaveDeal(deal: Deal) {
    if (deal.id) {
      await updateProposal(accountId, deal.id, deal);
    } else {
      // Checagem só pra dar feedback rápido sem round-trip -- quem garante o limite de
      // verdade é o /api/create-proposal, do lado do servidor.
      const limit = planLimit(status?.plan);
      const usados = usedForPlanLimit(deals, status?.plan, status?.proposalsCreatedCount);
      if (limit != null && usados >= limit) {
        setShowLimitModal(true);
        return;
      }
      // Maior obraNumero já usado + 1, em vez de deals.length + 1 -- senão, depois de
      // excluir uma proposta, o próximo orçamento criado repetia o número de outro já existente.
      const nextObraNumero = deals.reduce((max, d) => Math.max(max, d.obraNumero || 0), 0) + 1;
      try {
        await createProposal(accountId, { ...deal, obraNumero: nextObraNumero });
        // Atualiza o contador vitalício do Teste (accounts/{id}.proposalsCreatedCount), que o
        // servidor acabou de incrementar -- senão o badge de uso ficaria com o número antigo.
        setStatus(await getAccountStatus(accountId));
      } catch (err) {
        if (err instanceof ProposalLimitError) {
          setShowLimitModal(true);
        } else {
          await alertDialog("Não foi possível criar o orçamento. Tente de novo.");
        }
        return;
      }
    }
    setEditingDeal(null);
    const proposals = await listProposals(accountId);
    setDeals(proposals as unknown as Deal[]);
  }

  async function handleChangeStage(deal: Deal, stage: string) {
    const patch: Partial<Deal> = { stage };
    if (stage === "fechado" && !deal.closedAt) patch.closedAt = new Date().toISOString();
    if (stage === "aguardando" && !deal.sentAt) {
      patch.sentAt = new Date().toISOString();
      // Sugere o "dia 2" da cadência de follow-up do roteiro de vendas (confirma no mesmo dia,
      // acompanha no dia 2) como primeira data, só se a pessoa ainda não tiver escolhido uma --
      // nunca sobrescreve uma data que ela já ajustou na mão.
      if (!deal.followUpDate) {
        const suggested = new Date();
        suggested.setDate(suggested.getDate() + 2);
        patch.followUpDate = suggested.toISOString().slice(0, 10);
      }
    }
    const updated = { ...deal, ...patch };
    await updateProposal(accountId, deal.id!, updated);
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? updated : d)));
  }

  async function handleSetFollowUpDate(deal: Deal, date: string) {
    const updated = { ...deal, followUpDate: date };
    await updateProposal(accountId, deal.id!, updated);
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? updated : d)));
  }

  async function handleSetPagamento(deal: Deal, patch: Partial<Pick<Deal, "formaPagamento" | "valorPago" | "parcelas">>) {
    const updated = { ...deal, ...patch };
    await updateProposal(accountId, deal.id!, updated);
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? updated : d)));
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog("Excluir esta proposta?", { confirmLabel: "Excluir", tone: "danger" }))) return;
    await deleteProposal(accountId, id);
    setDeals((ds) => ds.filter((d) => d.id !== id));
  }

  const planId = status.plan as PlanId | undefined;
  const canSaveLogo = SAVE_LOGO_TO_SERVER;
  const monthlyLimit = planLimit(planId);
  const usedForLimit = usedForPlanLimit(deals, planId, status.proposalsCreatedCount);
  const currentPlanLabel = PLANS.find((p) => p.id === planId)?.label || "atual";
  const limitPeriodLabel = planResetsMonthly(planId) ? "neste mês" : "no total do plano Teste";

  const todayStr = new Date().toISOString().slice(0, 10);
  const followUpsDue = deals.filter((d) => d.stage === "aguardando" && d.followUpDate && d.followUpDate <= todayStr).length;
  const displayName = company?.companyName || status.companyName || "Sua empresa";
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || "D";

  const NAV: { id: Tab; label: string; icon: ReactElement; badge?: number }[] = [
    { id: "calc", label: "Calculadora", icon: <CalculatorIcon /> },
    { id: "funil", label: "Propostas", icon: <KanbanIcon />, badge: followUpsDue },
    { id: "painel", label: "Resultados", icon: <ChartIcon /> },
    { id: "checklist", label: "Checklist", icon: <CheckCircleIcon /> },
  ];

  const PAGE_HEAD: Record<Tab, { title: string; sub: string }> = {
    calc: {
      title: editingDeal ? "Editar orçamento" : "Novo orçamento",
      sub: "Preencha as 5 etapas. O preço certo aparece ao lado, na hora.",
    },
    funil: { title: "Propostas", sub: "Acompanhe cada orçamento até o fechamento e o recebimento." },
    painel: { title: "Resultados", sub: "Quanto você vendeu, quanto sobrou e de onde vieram os clientes." },
    checklist: { title: "Checklist de atendimento", sub: "10 hábitos que fazem o cliente perceber valor e fechar com você." },
  };

  function startNewQuote() {
    setEditingDeal(null);
    setTab("calc");
  }

  return (
    <div id="app" className="shell">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      {asAdmin && (
        <div className="admin-view-banner">
          Você está vendo o painel como o cliente <strong>{company?.companyName || status.companyName || status.email}</strong> (modo admin).{" "}
          <a href="/admin">Voltar ao painel admin</a>
        </div>
      )}

      <aside className="sidebar" aria-label="Menu principal">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="" className="sidebar-logo" />
          <span className="sidebar-brand-name">
            Deal <span>Shot</span>
          </span>
        </div>

        <button type="button" className="sidebar-cta" onClick={startNewQuote}>
          <PlusIcon />
          Novo orçamento
        </button>

        <nav className="sidebar-nav" aria-label="Seções do painel">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`sidebar-link${tab === n.id ? " active" : ""}`}
              aria-current={tab === n.id ? "page" : undefined}
              onClick={() => setTab(n.id)}
            >
              {n.icon}
              <span>{n.label}</span>
              {!!n.badge && (
                <span className="sidebar-badge" aria-label={`${n.badge} follow-up(s) para hoje`}>
                  {n.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {SHOW_PLAN_UI && !asAdmin && (
            <UsageBadge used={usedForLimit} limit={monthlyLimit} periodLabel={limitPeriodLabel} onClick={() => setShowUpgradeModal(true)} />
          )}
          <button type="button" className="sidebar-account" onClick={() => setShowCompanyEditor(true)} title="Perfil da empresa">
            {companyForDisplay?.logoUrl ? (
              <img src={companyForDisplay.logoUrl} alt="" className="sidebar-account-avatar img" />
            ) : (
              <span className="sidebar-account-avatar" aria-hidden="true">
                {displayInitial}
              </span>
            )}
            <span className="sidebar-account-text">
              <strong>{displayName}</strong>
              <small>Perfil da empresa</small>
            </span>
          </button>
          <div className="sidebar-tools">
            <ThemeToggle />
            {SHOW_PLAN_UI && !asAdmin && (
              <button className="theme-toggle" title="Assinatura" aria-label="Melhorar assinatura" onClick={() => setShowUpgradeModal(true)}>
                <RocketIcon />
              </button>
            )}
            {!asAdmin && (
              <button className="theme-toggle" title="Sair" aria-label="Sair" onClick={() => logout()}>
                <LogoutIcon />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Celular: barra de cima enxuta + menu fixo embaixo (no lugar do menu lateral). */}
      <header className="mobile-topbar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="" className="sidebar-logo" />
          <span className="sidebar-brand-name">
            Deal <span>Shot</span>
          </span>
        </div>
        <div className="mobile-topbar-tools">
          <ThemeToggle />
          <button className="theme-toggle" title="Perfil" aria-label="Perfil da empresa" onClick={() => setShowCompanyEditor(true)}>
            <UserIcon />
          </button>
          {!asAdmin && (
            <button className="theme-toggle" title="Sair" aria-label="Sair" onClick={() => logout()}>
              <LogoutIcon />
            </button>
          )}
        </div>
      </header>

      <nav className="bottom-tabbar" aria-label="Seções do painel">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`bottom-tab${tab === n.id ? " active" : ""}`}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => setTab(n.id)}
          >
            <span className="bottom-tab-icon">
              {n.icon}
              {!!n.badge && <span className="bottom-tab-badge">{n.badge}</span>}
            </span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {showCompanyEditor && companyForDisplay && (
        <Modal onClose={() => setShowCompanyEditor(false)}>
          <CompanySetupForm
            bare
            initial={companyForDisplay}
            canSaveLogo={canSaveLogo}
            onLogoPreviewOnly={setEphemeralLogoUrl}
            onCancel={() => setShowCompanyEditor(false)}
            onSave={handleSaveCompany}
          />
        </Modal>
      )}

      {showLimitModal && (
        <LimitModal
          used={usedForLimit}
          limit={monthlyLimit || usedForLimit}
          planLabel={currentPlanLabel}
          periodLabel={limitPeriodLabel}
          onUpgrade={() => {
            setShowLimitModal(false);
            setShowUpgradeModal(true);
          }}
          onClose={() => setShowLimitModal(false)}
        />
      )}

      {showUpgradeModal && !asAdmin && (
        <UpgradeModal
          accountId={accountId}
          email={status.email || ""}
          companyName={company?.companyName || status.companyName}
          cnpj={company?.cnpj}
          currentPlan={(planId || "start") as PlanId}
          currentBillingCycle={(status.billingCycle as BillingCycle) || "mensal"}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      <main className="main" id="main-content">
        <div className="page-head">
          <div>
            <h1 className="page-title">{PAGE_HEAD[tab].title}</h1>
            <p className="page-sub">{PAGE_HEAD[tab].sub}</p>
          </div>
          {tab !== "calc" && (
            <button type="button" className="save-btn page-head-cta" onClick={startNewQuote}>
              <PlusIcon />
              Novo orçamento
            </button>
          )}
        </div>
        {tab === "calc" && companyIncomplete && (
          <div className="hint-banner" role="status">
            <span>Coloque os dados da sua empresa pra aparecer no PDF dos orçamentos.</span>
            <button type="button" className="hint-banner-btn" onClick={() => setShowCompanyEditor(true)}>
              Completar perfil
            </button>
          </div>
        )}
        {tab === "calc" && (
          <QuoteForm
            key={editingDeal?.id || "new"}
            initialDeal={editingDeal}
            company={companyForDisplay || {}}
            obraNumero={deals.length + 1}
            onSave={handleSaveDeal}
            onCancelEdit={() => setEditingDeal(null)}
          />
        )}
        {tab === "funil" && (
          <ProposalsBoard
            deals={deals}
            company={companyForDisplay || {}}
            onEdit={(deal) => {
              setEditingDeal(deal);
              setTab("calc");
            }}
            onDelete={handleDelete}
            onChangeStage={handleChangeStage}
            onSetFollowUpDate={handleSetFollowUpDate}
            onSetPagamento={handleSetPagamento}
          />
        )}
        {tab === "painel" && <SalesOverview deals={deals} />}
        {tab === "checklist" && <ChecklistPanel accountId={accountId} initial={status.checklistAtendimento || {}} />}
      </main>
    </div>
  );
}
