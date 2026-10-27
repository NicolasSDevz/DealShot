import { useMemo, useState } from "react";
import { formatBRL, num, isThisMonth, calcDeal, roundCents, STAGES, type Deal } from "../lib/calc";
import { BarRow, KpiCard, ColumnChart } from "./charts";
import { TrendingUpIcon, WalletIcon, BanknoteIcon, SendIcon } from "./Icons";

const CAT_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];

const STAGE_COLORS: Record<string, string> = {
  aberto: "var(--n-600)",
  aguardando: "var(--amber-400)",
  fechado: "var(--emerald-400)",
  perdido: "var(--red-400)",
};

export default function SalesOverview({ deals }: { deals: Deal[] }) {
  const [period, setPeriod] = useState<"mes" | "tudo">("mes");
  const base = useMemo(() => (period === "mes" ? deals.filter((d) => isThisMonth(d.createdAt)) : deals), [deals, period]);

  const porStage = STAGES.map((s) => {
    const items = base.filter((d) => d.stage === s.id);
    return { ...s, count: items.length, value: items.reduce((sum, d) => sum + num(d.valorFinal), 0) };
  });
  const maxStageCount = Math.max(1, ...porStage.map((s) => s.count));

  const enviadas = base.filter((d) => ["aguardando", "fechado", "perdido"].includes(d.stage));
  const fechados = base.filter((d) => d.stage === "fechado");
  const perdidos = base.filter((d) => d.stage === "perdido");
  const aguardando = base.filter((d) => d.stage === "aguardando");

  const valorVendido = roundCents(fechados.reduce((s, d) => s + num(d.valorFinal), 0));
  const valorPerdido = roundCents(perdidos.reduce((s, d) => s + num(d.valorFinal), 0));
  const valorEmAberto = roundCents(aguardando.reduce((s, d) => s + num(d.valorFinal), 0));

  const decididas = fechados.length + perdidos.length;
  const taxaConversao = decididas > 0 ? (fechados.length / decididas) * 100 : 0;
  const ticketMedio = fechados.length > 0 ? roundCents(valorVendido / fechados.length) : 0;

  const valorPago = roundCents(fechados.reduce((s, d) => s + Math.min(num(d.valorPago), num(d.valorFinal)), 0));
  const valorNaoPago = roundCents(valorVendido - valorPago);
  const pagoPct = valorVendido > 0 ? (valorPago / valorVendido) * 100 : 0;

  const custosOperacionais = roundCents(fechados.reduce((s, d) => s + calcDeal(d).custosOperacionais, 0));
  const saldo = roundCents(valorVendido - custosOperacionais);

  const porCliente = useMemo(() => {
    const map = new Map<string, number>();
    fechados.forEach((d) => {
      const name = d.clientName || "Sem nome";
      map.set(name, (map.get(name) || 0) + num(d.valorFinal));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);
  const maxCliente = Math.max(1, ...porCliente.map(([, v]) => v));

  const porLeadSource = useMemo(() => {
    const map = new Map<string, number>();
    base.forEach((d) => {
      const key = d.leadSource || "Outro";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [base]);

  const porFormaPagamento = useMemo(() => {
    const map = new Map<string, number>();
    fechados.forEach((d) => {
      const key = d.formaPagamento || "Não informado";
      map.set(key, (map.get(key) || 0) + num(d.valorFinal));
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: CAT_COLORS[i % CAT_COLORS.length] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechados]);

  const faturamentoMensal = useMemo(() => {
    const now = new Date();
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const total = deals
        .filter((d) => d.stage === "fechado" && d.closedAt)
        .filter((d) => {
          const c = new Date(d.closedAt!);
          return c.getFullYear() === ref.getFullYear() && c.getMonth() === ref.getMonth();
        })
        .reduce((s, d) => s + num(d.valorFinal), 0);
      months.push({ label, value: total });
    }
    return months;
  }, [deals]);

  const fmtPct = (v: number) => `${v.toFixed(0)}%`;
  const margemSaldo = valorVendido > 0 ? (saldo / valorVendido) * 100 : 0;
  const maxLead = Math.max(1, ...porLeadSource.map((l) => l.value));
  const maxForma = Math.max(1, ...porFormaPagamento.map((f) => f.value));

  return (
    <div className="results">
      <div className="results-toolbar">
        <div className="segmented" role="group" aria-label="Período">
          <button type="button" aria-pressed={period === "mes"} className={period === "mes" ? "active" : ""} onClick={() => setPeriod("mes")}>
            Este mês
          </button>
          <button type="button" aria-pressed={period === "tudo"} className={period === "tudo" ? "active" : ""} onClick={() => setPeriod("tudo")}>
            Todo o período
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          tone="brand"
          icon={<TrendingUpIcon />}
          label="Faturado"
          value={formatBRL(valorVendido)}
          hint={`${fechados.length} ${fechados.length === 1 ? "serviço fechado" : "serviços fechados"}`}
        />
        <KpiCard
          tone="good"
          icon={<WalletIcon />}
          label="Lucro (saldo)"
          value={formatBRL(saldo)}
          hint={valorVendido > 0 ? `${fmtPct(margemSaldo)} do faturado. Custos: ${formatBRL(custosOperacionais)}` : "Faturado menos os custos"}
        />
        <KpiCard
          tone="warn"
          icon={<BanknoteIcon />}
          label="A receber"
          value={formatBRL(valorNaoPago)}
          progress={fechados.length ? pagoPct : undefined}
          hint={fechados.length ? `${formatBRL(valorPago)} já recebido (${fmtPct(pagoPct)})` : "Nenhum fechado ainda"}
        />
        <KpiCard
          icon={<SendIcon />}
          label="Em negociação"
          value={formatBRL(valorEmAberto)}
          hint={`${aguardando.length} ${aguardando.length === 1 ? "proposta aguardando" : "propostas aguardando"} resposta`}
        />
      </div>

      <div className="stat-strip">
        <div>
          <span>Orçamentos</span>
          <strong>{base.length}</strong>
        </div>
        <div>
          <span>Enviados</span>
          <strong>{enviadas.length}</strong>
        </div>
        <div>
          <span>Fechados</span>
          <strong>{fechados.length}</strong>
        </div>
        <div>
          <span>Perdidos</span>
          <strong>{perdidos.length}</strong>
          {valorPerdido > 0 && <small>{formatBRL(valorPerdido)}</small>}
        </div>
        <div>
          <span>Taxa de conversão</span>
          <strong>{fmtPct(taxaConversao)}</strong>
          <small>fechados ÷ decididos</small>
        </div>
        <div>
          <span>Venda média</span>
          <strong>{formatBRL(ticketMedio)}</strong>
        </div>
      </div>

      <div className="results-grid">
        <section className="chart-card span-2">
          <h2 className="chart-title">Faturamento nos últimos 6 meses</h2>
          <ColumnChart points={faturamentoMensal} />
        </section>

        <section className="chart-card">
          <h2 className="chart-title">Funil de vendas</h2>
          <div className="funnel">
            {porStage.map((s) => (
              <BarRow key={s.id} label={s.label} metric={s.count} max={maxStageCount} color={STAGE_COLORS[s.id]} display={`${s.count} · ${formatBRL(s.value)}`} />
            ))}
          </div>
        </section>

        <section className="chart-card">
          <h2 className="chart-title">De onde vêm os clientes</h2>
          {porLeadSource.length === 0 ? (
            <p className="chart-empty">Sem orçamentos no período.</p>
          ) : (
            <div className="funnel">
              {porLeadSource.map((l) => (
                <BarRow key={l.label} label={l.label} metric={l.value} max={maxLead} color="var(--cat-1)" display={`${l.value} (${fmtPct((l.value / base.length) * 100)})`} />
              ))}
            </div>
          )}
        </section>

        <section className="chart-card">
          <h2 className="chart-title">Formas de pagamento</h2>
          {porFormaPagamento.length === 0 ? (
            <p className="chart-empty">Nenhum fechado ainda.</p>
          ) : (
            <div className="funnel">
              {porFormaPagamento.map((f) => (
                <BarRow key={f.label} label={f.label} metric={f.value} max={maxForma} color="var(--cat-3)" display={formatBRL(f.value)} />
              ))}
            </div>
          )}
        </section>

        <section className="chart-card">
          <h2 className="chart-title">Maiores clientes</h2>
          {porCliente.length === 0 ? (
            <p className="chart-empty">Nenhuma venda fechada ainda.</p>
          ) : (
            <div className="funnel">
              {porCliente.map(([name, value]) => (
                <BarRow key={name} label={name} metric={value} max={maxCliente} color="var(--amber-400)" display={formatBRL(value)} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
