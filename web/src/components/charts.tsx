import type { ReactNode } from "react";
import { formatBRL } from "../lib/calc";

export function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {hint && (
        <p className="microlabel" style={{ marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function CircleChart({
  data,
  hole = 0,
  formatValue = (v: number) => String(v),
}: {
  data: { label: string; value: number; color: string }[];
  hole?: number;
  formatValue?: (v: number) => string;
}) {
  const size = 150;
  const r = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  const visible = data.filter((d) => d.value > 0);

  if (total === 0) return <p className="chart-empty">Sem dados ainda.</p>;

  // Uma unica fatia com 100% vira um circulo cheio -- um arco de 360 graus degenera
  // (ponto inicial == ponto final) e o SVG nao desenha nada.
  const isSingleSlice = visible.length === 1;

  const toXY = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180;
    return [r + r * Math.cos(rad), r + r * Math.sin(rad)];
  };
  const slices = visible.reduce<Array<(typeof visible)[number] & { frac: number; end: number; path: string }>>((acc, d) => {
    const start = acc.length ? acc[acc.length - 1].end : -90;
    const frac = d.value / total;
    const end = start + frac * 360;
    const largeArc = end - start > 180 ? 1 : 0;
    const [x1, y1] = toXY(start);
    const [x2, y2] = toXY(end);
    acc.push({ ...d, frac, end, path: `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z` });
    return acc;
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Gráfico de distribuição">
        {isSingleSlice ? (
          <circle cx={r} cy={r} r={r} fill={slices[0].color} />
        ) : (
          slices.map((s) => <path key={s.label} d={s.path} fill={s.color} stroke="var(--n-900-40)" strokeWidth={2} />)
        )}
        {hole > 0 && <circle cx={r} cy={r} r={r * hole} fill="var(--n-900-40)" />}
      </svg>
      <div className="legend" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        {slices.map((s) => (
          <span className="legend-item" key={s.label}>
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label} — {formatValue(s.value)} ({(s.frac * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const width = 640;
  const height = 170;
  const pad = { top: 20, right: 16, bottom: 22, left: 16 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({ ...p, x: pad.left + i * stepX, y: pad.top + innerH - (p.value / max) * innerH }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? 0} ${pad.top + innerH} L ${coords[0]?.x ?? 0} ${pad.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Faturamento nos últimos meses">
      <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke="var(--n-800)" strokeWidth={1} />
      {coords.length > 1 && <path d={areaPath} fill="var(--amber-400)" opacity={0.1} />}
      {coords.length > 1 && <path d={linePath} fill="none" stroke="var(--amber-400)" strokeWidth={2} />}
      {coords.map((c) => (
        <g key={c.label}>
          <circle cx={c.x} cy={c.y} r={4} fill="var(--amber-400)" stroke="var(--n-900-40)" strokeWidth={1.5} />
          <text x={c.x} y={height - 6} textAnchor="middle" fontSize={9} fill="var(--n-500)">
            {c.label}
          </text>
          <text x={c.x} y={c.y - 9} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--n-300)">
            {formatBRL(c.value).replace("R$", "").trim()}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function BarRow({ label, metric, max, color, display }: { label: string; metric: number; max: number; color: string; display: string }) {
  const pct = max > 0 ? Math.max((metric / max) * 100, metric > 0 ? 3 : 0) : 0;
  return (
    <div className="funnel-row">
      <span className="funnel-row-label" title={label}>
        {label}
      </span>
      <div className="funnel-row-track">
        <div className="funnel-row-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="funnel-row-value">{display}</span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "brand" | "good" | "warn";
  progress?: number;
}) {
  return (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-head">
        {icon && <span className="kpi-icon">{icon}</span>}
        <span className="kpi-label">{label}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      {progress != null && (
        <div className="kpi-progress" aria-hidden="true">
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

function compactBRL(v: number) {
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return Math.round(v).toLocaleString("pt-BR");
}

// Faturamento por mês: colunas (comparar meses lado a lado é mais fácil que ler uma linha).
export function ColumnChart({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const last = points.length - 1;
  return (
    <div className="column-chart" role="img" aria-label={points.map((p) => `${p.label}: ${formatBRL(p.value)}`).join("; ")}>
      {points.map((p, i) => (
        <div className="column-chart-col" key={p.label}>
          <span className="column-chart-value">
            <span className="cc-long">{p.value > 0 ? formatBRL(p.value).replace(",00", "") : "—"}</span>
            <span className="cc-short">{p.value > 0 ? compactBRL(p.value) : "—"}</span>
          </span>
          <div className="column-chart-track">
            <div
              className={`column-chart-bar${i === last ? " current" : ""}`}
              style={{ height: `${Math.max(p.value > 0 ? 4 : 0, (p.value / max) * 100)}%` }}
            />
          </div>
          <span className="column-chart-label">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
