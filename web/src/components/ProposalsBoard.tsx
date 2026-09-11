import { useId, useMemo, useState, type ReactElement } from "react";
import { STAGES, FORMAS_PAGAMENTO, formatBRL, num, roundCents, type Deal } from "../lib/calc";
import { buildWhatsAppShareLink } from "../lib/db";
import { MESSAGE_TEMPLATES } from "../lib/templates";
import { downloadClientPdf } from "../lib/pdf";
import PresentationView from "./PresentationView";
import type { CompanyProfile } from "../lib/db";
import { useDialog } from "../context/useDialog";
import {
  InboxIcon,
  SendIcon,
  CheckCircleIcon,
  XCircleIcon,
  CreditCardIcon,
  ZapIcon,
  BanknoteIcon,
  BarcodeIcon,
  BankIcon,
  LayersIcon,
} from "./Icons";

// Formas de pagamento recebidas à vista/na hora -- ao escolher uma delas, já preenchemos
// o valor recebido como o valor total, porque na prática ninguém digita esse valor manualmente.
// "Boleto" e "Parcelado" ficam de fora: o dinheiro pode levar dias pra cair ou vir em partes.
// "Cartão de crédito" também entra aqui (assume à vista) -- mas se a pessoa marcar mais de 1
// parcela, o dinheiro passa a cair aos poucos, então o valor recebido é zerado de novo
// (ver handleParcelasChange).
const AUTO_FULL_PAYMENT_METHODS = new Set(["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência"]);

// Formas que podem ser divididas em parcelas -- mostram o campo "em quantas vezes" e o botão
// de somar uma parcela recebida por vez, em vez de um único campo "valor recebido" pra tudo.
const INSTALLMENT_METHODS = new Set(["Cartão de crédito", "Parcelado"]);

const PAYMENT_METHOD_ICONS: Record<string, ReactElement> = {
  Pix: <ZapIcon />,
  "Cartão de crédito": <CreditCardIcon />,
  "Cartão de débito": <CreditCardIcon />,
  Dinheiro: <BanknoteIcon />,
  Boleto: <BarcodeIcon />,
  Transferência: <BankIcon />,
  Parcelado: <LayersIcon />,
};

const STAGE_META: Record<string, { icon: ReactElement; color: string }> = {
  aberto: { icon: <InboxIcon />, color: "var(--n-600)" },
  aguardando: { icon: <SendIcon />, color: "var(--amber-400)" },
  fechado: { icon: <CheckCircleIcon />, color: "var(--emerald-400)" },
  perdido: { icon: <XCircleIcon />, color: "var(--red-400)" },
};

interface Props {
  deals: Deal[];
  company: CompanyProfile;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
  onChangeStage: (deal: Deal, stage: string) => void;
  onSetFollowUpDate: (deal: Deal, date: string) => void;
  onSetPagamento: (deal: Deal, patch: Partial<Pick<Deal, "formaPagamento" | "valorPago" | "parcelas">>) => void;
}

// Alguns orçamentos antigos ficaram com valores tipo "1106.086153846153" salvos (arredondamento
// que escapou antes de existir o toFixed(2) nos botões rápidos) -- limpa pra 2 casas só quando
// sobra precisão de mais, sem mexer no valor enquanto a pessoa ainda está digitando um decimal
// normal (ex: "10." ou "10.5"), senão o cursor pula a cada tecla.
function cleanValorPagoDisplay(raw: string): string {
  if (!raw) return raw;
  const dot = raw.indexOf(".");
  if (dot === -1 || raw.length - dot - 1 <= 2) return raw;
  return String(roundCents(num(raw)));
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// Cadência de follow-up do roteiro de vendas: mesmo dia (confirma recebimento), dia 2 (mostra um
// serviço parecido), dia 4 (cria urgência com a validade), dia 5 (encerra ou renova). Em vez de
// guardar "em que dia da cadência estamos" como campo à parte, deriva sempre de `sentAt` -- assim
// nunca desalinha do que já está salvo, mesmo que a pessoa abra o card dias depois.
const FOLLOWUP_CADENCE = [
  { atDay: 0, templateId: "confirmacao_recebimento", hint: "Confirme que a proposta chegou certinho" },
  { atDay: 2, templateId: "primeiro_followup", hint: "Dia 2: mande uma foto de um serviço parecido" },
  { atDay: 4, templateId: "criar_urgencia", hint: "Dia 4: crie urgência com a validade da proposta" },
  { atDay: 5, templateId: "encerramento_proposta", hint: "Dia 5: hora de encerrar ou renovar a proposta" },
] as const;

function cadenceStepFor(sentDays: number | null) {
  if (sentDays == null) return null;
  let step: (typeof FOLLOWUP_CADENCE)[number] | null = null;
  for (const s of FOLLOWUP_CADENCE) {
    if (sentDays >= s.atDay) step = s;
  }
  return step;
}

function nextCadenceStep(sentDays: number | null) {
  if (sentDays == null) return null;
  return FOLLOWUP_CADENCE.find((s) => s.atDay > sentDays) || null;
}

function DealCard({ deal, company, onEdit, onDelete, onChangeStage, onSetFollowUpDate, onSetPagamento }: Props & { deal: Deal }) {
  const { alertDialog, confirmDialog } = useDialog();
  const isDecided = deal.stage === "fechado" || deal.stage === "perdido";
  const [presenting, setPresenting] = useState(false);
  // Feedback do botão "PDF": sem isso, clicar não dava nenhum sinal de que algo aconteceu
  // (gerar o PDF é assíncrono e silencioso por padrão).
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done">("idle");
  // Recolhido por padrão pra todo mundo -- com muitas propostas na coluna, deixar tudo aberto
  // vira uma parede de campos. As pílulas de status ficam sempre visíveis (é a ação mais usada),
  // o resto (follow-up, pagamento, mensagem) só aparece ao expandir.
  const [expanded, setExpanded] = useState(false);
  const [templateId, setTemplateId] = useState(
    () => cadenceStepFor(daysSince(deal.sentAt))?.templateId || MESSAGE_TEMPLATES[0].id,
  );
  const template = MESSAGE_TEMPLATES.find((t) => t.id === templateId) || MESSAGE_TEMPLATES[0];
  const companyName = company.companyName || "";
  const message = template.build(deal, companyName, num(deal.valorFinal));
  const followUpId = useId();
  const templateSelectId = useId();
  const formaPagamentoId = useId();
  const valorPagoId = useId();
  const parcelasId = useId();

  const valorFinalNum = num(deal.valorFinal);
  const valorPagoNum = Math.min(num(deal.valorPago), valorFinalNum || num(deal.valorPago));
  const paymentStatus = valorFinalNum > 0 && valorPagoNum >= valorFinalNum ? "paid" : valorPagoNum > 0 ? "partial" : "unpaid";
  const paymentLabel = paymentStatus === "paid" ? "Pago" : paymentStatus === "partial" ? "Parcial" : "A receber";
  const paymentPct = valorFinalNum > 0 ? Math.min(100, (valorPagoNum / valorFinalNum) * 100) : 0;

  const isInstallment = INSTALLMENT_METHODS.has(deal.formaPagamento);
  const parcelasNum = Math.max(0, Math.floor(num(deal.parcelas)));
  const valorPorParcela = parcelasNum > 1 && valorFinalNum > 0 ? roundCents(valorFinalNum / parcelasNum) : 0;

  // WhatsApp e e-mail não deixam anexar arquivo por link (limitação da própria plataforma,
  // não dá pra contornar via navegador) — então a gente baixa o PDF automaticamente e já
  // abre a mensagem pronta; falta só anexar o arquivo baixado na hora de enviar.
  async function sendWhatsApp() {
    if (!deal.clientePhone) {
      await alertDialog("Cadastre o WhatsApp do cliente no orçamento primeiro.");
      return;
    }
    await downloadClientPdf(deal, company, deal.obraNumero || 1);
    window.open(buildWhatsAppShareLink(deal.clientePhone, `${message}\n\n(vou te mandar o PDF em seguida)`), "_blank");
  }

  async function sendEmail() {
    if (!deal.clienteEmail) {
      await alertDialog("Cadastre o e-mail do cliente no orçamento primeiro.");
      return;
    }
    await downloadClientPdf(deal, company, deal.obraNumero || 1);
    const subject = encodeURIComponent(`Orçamento — ${companyName}`);
    const body = encodeURIComponent(message + "\n\n(PDF baixado — anexe antes de enviar)");
    window.location.href = `mailto:${deal.clienteEmail}?subject=${subject}&body=${body}`;
  }

  async function handleDownloadPdf() {
    setPdfState("loading");
    try {
      await downloadClientPdf(deal, company, deal.obraNumero || 1);
      setPdfState("done");
      setTimeout(() => setPdfState("idle"), 2000);
    } catch (err) {
      console.error("Falha ao gerar PDF", err);
      setPdfState("idle");
      await alertDialog("Não foi possível gerar o PDF. Tente de novo.");
    }
  }

  const sentDays = daysSince(deal.sentAt);
  const cadenceStep = deal.stage === "aguardando" ? cadenceStepFor(sentDays) : null;
  const nextStep = deal.stage === "aguardando" ? nextCadenceStep(sentDays) : null;
  const stageLabel = STAGES.find((s) => s.id === deal.stage)?.label || deal.stage;
  const placeLabel = deal.obraNome || deal.endereco || "";

  // Avança a data de follow-up pra próxima etapa da cadência (dia 2 -> dia 4 -> dia 5), contada a
  // partir do envio original -- não de hoje, senão duas pessoas marcando "já fiz" em dias
  // diferentes iam acabar com datas diferentes pro mesmo cliente sem motivo.
  function handleAdvanceCadence() {
    if (!nextStep || !deal.sentAt) return;
    const next = new Date(deal.sentAt);
    next.setDate(next.getDate() + nextStep.atDay);
    onSetFollowUpDate(deal, next.toISOString().slice(0, 10));
    setTemplateId(nextStep.templateId);
  }

  // Quem fecha a venda escolhe a forma de pagamento, mas quase nunca digita o valor recebido --
  // pra formas pagas à vista, já cravamos o valor total automaticamente (dá pra corrigir depois).
  function handleFormaPagamentoChange(value: string) {
    const patch: Partial<Pick<Deal, "formaPagamento" | "valorPago" | "parcelas">> = { formaPagamento: value };
    if (AUTO_FULL_PAYMENT_METHODS.has(value) && valorFinalNum > 0) {
      patch.valorPago = String(valorFinalNum);
    }
    // Trocar de forma de pagamento zera o "em quantas vezes" de uma escolha anterior -- senão o
    // parcelamento de um método antigo (ex: Cartão de crédito em 6x) ficava escondido, mas ainda
    // valendo, se a pessoa mudasse pra Pix e voltasse pra Cartão de crédito depois.
    if (!INSTALLMENT_METHODS.has(value)) {
      patch.parcelas = "";
    }
    onSetPagamento(deal, patch);
  }

  // "Cartão de crédito" começa marcado como recebido à vista (ver handleFormaPagamentoChange) --
  // mas se virar parcelado de verdade (mais de 1x), o dinheiro passa a cair aos poucos, não tudo
  // de uma vez. Só zera o valor recebido se ele ainda estiver "intocado" no valor cheio do
  // preenchimento automático -- se a pessoa já tiver ajustado manualmente, respeita o que ela pôs.
  function handleParcelasChange(value: string) {
    const patch: Partial<Pick<Deal, "parcelas" | "valorPago">> = { parcelas: value };
    const n = Math.floor(num(value));
    if (n > 1 && valorFinalNum > 0 && valorPagoNum === valorFinalNum) {
      patch.valorPago = "0";
    }
    onSetPagamento(deal, patch);
  }

  function handleAddParcelaRecebida() {
    const next = Math.min(valorFinalNum, roundCents(valorPagoNum + valorPorParcela));
    onSetPagamento(deal, { valorPago: String(next) });
  }

  // "Fechado" e "Perdido" são decisões com peso (entram nos relatórios, "Fechado" libera o
  // registro de pagamento) -- um toque sem querer numa pílula não pode virar isso sozinho, então
  // pedimos confirmação só nessas duas, sem travar as trocas mais leves ("Em aberto"/"Aguardando").
  async function handleStageClick(stageId: string) {
    if (stageId === deal.stage) return;
    if (stageId === "fechado" || stageId === "perdido") {
      const label = STAGES.find((s) => s.id === stageId)?.label || stageId;
      const nome = deal.clientName || "cliente sem nome";
      const ok = await confirmDialog(
        stageId === "fechado"
          ? `Marcar a proposta de ${nome} como Fechado? Ela passa a contar como venda concluída nos relatórios.`
          : `Marcar a proposta de ${nome} como Perdido?`,
        { title: `Mudar status para "${label}"`, confirmLabel: "Confirmar", cancelLabel: "Cancelar", tone: stageId === "perdido" ? "danger" : "default" },
      );
      if (!ok) return;
    }
    onChangeStage(deal, stageId);
  }

  const initial = (deal.clientName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className={`deal-card${isDecided ? " compact" : ""}`}>
      <div className="deal-card-top">
        <div className="deal-name-row">
          <span className="deal-avatar" aria-hidden="true">
            {initial}
          </span>
          <button type="button" className="deal-name" title={deal.clientName || "Sem nome"} onClick={() => onEdit(deal)}>
            {deal.clientName || "Sem nome"}
          </button>
        </div>
        <span className="deal-value">{formatBRL(deal.valorFinal)}</span>
      </div>
      {deal.stage === "aguardando" && sentDays !== null && <p className="deal-meta">Enviada há {sentDays} dia(s)</p>}
      {cadenceStep && <p className="deal-meta cadence-hint">📅 {cadenceStep.hint}</p>}
      {placeLabel && <p className="deal-meta">{placeLabel}</p>}

      {deal.stage === "fechado" && (
        <div className="payment-summary">
          <div className="payment-summary-top">
            <span className={`payment-badge ${paymentStatus}`}>{paymentLabel}</span>
            <span className="payment-summary-amount">
              {formatBRL(valorPagoNum)} / {formatBRL(valorFinalNum)}
            </span>
          </div>
          <div className="payment-progress-track">
            <div className={`payment-progress-fill ${paymentStatus}`} style={{ width: `${paymentPct}%` }} />
          </div>
          {deal.formaPagamento && (
            <p className="payment-summary-method">
              <span className="payment-summary-method-icon">{PAYMENT_METHOD_ICONS[deal.formaPagamento]}</span>
              {deal.formaPagamento}
              {isInstallment && parcelasNum > 1 ? ` em ${parcelasNum}x` : ""}
            </p>
          )}
        </div>
      )}

      <div
        className="stage-pills"
        role="group"
        aria-label={`Status da proposta de ${deal.clientName || "cliente sem nome"}: ${stageLabel}`}
      >
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`stage-pill${deal.stage === s.id ? " active" : ""}`}
            aria-pressed={deal.stage === s.id}
            onClick={() => handleStageClick(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button type="button" className="link-btn" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "Recolher ▲" : "Ver detalhes ▾"}
      </button>

      {expanded && (
        <>
          {!isDecided && (
            <div className="field" style={{ marginBottom: 0, marginTop: 10 }}>
              <label htmlFor={followUpId} className="microlabel">
                Próximo follow-up
              </label>
              <input
                id={followUpId}
                className="input"
                type="date"
                value={deal.followUpDate || ""}
                onChange={(e) => onSetFollowUpDate(deal, e.target.value)}
              />
              {nextStep && (
                <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={handleAdvanceCadence}>
                  já fiz esse contato → agendar {nextStep.hint.toLowerCase()}
                </button>
              )}
            </div>
          )}

          {deal.stage === "fechado" && (
            <div className="cost-group payment-panel" style={{ marginTop: 10 }}>
              <div className="cost-group-icon" style={{ background: "var(--cat-3)" }}>
                <CreditCardIcon />
              </div>
              <p className="cost-group-title" id={formaPagamentoId}>
                Como foi pago?
              </p>

              <div className="payment-method-grid" role="radiogroup" aria-labelledby={formaPagamentoId}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={deal.formaPagamento === f}
                    className={`payment-method-btn${deal.formaPagamento === f ? " selected" : ""}`}
                    onClick={() => handleFormaPagamentoChange(f)}
                  >
                    <span className="payment-method-icon">{PAYMENT_METHOD_ICONS[f]}</span>
                    <span className="payment-method-label">{f}</span>
                  </button>
                ))}
              </div>

              {isInstallment && (
                <div className="installment-box">
                  {deal.formaPagamento === "Parcelado" && (
                    <p className="microlabel" style={{ marginTop: 0, marginBottom: 8 }}>
                      Use isso quando o parcelamento é combinado direto com o cliente, fora do cartão (ex: carnê, boleto em partes). Se ele pagou
                      no cartão, mesmo que em várias vezes, escolha <strong>Cartão de crédito</strong> ali em cima.
                    </p>
                  )}
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor={parcelasId}>Em quantas vezes?</label>
                    <input
                      id={parcelasId}
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="Ex: 12"
                      value={deal.parcelas || ""}
                      onChange={(e) => handleParcelasChange(e.target.value)}
                    />
                  </div>
                  {parcelasNum > 1 && valorFinalNum > 0 && (
                    <p className="microlabel" style={{ marginTop: 6, marginBottom: 0 }}>
                      {parcelasNum}x de <strong>{formatBRL(valorPorParcela)}</strong>
                    </p>
                  )}
                </div>
              )}

              {!isInstallment && deal.formaPagamento === "Boleto" && (
                <p className="microlabel" style={{ marginBottom: 10 }}>
                  Boleto pode levar alguns dias pra compensar — volte aqui pra marcar quando o dinheiro cair.
                </p>
              )}

              {!isInstallment &&
                AUTO_FULL_PAYMENT_METHODS.has(deal.formaPagamento) &&
                paymentStatus === "paid" && (
                  <p className="microlabel" style={{ marginBottom: 10 }}>
                    Já marcamos como recebido na hora — ajuste abaixo se for diferente.
                  </p>
                )}

              <div className="field payment-value-field">
                <label htmlFor={valorPagoId}>Valor recebido</label>
                <div className="currency-input">
                  <span className="currency-prefix">R$</span>
                  <input
                    id={valorPagoId}
                    className="input currency-input-field"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={cleanValorPagoDisplay(deal.valorPago)}
                    onChange={(e) => onSetPagamento(deal, { valorPago: e.target.value })}
                  />
                </div>
              </div>

              {valorFinalNum > 0 && (
                <div className="payment-quick-actions">
                  {isInstallment && parcelasNum > 1 && paymentStatus !== "paid" && (
                    <button type="button" className="quick-chip" onClick={handleAddParcelaRecebida}>
                      + 1 parcela recebida
                    </button>
                  )}
                  <button
                    type="button"
                    className={`quick-chip${paymentStatus === "paid" ? " active" : ""}`}
                    onClick={() => onSetPagamento(deal, { valorPago: String(valorFinalNum) })}
                  >
                    Recebi tudo
                  </button>
                  <button
                    type="button"
                    className="quick-chip"
                    onClick={() => onSetPagamento(deal, { valorPago: (valorFinalNum / 2).toFixed(2) })}
                  >
                    Recebi metade
                  </button>
                  <button
                    type="button"
                    className={`quick-chip${paymentStatus === "unpaid" ? " active" : ""}`}
                    onClick={() => onSetPagamento(deal, { valorPago: "0" })}
                  >
                    Nada ainda
                  </button>
                </div>
              )}
              {paymentStatus === "partial" && (
                <p className="microlabel" style={{ marginTop: 8, marginBottom: 0 }}>
                  Falta receber: <strong>{formatBRL(valorFinalNum - valorPagoNum)}</strong>
                </p>
              )}
            </div>
          )}

          <div className="deal-card-section">
            <label htmlFor={templateSelectId} className="microlabel">
              Mensagem
            </label>
            <select id={templateSelectId} className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {MESSAGE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            <div className="deal-actions">
              <button type="button" className="icon-action-btn primary" onClick={() => setPresenting(true)}>
                Apresentar
              </button>
              <button type="button" className="icon-action-btn" onClick={sendWhatsApp}>
                WhatsApp
              </button>
              <button type="button" className="icon-action-btn" onClick={sendEmail}>
                E-mail
              </button>
              <button type="button" className="icon-action-btn" onClick={handleDownloadPdf} disabled={pdfState === "loading"}>
                {pdfState === "loading" ? "Gerando..." : pdfState === "done" ? "✓ Baixado" : "PDF"}
              </button>
              <button
                type="button"
                className="icon-action-btn danger"
                onClick={() => onDelete(deal.id!)}
                aria-label={`Excluir proposta de ${deal.clientName || "cliente sem nome"}`}
              >
                Excluir
              </button>
            </div>
          </div>
        </>
      )}

      {presenting && (
        <PresentationView
          deal={deal}
          companyName={companyName}
          logoUrl={company.logoUrl}
          anosExperiencia={company.anosExperiencia}
          obrasEntregues={company.obrasEntregues}
          onClose={() => setPresenting(false)}
        />
      )}
    </div>
  );
}

export function AlertsPanel({ deals }: { deals: Deal[] }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const pending = useMemo(
    () => deals.filter((d) => d.stage === "aguardando" && d.followUpDate && d.followUpDate <= todayStr),
    [deals, todayStr],
  );

  if (pending.length === 0) return null;

  return (
    <div className="panel" role="status" style={{ marginBottom: 16, borderColor: "var(--red-400)" }}>
      <h2 className="panel-title">Hoje você precisa falar com {pending.length} cliente(s)</h2>
      {pending.map((d) => {
        const days = daysSince(d.sentAt);
        return (
          <p key={d.id}>
            <strong>{d.clientName}</strong>
            {days !== null ? ` — recebeu a proposta há ${days} dia(s)` : ""}
          </p>
        );
      })}
    </div>
  );
}

// Ordena cada coluna pelo que é mais relevante olhar primeiro -- em "aguardando", quem tem
// follow-up mais próximo (ou já vencido) sobe pro topo; nas outras colunas, a mais recente
// primeiro. Sem isso, com muitas propostas a ordem fica arbitrária (a do banco) e a pessoa
// tem que ler a coluna inteira pra achar o que precisa de atenção agora.
function sortDeals(items: Deal[], stageId: string): Deal[] {
  const sorted = [...items];
  if (stageId === "aguardando") {
    sorted.sort((a, b) => (a.followUpDate || "9999-99-99").localeCompare(b.followUpDate || "9999-99-99"));
  } else {
    sorted.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  return sorted;
}

export default function ProposalsBoard(props: Props) {
  const { deals } = props;
  const [search, setSearch] = useState("");

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) =>
      [d.clientName, d.obraNome, d.endereco].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [deals, search]);

  return (
    <div>
      <AlertsPanel deals={deals} />

      <div className="funil-search">
        <input
          className="input"
          type="search"
          placeholder="Buscar por cliente, obra ou endereço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar propostas"
        />
        {search && (
          <span className="microlabel">
            {filteredDeals.length} de {deals.length} propostas
          </span>
        )}
      </div>

      <div className="funil-grid">
        {STAGES.map((stage) => {
          const items = sortDeals(
            filteredDeals.filter((d) => d.stage === stage.id),
            stage.id,
          );
          const totalValue = items.reduce((s, d) => s + num(d.valorFinal), 0);
          const meta = STAGE_META[stage.id];
          return (
            <section
              className="funil-col"
              key={stage.id}
              aria-label={`Coluna ${stage.label}`}
              style={{ borderTopColor: meta.color, ["--col-color" as string]: meta.color }}
            >
              <div className="funil-col-head">
                <div className="funil-col-icon" style={{ background: meta.color }}>
                  {meta.icon}
                </div>
                <span className="funil-col-title">
                  {stage.label}
                  <span className="microlabel" style={{ display: "block" }}>
                    {formatBRL(totalValue)}
                  </span>
                </span>
                <span className="funil-count">{items.length}</span>
              </div>
              <div className="funil-col-body">
                {items.map((deal) => (
                  <DealCard key={deal.id} deal={deal} {...props} />
                ))}
                {items.length === 0 && (
                  <p className="microlabel">{search ? "Nada encontrado nessa coluna." : "Nenhuma proposta."}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
