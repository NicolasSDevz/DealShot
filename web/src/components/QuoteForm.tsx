import { cloneElement, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactElement } from "react";
import {
  emptyDeal,
  emptyProduto,
  calcDeal,
  computeDataTermino,
  estimateProductCostByArea,
  formatBRL,
  formatDateBR,
  formatPhoneBR,
  num,
  ROLES,
  LEAD_SOURCES,
  CLIENT_TYPES,
  PAID_TRAFFIC_CHANNELS,
  PRODUTO_CATEGORIAS,
  MARGEM_MINIMA_SAUDAVEL,
  type Deal,
  type ProdutoItem,
} from "../lib/calc";
import { downloadClientPdf, downloadInternalPdf } from "../lib/pdf";
import PresentationView from "./PresentationView";
import type { CompanyProfile } from "../lib/db";
import { useDialog } from "../context/useDialog";
import {
  BuildingIcon,
  UsersIcon,
  CreditCardIcon,
  BoxIcon,
  PercentIcon,
  TruckIcon,
  CoffeeIcon,
  DropletIcon,
  ParkingIcon,
  TrashIcon,
  LightbulbIcon,
  AlertTriangleIcon,
} from "./Icons";

interface Props {
  initialDeal?: Deal | null;
  company: CompanyProfile;
  obraNumero: number;
  onSave: (deal: Deal) => Promise<void>;
  onCancelEdit?: () => void;
}

const STEPS = [
  { label: "Obra e cliente", icon: <BuildingIcon />, color: "var(--cat-1)" },
  { label: "Equipe", icon: <UsersIcon />, color: "var(--cat-2)" },
  { label: "Transporte e apoio", icon: <CreditCardIcon />, color: "var(--cat-3)" },
  { label: "Materiais e produtos", icon: <BoxIcon />, color: "var(--cat-5)" },
  { label: "Custos e margem", icon: <PercentIcon />, color: "var(--cat-6)" },
] as const;

const ROLE_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)"];

function field(label: string, input: ReactElement<{ id?: string }>, key: string, opts?: { wide?: boolean }) {
  const id = `qf-${key}`;
  return (
    <div className={`field${opts?.wide ? " field-wide" : ""}`} key={key}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(input, { id })}
    </div>
  );
}

interface AffixInputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
}

function AffixInput({ prefix, suffix, className, onFocus, ...rest }: AffixInputProps) {
  return (
    <div className="currency-input">
      {prefix && <span className="currency-prefix">{prefix}</span>}
      <input
        className={`input currency-input-field${className ? ` ${className}` : ""}`}
        // Seleciona tudo ao focar -- sem isso, digitar por cima de um "0" pré-existente sem
        // apagar antes gera "020" em vez de "20" (o cursor só entra antes do dígito).
        onFocus={(e) => {
          e.target.select();
          onFocus?.(e);
        }}
        {...rest}
      />
      {suffix && <span className="currency-suffix">{suffix}</span>}
    </div>
  );
}

function StepHeader({ index }: { index: number }) {
  const s = STEPS[index];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div className="cost-group-icon" style={{ background: s.color, marginBottom: 0 }}>
        {s.icon}
      </div>
      <p className="eyebrow" style={{ margin: 0 }}>
        {s.label}
      </p>
    </div>
  );
}

export default function QuoteForm({ initialDeal, company, obraNumero, onSave, onCancelEdit }: Props) {
  const { confirmDialog } = useDialog();
  const [deal, setDeal] = useState<Deal>(() => initialDeal || emptyDeal());
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState(false);

  // Calculadora auxiliar de rateio administrativo -- não faz parte do orçamento salvo, só ajuda
  // a chegar num valor pra colocar no campo "Custos fixos do escritório" abaixo.
  const [showRateioHelper, setShowRateioHelper] = useState(false);
  const [rateioAluguel, setRateioAluguel] = useState("");
  const [rateioContas, setRateioContas] = useState("");
  const [rateioContador, setRateioContador] = useState("");
  const [rateioOutros, setRateioOutros] = useState("");
  const [rateioServicosMes, setRateioServicosMes] = useState("");
  const rateioSugerido =
    (num(rateioAluguel) + num(rateioContas) + num(rateioContador) + num(rateioOutros)) / Math.max(1, num(rateioServicosMes));

  const calc = useMemo(() => calcDeal(deal), [deal]);
  const isEditing = !!deal.id;
  const lastStep = STEPS.length - 1;

  useEffect(() => {
    const termino = computeDataTermino(deal.dataInicio, deal.dias);
    if (termino !== deal.dataTermino) {
      setDeal((d) => ({ ...d, dataTermino: termino }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.dataInicio, deal.dias]);

  function set<K extends keyof Deal>(key: K, value: Deal[K]) {
    setDeal((d) => ({ ...d, [key]: value }));
  }

  function setRole(kind: "qtd" | "diaria", roleKey: string, value: string) {
    setDeal((d) => ({ ...d, [kind]: { ...d[kind], [roleKey]: value } }));
  }

  function addProduto() {
    setDeal((d) => ({ ...d, produtos: [...(d.produtos || []), emptyProduto()] }));
  }

  function setProduto(index: number, patch: Partial<ProdutoItem>) {
    setDeal((d) => ({
      ...d,
      produtos: (d.produtos || []).map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  function removeProduto(index: number) {
    setDeal((d) => ({ ...d, produtos: (d.produtos || []).filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!deal.clientName.trim()) {
      setSaveError(true);
      setSaveMsg("Preencha o nome do cliente.");
      setStep(0);
      return;
    }
    // Trava mínima pra não salvar um orçamento "vazio" (0 dias de serviço, ninguém na equipe) --
    // sem isso dava pra passar pelas 5 etapas sem preencher nada e o orçamento ia pra Propostas
    // com R$ 0,00, virando lixo no funil.
    if (num(deal.dias) <= 0) {
      setSaveError(true);
      setSaveMsg("Informe ao menos 1 dia de serviço.");
      setStep(0);
      return;
    }
    // Trava de margem: não impede de vez (às vezes a pessoa tem um motivo pra cobrar menos),
    // mas exige uma confirmação consciente em vez de deixar salvar de forma "acidental" um preço
    // que dá prejuízo.
    if (calc.margemAbaixoDoSaudavel) {
      const ok = await confirmDialog(
        `Esse preço deixa a margem em ${(calc.margemReal * 100).toFixed(1)}% — abaixo dos ${(MARGEM_MINIMA_SAUDAVEL * 100).toFixed(0)}% recomendados pra não trabalhar no prejuízo. Quer salvar assim mesmo?`,
        { title: "Margem baixa", confirmLabel: "Salvar assim mesmo", cancelLabel: "Voltar e ajustar", tone: "danger" },
      );
      if (!ok) {
        setStep(lastStep);
        return;
      }
    }
    setSaving(true);
    setSaveMsg("");
    try {
      await onSave({ ...deal, valorFinal: calc.valorFinal });
      setSaveError(false);
      setSaveMsg(isEditing ? "Alterações salvas!" : "Orçamento salvo em Propostas!");
      if (!isEditing) {
        setDeal(emptyDeal());
        setStep(0);
      }
    } catch (e) {
      console.error("Falha ao salvar orçamento", e);
      setSaveError(true);
      setSaveMsg("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadClientPdf() {
    await downloadClientPdf({ ...deal, valorFinal: calc.valorFinal }, company, deal.obraNumero || obraNumero);
  }

  async function handleDownloadInternalPdf() {
    await downloadInternalPdf({ ...deal, valorFinal: calc.valorFinal }, company, deal.obraNumero || obraNumero);
  }

  return (
    <>
      <div className="quote-grid">
      <div className="panel">
        <h2 className="panel-title">{isEditing ? "Editar orçamento" : "Novo orçamento"}</h2>

        <div className="wizard-steps" role="tablist" aria-label="Etapas do orçamento">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={step === i}
              className={`wizard-step${step === i ? " active" : ""}${i < step ? " done" : ""}`}
              onClick={() => setStep(i)}
            >
              <span className="wizard-step-num">{i < step ? "✓" : i + 1}</span>
              <span className="wizard-step-label">{s.label}</span>
            </button>
          ))}
        </div>

        {step === 0 && (
          <>
            <StepHeader index={0} />

            <div className="cost-group-grid">
              <div className="cost-group">
                <p className="cost-group-title">Cliente</p>
                <div className="cost-group-fields">
                  {field("Cliente", <input className="input" value={deal.clientName} title={deal.clientName} onChange={(e) => set("clientName", e.target.value)} required />, "clientName", { wide: true })}
                  {field(
                    "Tipo de imóvel",
                    <select className="input" value={deal.clientType} onChange={(e) => set("clientType", e.target.value)}>
                      {CLIENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>,
                    "clientType",
                  )}
                  {field("E-mail", <input className="input" type="email" title={deal.clienteEmail} value={deal.clienteEmail} onChange={(e) => set("clienteEmail", e.target.value)} />, "clienteEmail", { wide: true })}
                  {field(
                    "WhatsApp",
                    <input
                      className="input"
                      type="tel"
                      placeholder="Ex: (11) 9 8888-7777"
                      value={deal.clientePhone}
                      onChange={(e) => set("clientePhone", formatPhoneBR(e.target.value))}
                    />,
                    "clientePhone",
                  )}
                </div>
              </div>

              <div className="cost-group">
                <p className="cost-group-title">Obra e local</p>
                <div className="cost-group-fields">
                  {field("Nome da obra", <input className="input" value={deal.obraNome} title={deal.obraNome} onChange={(e) => set("obraNome", e.target.value)} />, "obraNome", { wide: true })}
                  {field("Endereço", <input className="input" value={deal.endereco} title={deal.endereco} onChange={(e) => set("endereco", e.target.value)} />, "endereco", { wide: true })}
                  {field("Responsável", <input className="input" value={deal.responsavel} title={deal.responsavel} onChange={(e) => set("responsavel", e.target.value)} />, "responsavel")}
                  {field("Metragem (m²)", <AffixInput type="number" suffix="m²" value={deal.metragem} onChange={(e) => set("metragem", e.target.value)} />, "metragem")}
                </div>
              </div>

              <div className="cost-group">
                <p className="cost-group-title">Origem do lead</p>
                <div className="cost-group-fields">
                  {field(
                    "Como chegou",
                    <select className="input" value={deal.leadSource} onChange={(e) => set("leadSource", e.target.value)}>
                      {LEAD_SOURCES.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>,
                    "leadSource",
                  )}
                  {deal.leadSource === "Tráfego pago" &&
                    field(
                      "Plataforma",
                      <select className="input" value={deal.leadSourcePaidChannel} onChange={(e) => set("leadSourcePaidChannel", e.target.value)}>
                        <option value="">Selecione</option>
                        {PAID_TRAFFIC_CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>,
                      "leadSourcePaidChannel",
                    )}
                </div>
              </div>

              <div className="cost-group">
                <p className="cost-group-title">Prazo</p>
                <div className="cost-group-fields">
                  {field("Dias de serviço", <input className="input" type="number" value={deal.dias} onChange={(e) => set("dias", e.target.value)} />, "dias")}
                  {field("Data de início", <input className="input" type="date" value={deal.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} />, "dataInicio")}
                  {field(
                    "Previsão de término",
                    <input className="input" value={deal.dataTermino ? formatDateBR(deal.dataTermino) : "Preencha início e dias"} disabled />,
                    "dataTermino",
                  )}
                  {field("Visita técnica", <input className="input" type="date" value={deal.dataVisitaTecnica} onChange={(e) => set("dataVisitaTecnica", e.target.value)} />, "dataVisitaTecnica")}
                </div>
              </div>
            </div>

            <div className="cost-group" style={{ marginTop: 14 }}>
              <p className="cost-group-title">Observações da vistoria</p>
              <textarea
                className="input"
                rows={3}
                style={{ resize: "vertical" }}
                placeholder="Ex: piso porcelanato polido, cimento aderido em toda a área, rejunte epóxi nas pastilhas do banheiro, obra finalizada aguardando entrega."
                aria-label="Observações da vistoria (superfície, sujidade, estado da obra, restrições de acesso etc.)"
                value={deal.observacoesVisita}
                onChange={(e) => set("observacoesVisita", e.target.value)}
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <StepHeader index={1} />
            <div className="cost-group-grid">
              {ROLES.map((r, i) => {
                const subtotal = num(deal.qtd[r.key]) * num(deal.diaria[r.key]) * num(deal.dias);
                return (
                  <div className="cost-group" key={r.key}>
                    <div className="cost-group-icon" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }}>
                      <UsersIcon />
                    </div>
                    <p className="cost-group-title">{r.label}</p>
                    <div className="cost-group-fields">
                      <div className="field">
                        <label htmlFor={`role-qtd-${r.key}`}>Qtd.</label>
                        <input
                          id={`role-qtd-${r.key}`}
                          className="input"
                          type="number"
                          aria-label={`Quantidade de ${r.label}`}
                          value={deal.qtd[r.key]}
                          onChange={(e) => setRole("qtd", r.key, e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`role-diaria-${r.key}`}>Diária</label>
                        <AffixInput
                          id={`role-diaria-${r.key}`}
                          type="number"
                          prefix="R$"
                          aria-label={`Diária em reais de ${r.label}`}
                          value={deal.diaria[r.key]}
                          onChange={(e) => setRole("diaria", r.key, e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="cost-group-subtotal">{formatBRL(subtotal)} no total</p>
                  </div>
                );
              })}
            </div>

            <div className="cost-group" style={{ marginTop: 14 }}>
              <p className="cost-group-title">Encargos e o seu pró-labore</p>
              <div className="cost-group-fields">
                {field(
                  "Encargos sobre a equipe",
                  <AffixInput type="number" suffix="%" value={deal.encargosPct ?? "0"} onChange={(e) => set("encargosPct", e.target.value)} />,
                  "encargosPct",
                )}
                {field(
                  "Seu pró-labore neste serviço",
                  <AffixInput type="number" prefix="R$" value={deal.proLabore ?? ""} onChange={(e) => set("proLabore", e.target.value)} />,
                  "proLabore",
                )}
              </div>
              <p className="microlabel" style={{ marginTop: 8 }}>
                <strong>Encargos</strong> são INSS, FGTS, férias e 13º de quem é registrado — deixe 0 se você só trabalha com diarista informal.{" "}
                <strong>Pró-labore</strong> é o quanto <em>você</em> precisa receber por esse serviço, separado do lucro da empresa — muita gente
                esquece de se pagar e acaba trabalhando de graça.
              </p>
            </div>

            <div className="cost-total-banner">
              <span>Total de equipe (com encargos e pró-labore)</span>
              <strong>{formatBRL(calc.maoDeObraTotal + calc.encargosTotal + calc.proLaboreTotal)}</strong>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeader index={2} />
            <div className="cost-group-grid">
              <div className="cost-group">
                <div className="cost-group-icon" style={{ background: "var(--cat-1)" }}>
                  <TruckIcon />
                </div>
                <p className="cost-group-title">Vale-transporte</p>
                <div className="cost-group-fields">
                  {field("Qtd./dia", <input className="input" type="number" value={deal.vtQtd} onChange={(e) => set("vtQtd", e.target.value)} />, "vtQtd")}
                  {field("Valor", <AffixInput type="number" prefix="R$" value={deal.vtValor} onChange={(e) => set("vtValor", e.target.value)} />, "vtValor")}
                </div>
                <p className="cost-group-subtotal">{formatBRL(calc.vtTotal)} no total</p>
              </div>

              <div className="cost-group">
                <div className="cost-group-icon" style={{ background: "var(--cat-2)" }}>
                  <CoffeeIcon />
                </div>
                <p className="cost-group-title">Alimentação</p>
                <div className="cost-group-fields">
                  {field("Qtd./dia", <input className="input" type="number" value={deal.almocoQtd} onChange={(e) => set("almocoQtd", e.target.value)} />, "almocoQtd")}
                  {field("Valor", <AffixInput type="number" prefix="R$" value={deal.almocoValor} onChange={(e) => set("almocoValor", e.target.value)} />, "almocoValor")}
                </div>
                <p className="cost-group-subtotal">{formatBRL(calc.almocoTotal)} no total</p>
              </div>

              <div className="cost-group">
                <div className="cost-group-icon" style={{ background: "var(--cat-3)" }}>
                  <DropletIcon />
                </div>
                <p className="cost-group-title">Combustível</p>
                <div className="cost-group-fields">
                  {field("Km/litro", <input className="input" type="number" value={deal.combKmPorLitro} onChange={(e) => set("combKmPorLitro", e.target.value)} />, "combKmPorLitro")}
                  {field("Valor do litro", <AffixInput type="number" prefix="R$" value={deal.combValorLitro} onChange={(e) => set("combValorLitro", e.target.value)} />, "combValorLitro")}
                  {field("Km rodados/dia", <input className="input" type="number" value={deal.combKmRodar} onChange={(e) => set("combKmRodar", e.target.value)} />, "combKmRodar")}
                </div>
                <p className="cost-group-subtotal">{formatBRL(calc.combustivelTotal)} no total</p>
              </div>

              <div className="cost-group">
                <div className="cost-group-icon" style={{ background: "var(--cat-4)" }}>
                  <ParkingIcon />
                </div>
                <p className="cost-group-title">Estacionamento e pedágio</p>
                <div className="cost-group-fields">
                  {field("Estacionamento", <AffixInput type="number" prefix="R$" value={deal.estacionamento} onChange={(e) => set("estacionamento", e.target.value)} />, "estacionamento")}
                  {field("Pedágio", <AffixInput type="number" prefix="R$" value={deal.pedagio} onChange={(e) => set("pedagio", e.target.value)} />, "pedagio")}
                </div>
                <p className="microlabel" style={{ marginTop: 8 }}>
                  Valor total do serviço todo, não por dia — diferente de vale-transporte, alimentação e combustível acima.
                </p>
                <p className="cost-group-subtotal">{formatBRL(num(deal.estacionamento) + num(deal.pedagio))} no total</p>
              </div>
            </div>

            <div className="cost-total-banner">
              <span>Total de transporte e apoio</span>
              <strong>{formatBRL(calc.apoioTotal)}</strong>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <StepHeader index={3} />

            {deal.metragem && (
              <div className="area-estimate-box">
                <span>
                  Estimativa por metragem ({deal.metragem} m² · {deal.clientType})
                </span>
                <strong>{formatBRL(estimateProductCostByArea(deal.clientType, num(deal.metragem)))}</strong>
                <p className="microlabel" style={{ margin: 0, flexBasis: "100%" }}>
                  Isso é só uma referência, baseada no tipo de imóvel — não entra sozinha na conta. Compare com os produtos que você lançar abaixo e ajuste se precisar.
                </p>
              </div>
            )}

            {(deal.produtos || []).length > 0 && (
              <div className="produtos-list">
                {(deal.produtos || []).map((p, i) => (
                  <div className="produto-card" key={i}>
                    <div className="produto-card-head">
                      <input
                        className="input produto-card-name"
                        placeholder="Ex: Detergente neutro"
                        aria-label={`Nome do produto ${i + 1}`}
                        title={p.nome}
                        value={p.nome}
                        onChange={(e) => setProduto(i, { nome: e.target.value })}
                      />
                      <button
                        type="button"
                        className="icon-action-btn danger produtos-remove-btn"
                        onClick={() => removeProduto(i)}
                        aria-label={`Remover produto ${i + 1}${p.nome ? `: ${p.nome}` : ""}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="cost-group-fields">
                      {field(
                        "Categoria",
                        <select
                          className="input"
                          aria-label={`Categoria do produto ${i + 1}${p.nome ? `: ${p.nome}` : ""}`}
                          value={p.categoria || "Neutro"}
                          onChange={(e) => setProduto(i, { categoria: e.target.value })}
                        >
                          {PRODUTO_CATEGORIAS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>,
                        `produtoCategoria${i}`,
                      )}
                      {field(
                        "Marca (opcional)",
                        <input
                          className="input"
                          placeholder="Ex: Veja, Ypê"
                          aria-label={`Marca do produto ${i + 1}${p.nome ? `: ${p.nome}` : ""}`}
                          value={p.marca || ""}
                          onChange={(e) => setProduto(i, { marca: e.target.value })}
                        />,
                        `produtoMarca${i}`,
                      )}
                      {field(
                        "Quantidade usada",
                        <input
                          className="input"
                          type="number"
                          min={0}
                          aria-label={`Quantidade do produto ${i + 1}${p.nome ? `: ${p.nome}` : ""}`}
                          value={p.quantidade}
                          onChange={(e) => setProduto(i, { quantidade: e.target.value })}
                        />,
                        `produtoQtd${i}`,
                      )}
                      {field(
                        "Custo unitário",
                        <AffixInput
                          type="number"
                          prefix="R$"
                          aria-label={`Custo unitário do produto ${i + 1}${p.nome ? `: ${p.nome}` : ""}`}
                          value={p.valorUnitario}
                          onChange={(e) => setProduto(i, { valorUnitario: e.target.value })}
                        />,
                        `produtoValor${i}`,
                      )}
                    </div>
                    <p className="produtos-subtotal produto-card-subtotal">
                      Subtotal: {formatBRL(num(p.quantidade || "1") * num(p.valorUnitario))}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {(deal.produtos || []).length > 0 && (
              <div className="cost-total-banner" style={{ marginBottom: 16 }}>
                <span>Total dos produtos</span>
                <strong>{formatBRL(calc.custoProdutos)}</strong>
              </div>
            )}
            <button type="button" className="icon-action-btn" onClick={addProduto} style={{ marginBottom: 16 }}>
              + adicionar produto
            </button>

            <div className="material-pct-box">
              <label htmlFor="qf-materialPctManual">% de materiais sobre o custo do serviço</label>
              <div className="material-pct-input">
                <input
                  id="qf-materialPctManual"
                  className="input"
                  type="number"
                  placeholder={`Automático: ${(calc.materialPct * 100).toFixed(0)}`}
                  value={deal.materialPctManual}
                  onChange={(e) => set("materialPctManual", e.target.value)}
                />
                <span className="material-pct-suffix">%</span>
              </div>
              <p className="microlabel" style={{ marginTop: 6 }}>
                Deixe em branco pra calcular automático (agora: {(calc.materialPct * 100).toFixed(0)}%) — o percentual sobe conforme o custo do
                serviço cresce (4% até R$ 1.000, 8% até R$ 2.000, 12% acima disso), pra cobrir mais desperdício em serviços maiores.
              </p>
            </div>

            <div className="cost-total-banner" style={{ marginTop: 16 }}>
              <span>Total de materiais (produtos + %)</span>
              <strong>{formatBRL(calc.materiaisTotal)}</strong>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <StepHeader index={4} />
            <div className="cost-group-grid">
              <div className="cost-group">
                <p className="cost-group-title">Custos fixos do escritório</p>
                <div className="cost-group-fields">
                  {field("Visita técnica", <AffixInput type="number" prefix="R$" value={deal.visitaTecnica} onChange={(e) => set("visitaTecnica", e.target.value)} />, "visitaTecnica")}
                  {field(
                    "Custos fixos do escritório",
                    <AffixInput type="number" prefix="R$" value={deal.rateioAdm} onChange={(e) => set("rateioAdm", e.target.value)} />,
                    "rateioAdm",
                  )}
                </div>

                <button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={() => setShowRateioHelper((s) => !s)}>
                  {showRateioHelper ? "Fechar calculadora ▲" : "Não sabe quanto colocar em custos fixos? Calcular ▾"}
                </button>

                {showRateioHelper && (
                  <div className="rateio-helper">
                    <p className="microlabel" style={{ marginTop: 0 }}>
                      Soma os custos fixos do mês (aluguel, água/luz, contador...) e divide por quantos serviços você faz no mês — assim cada
                      orçamento carrega sua fatia justa do escritório.
                    </p>
                    <div className="cost-group-fields">
                      {field("Aluguel /mês", <AffixInput type="number" prefix="R$" value={rateioAluguel} onChange={(e) => setRateioAluguel(e.target.value)} />, "rateioAluguel")}
                      {field("Água/luz/internet /mês", <AffixInput type="number" prefix="R$" value={rateioContas} onChange={(e) => setRateioContas(e.target.value)} />, "rateioContas")}
                      {field("Contador /mês", <AffixInput type="number" prefix="R$" value={rateioContador} onChange={(e) => setRateioContador(e.target.value)} />, "rateioContador")}
                      {field("Outros custos fixos /mês", <AffixInput type="number" prefix="R$" value={rateioOutros} onChange={(e) => setRateioOutros(e.target.value)} />, "rateioOutros")}
                      {field(
                        "Quantos serviços você faz por mês",
                        <input className="input" type="number" min={1} value={rateioServicosMes} onChange={(e) => setRateioServicosMes(e.target.value)} />,
                        "rateioServicosMes",
                      )}
                    </div>
                    <div className="rateio-helper-result">
                      <span>Custo fixo sugerido por serviço</span>
                      <strong>{formatBRL(rateioSugerido)}</strong>
                      <button type="button" className="icon-action-btn primary" onClick={() => { set("rateioAdm", rateioSugerido.toFixed(2)); setShowRateioHelper(false); }}>
                        Usar esse valor
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="cost-group">
                <p className="cost-group-title">Margem e preço final</p>
                <div className="cost-group-fields">
                  {field("Margem desejada", <AffixInput type="number" suffix="%" value={deal.margem} onChange={(e) => set("margem", e.target.value)} />, "margem")}
                  {field(
                    "Imposto sobre a venda",
                    <AffixInput type="number" suffix="%" value={deal.impostoPct} onChange={(e) => set("impostoPct", e.target.value)} />,
                    "impostoPct",
                  )}
                  {field(
                    "Gordura de segurança",
                    <AffixInput type="number" suffix="%" value={deal.gorduraPct ?? "8"} onChange={(e) => set("gorduraPct", e.target.value)} />,
                    "gorduraPct",
                  )}
                  {field(
                    "Definir um valor final diferente",
                    <AffixInput type="number" prefix="R$" value={deal.valorPagamento} onChange={(e) => set("valorPagamento", e.target.value)} />,
                    "valorPagamento",
                    { wide: true },
                  )}
                </div>
                <p className="microlabel" style={{ marginTop: 8 }}>
                  O <strong>imposto</strong> (ex: a porcentagem que você paga pelo Simples Nacional) incide sobre o preço de venda, não sobre o
                  custo — por isso entra junto com a margem no cálculo do preço sugerido, do mesmo jeito. A <strong>gordura de segurança</strong>{" "}
                  já entra automaticamente no custo pra cobrir desperdício de produto, pano/ferramenta estragada e imprevisto na obra. Deixe o
                  valor final em branco pra usar o preço sugerido calculado abaixo.
                </p>
              </div>
            </div>

            <div className="tip-box">
              <LightbulbIcon />
              <p>
                Não copie o preço do concorrente nem "chute" um valor — baseie-se no que <strong>você</strong> gasta de verdade. Cobrar barato
                demais pra fechar a venda é o jeito mais rápido de quebrar sua empresa.
              </p>
            </div>

            {calc.margemAbaixoDoSaudavel && (
              <div className="margin-warning">
                <AlertTriangleIcon />
                <div>
                  <p className="margin-warning-title">Margem de {(calc.margemReal * 100).toFixed(1)}% — abaixo do recomendado</p>
                  <p>
                    Com esses custos, esse preço deixa menos de {(MARGEM_MINIMA_SAUDAVEL * 100).toFixed(0)}% de margem. Ajuste a margem desejada
                    ou o valor final antes de salvar, ou o app vai pedir uma confirmação extra.
                  </p>
                </div>
              </div>
            )}

            <div className="cost-total-banner">
              <span>Preço sugerido</span>
              <strong>{formatBRL(calc.valorFinal)}</strong>
            </div>

            <div className="cost-group premium-option" style={{ marginTop: 14 }}>
              <label className="premium-toggle">
                <input
                  type="checkbox"
                  checked={deal.ofertarPremium}
                  onChange={(e) => set("ofertarPremium", e.target.checked)}
                />
                <span>
                  <strong>Oferecer uma opção Premium</strong>
                  <p className="microlabel" style={{ margin: "2px 0 0" }}>
                    Mostra 2 preços na apresentação e no PDF pro cliente — ele para de comparar seu preço com o do concorrente e passa a
                    escolher entre as suas duas opções.
                  </p>
                </span>
              </label>

              {deal.ofertarPremium && (
                <div className="cost-group-fields" style={{ marginTop: 12 }}>
                  <div className="field field-wide">
                    <label htmlFor="qf-premiumDescricao">O que a Premium tem a mais</label>
                    <textarea
                      id="qf-premiumDescricao"
                      className="input"
                      rows={2}
                      style={{ resize: "vertical" }}
                      placeholder="Ex: limpeza de vidros externos em altura, proteção de superfícies nobres e relatório fotográfico antes e depois."
                      value={deal.premiumDescricao}
                      onChange={(e) => set("premiumDescricao", e.target.value)}
                    />
                  </div>
                  {field(
                    "Valor da opção Premium",
                    <AffixInput
                      type="number"
                      prefix="R$"
                      placeholder={(calc.valorFinal * 1.35).toFixed(2)}
                      value={deal.premiumValor}
                      onChange={(e) => set("premiumValor", e.target.value)}
                    />,
                    "premiumValor",
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="wizard-nav">
          <button type="button" className="icon-action-btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            ← Voltar
          </button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {step < lastStep && (
              <button type="button" className="link-btn" onClick={handleSave} disabled={saving}>
                salvar agora
              </button>
            )}
            {step < lastStep ? (
              <button type="button" className="save-btn" onClick={() => setStep((s) => Math.min(lastStep, s + 1))}>
                Avançar →
              </button>
            ) : (
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {isEditing ? "Salvar alterações" : "Salvar e enviar para propostas"}
              </button>
            )}
          </div>
        </div>

        {step === lastStep && (
          <>
            <div className="actions-row">
              <button className="pdf-btn" onClick={() => setPresenting(true)} type="button" title="Mostra a proposta em slides, pra apresentar no celular/tablet">
                Apresentar
              </button>
              <button className="pdf-btn" onClick={handleDownloadClientPdf} type="button" title="Proposta limpa, sem detalhamento de custos — pra mandar ao cliente">
                PDF para o cliente
              </button>
              <button className="pdf-btn" onClick={handleDownloadInternalPdf} type="button" title="Com detalhamento de custos — só pra uso interno da empresa">
                PDF interno (com custos)
              </button>
              {isEditing && onCancelEdit && (
                <button className="link-btn" type="button" onClick={onCancelEdit}>
                  cancelar edição
                </button>
              )}
            </div>
            <p className="microlabel" style={{ marginTop: 8 }}>
              💡 Prefira <strong>Apresentar</strong> a só mandar o preço pronto no WhatsApp — mostrar a proposta ajuda o cliente a entender o valor
              do seu trabalho, não só ver um número.
            </p>
          </>
        )}
        <p className={`save-msg${saveError ? " is-error" : ""}`} role="status" aria-live="polite">
          {saveMsg}
        </p>
      </div>

      <div className="panel">
        <h2 className="panel-title">Resumo do orçamento</h2>
        <p className="microlabel">Equipe</p>
        <p>{formatBRL(calc.maoDeObraTotal)}</p>
        {calc.encargosTotal > 0 && (
          <>
            <p className="microlabel">Encargos</p>
            <p>{formatBRL(calc.encargosTotal)}</p>
          </>
        )}
        {calc.proLaboreTotal > 0 && (
          <>
            <p className="microlabel">Seu pró-labore</p>
            <p>{formatBRL(calc.proLaboreTotal)}</p>
          </>
        )}
        <p className="microlabel">Transporte e alimentação</p>
        <p>{formatBRL(calc.apoioTotal)}</p>
        <p className="microlabel">Materiais ({(calc.materialPct * 100).toFixed(0)}%)</p>
        <p>{formatBRL(calc.materiaisTotal)}</p>
        {calc.gorduraValor > 0 && (
          <>
            <p className="microlabel">Gordura de segurança</p>
            <p>{formatBRL(calc.gorduraValor)}</p>
          </>
        )}
        <p className="microlabel">Custo operacional total</p>
        <p>{formatBRL(calc.custosOperacionais)}</p>
        {calc.impostoTotal > 0 && (
          <>
            <p className="microlabel">Imposto sobre a venda</p>
            <p>{formatBRL(calc.impostoTotal)}</p>
          </>
        )}
        <hr style={{ borderColor: "var(--n-800)" }} />
        <p className="microlabel">Preço sugerido</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--amber-400)" }}>{formatBRL(calc.valorFinal)}</p>
        <p className={`microlabel${calc.margemAbaixoDoSaudavel ? " margin-summary-low" : ""}`}>
          Margem real: {(calc.margemReal * 100).toFixed(1)}%{calc.margemAbaixoDoSaudavel ? " ⚠️ abaixo do recomendado" : ""}
        </p>
        <p className="microlabel">Custo por m²: {formatBRL(calc.custoPorM2)}</p>
      </div>
      </div>
      {presenting && (
        <PresentationView
          deal={{ ...deal, valorFinal: calc.valorFinal }}
          companyName={company.companyName || ""}
          logoUrl={company.logoUrl}
          anosExperiencia={company.anosExperiencia}
          obrasEntregues={company.obrasEntregues}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  );
}
