import { calcDeal, formatBRL, MARGEM_MINIMA_SAUDAVEL } from "../lib/calc";

type Calc = ReturnType<typeof calcDeal>;

// Faixas da margem real: abaixo do mínimo (30%) é risco de prejuízo; entre 30% e 40% dá pra
// trabalhar, mas sobra pouco pra imprevisto; acima disso é saudável.
const MARGEM_BOA = 0.4;
// Escala do medidor: 60% de margem já enche a barra (acima disso é raro e não muda a leitura).
const METER_MAX = 0.6;

function marginTone(m: number) {
  if (m < MARGEM_MINIMA_SAUDAVEL) return { tone: "bad", note: `Abaixo do mínimo de ${MARGEM_MINIMA_SAUDAVEL * 100}%. Risco de prejuízo.` };
  if (m < MARGEM_BOA) return { tone: "warn", note: "Dá para trabalhar, mas sobra pouco para imprevistos." };
  return { tone: "good", note: "Margem saudável." };
}

export default function QuoteSummary({ calc, metragem }: { calc: Calc; metragem: number }) {
  const price = calc.valorFinal;
  const hasPrice = price > 0;
  const { tone, note } = marginTone(calc.margemReal);
  const marginPct = calc.margemReal * 100;

  // Para onde vai cada real do preço -- soma os grupos que a pessoa reconhece (equipe,
  // transporte...) em vez de mostrar as 15 linhas do cálculo.
  const parts = [
    { key: "equipe", label: "Equipe e pró-labore", value: calc.maoDeObraTotal + calc.encargosTotal + calc.proLaboreTotal, color: "var(--cat-1)" },
    { key: "apoio", label: "Transporte e alimentação", value: calc.apoioTotal, color: "var(--cat-3)" },
    { key: "materiais", label: "Materiais e produtos", value: calc.materiaisTotal, color: "var(--cat-5)" },
    {
      key: "fixos",
      label: "Visita e custos fixos",
      value: calc.custosAntesDaGordura - (calc.maoDeObraTotal + calc.encargosTotal + calc.proLaboreTotal + calc.apoioTotal + calc.materiaisTotal),
      color: "var(--cat-4)",
    },
    { key: "gordura", label: "Gordura de segurança", value: calc.gorduraValor, color: "var(--n-600)" },
    { key: "imposto", label: "Imposto", value: calc.impostoTotal, color: "var(--cat-2)" },
    { key: "lucro", label: "Lucro da empresa", value: calc.lucroRS, color: "var(--emerald-400)" },
  ].filter((p) => p.value > 0.004);

  const total = parts.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <>
    {/* Celular/tablet: o resumo fica lá embaixo da página, então o preço vai junto numa barra fixa. */}
    <button
      type="button"
      className={`qs-mobile-bar ${hasPrice ? tone : ""}`}
      onClick={() => document.getElementById("resumo-orcamento")?.scrollIntoView({ behavior: "smooth", block: "start" })}
    >
      <span className="qs-mobile-label">Preço sugerido</span>
      <strong>{formatBRL(price)}</strong>
      {hasPrice && <span className="qs-mobile-margin">Margem {marginPct.toFixed(0)}%</span>}
    </button>
    <aside className="quote-summary" id="resumo-orcamento" aria-label="Resumo do orçamento">
      <div className="qs-price-card">
        <span className="qs-kicker">Preço sugerido</span>
        <strong className="qs-price" aria-live="polite">
          {formatBRL(price)}
        </strong>
        {hasPrice && metragem > 0 && <span className="qs-sub">{formatBRL(price / metragem)} por m²</span>}

        {hasPrice ? (
          <div className={`qs-margin ${tone}`}>
            <div className="qs-margin-head">
              <span>Margem real</span>
              <strong>{marginPct.toFixed(1).replace(".", ",")}%</strong>
            </div>
            <div
              className="qs-meter"
              role="meter"
              aria-label="Margem real"
              aria-valuemin={0}
              aria-valuemax={METER_MAX * 100}
              aria-valuenow={Math.round(marginPct)}
            >
              <div className="qs-meter-fill" style={{ width: `${Math.max(0, Math.min(100, (calc.margemReal / METER_MAX) * 100))}%` }} />
              <span className="qs-meter-mark" style={{ left: `${(MARGEM_MINIMA_SAUDAVEL / METER_MAX) * 100}%` }} title="Mínimo recomendado: 30%" />
            </div>
            <span className="qs-margin-note">{note}</span>
          </div>
        ) : (
          <p className="qs-empty">Preencha os dias de serviço e a equipe para ver o preço.</p>
        )}
      </div>

      {hasPrice && (
        <div className="qs-breakdown">
          <h2 className="qs-title">Para onde vai o dinheiro</h2>
          <div className="qs-stack" aria-hidden="true">
            {parts.map((p) => (
              <span key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
            ))}
          </div>
          <ul className="qs-list">
            {parts.map((p) => (
              <li key={p.key}>
                <span className="qs-dot" style={{ background: p.color }} aria-hidden="true" />
                <span className="qs-label">{p.label}</span>
                <span className="qs-value">{formatBRL(p.value)}</span>
                <span className="qs-pct">{Math.round((p.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
          <div className="qs-foot">
            <div>
              <span>Custo total</span>
              <strong>{formatBRL(calc.custosOperacionais)}</strong>
            </div>
            {metragem > 0 && (
              <div>
                <span>Custo por m²</span>
                <strong>{formatBRL(calc.custoPorM2)}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
