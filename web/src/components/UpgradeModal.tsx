import { useState } from "react";
import Modal from "./Modal";
import PlanPicker from "./PlanPicker";
import { PLANS, formatCpfCnpj, type PlanId, type BillingCycle } from "../lib/calc";
import { RocketIcon } from "./Icons";

interface Props {
  accountId: string;
  email: string;
  companyName?: string;
  cnpj?: string;
  currentPlan: PlanId;
  currentBillingCycle: BillingCycle;
  onClose: () => void;
}

export default function UpgradeModal({ accountId, email, companyName, cnpj, currentPlan, currentBillingCycle, onClose }: Props) {
  const [plan, setPlan] = useState<PlanId>(currentPlan);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(currentBillingCycle);
  const [cpfCnpj, setCpfCnpj] = useState(cnpj || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isSamePlan = plan === currentPlan && billingCycle === currentBillingCycle;
  const currentLabel = PLANS.find((p) => p.id === currentPlan)?.label || "atual";
  const targetLabel = PLANS.find((p) => p.id === plan)?.label || "";

  async function handleSubmit() {
    if (cpfCnpj.replace(/\D/g, "").length < 11) {
      setError("Informe um CPF ou CNPJ válido pra gerar a cobrança.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          email,
          name: companyName,
          cpfCnpj: cpfCnpj.replace(/\D/g, ""),
          plan,
          billingCycle,
        }),
      });
      if (!res.ok) throw new Error("Falha ao iniciar pagamento");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setSubmitting(false);
      setError("Não foi possível abrir o pagamento. Tente de novo.");
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div className="panel upgrade-modal">
        <div className="upgrade-modal-header">
          <span className="upgrade-modal-icon">
            <RocketIcon />
          </span>
          <div>
            <h2 className="panel-title" style={{ margin: 0 }}>
              Melhorar assinatura
            </h2>
            <p className="panel-help" style={{ margin: "2px 0 0" }}>
              Você está no plano <strong>{currentLabel}</strong>. Escolha um novo plano abaixo.
            </p>
          </div>
        </div>

        <PlanPicker
          plan={plan}
          billingCycle={billingCycle}
          onChangePlan={setPlan}
          onChangeBillingCycle={setBillingCycle}
          currentPlanId={currentPlan}
          hideFree
        />

        {!isSamePlan && (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="upgrade-cpfcnpj">CPF ou CNPJ</label>
            <input
              id="upgrade-cpfcnpj"
              className="input"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            />
          </div>
        )}

        <p className="save-msg is-error" role="alert" aria-live="assertive">
          {error}
        </p>

        <div className="actions-row" style={{ marginTop: 8 }}>
          {isSamePlan ? (
            <button type="button" className="save-btn" style={{ width: "100%" }} onClick={onClose}>
              Fechar
            </button>
          ) : (
            <button type="button" className="save-btn signup-cta" style={{ width: "100%" }} disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Abrindo pagamento..." : `Ir para o plano ${targetLabel}`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
