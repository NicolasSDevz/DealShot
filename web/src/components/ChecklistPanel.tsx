import { useState } from "react";
import { saveChecklistAtendimento } from "../lib/db";

interface ChecklistItem {
  id: string;
  label: string;
}

// Os 10 pontos de "você está gerando valor em cada ponto de contato?" do roteiro de vendas --
// não são etapas de um orçamento específico, são hábitos da empresa como um todo, por isso ficam
// numa aba própria em vez de dentro de uma proposta.
const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: "resposta_1h", label: "Respondo mensagens do cliente em até 1 hora" },
  { id: "confirma_visita", label: "Confirmo a visita técnica por WhatsApp no dia anterior e 1h antes" },
  { id: "explica_etapas", label: "Explico ao cliente cada etapa do serviço antes de começar" },
  { id: "entrega_checklist", label: "Entrego o imóvel com checklist ou relatório fotográfico" },
  { id: "pede_avaliacao", label: "Peço avaliação no Google logo após a entrega" },
  { id: "acompanhamento_24h", label: "Envio mensagem de acompanhamento 24h após o serviço" },
  { id: "duas_opcoes", label: "Ofereço 2 opções de preço em toda proposta" },
  { id: "personaliza_proposta", label: "Personalizo a proposta com o nome do cliente e detalhes da obra" },
  { id: "garantia_clara", label: "Tenho uma garantia clara para reduzir o risco percebido" },
  { id: "proximo_passo", label: "Proponho o próximo passo sempre que envio uma proposta" },
];

interface Props {
  accountId: string;
  initial: Record<string, boolean>;
}

export default function ChecklistPanel({ accountId, initial }: Props) {
  const [items, setItems] = useState<Record<string, boolean>>(initial || {});
  const [saving, setSaving] = useState(false);

  const done = CHECKLIST_ITEMS.filter((i) => items[i.id]).length;
  const pct = Math.round((done / CHECKLIST_ITEMS.length) * 100);

  async function toggle(id: string) {
    const next = { ...items, [id]: !items[id] };
    setItems(next);
    setSaving(true);
    try {
      await saveChecklistAtendimento(accountId, next);
    } catch (err) {
      console.error("Falha ao salvar checklist de atendimento", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ margin: 16, maxWidth: 640 }}>
      <h2 className="panel-title">Checklist de atendimento</h2>
      <p className="panel-help" style={{ marginTop: 0 }}>
        Boas práticas que fazem o cliente sentir que está fazendo um bom negócio antes mesmo de ver o preço. Marque o que já é rotina
        consolidada na sua empresa.
      </p>

      <div className="checklist-progress-track" style={{ marginBottom: 6 }}>
        <div className="checklist-progress-fill" style={{ width: `${pct}%`, background: pct === 100 ? "var(--emerald-400)" : "var(--amber-400)" }} />
      </div>
      <p className="microlabel" style={{ marginBottom: 16 }}>
        {done} de {CHECKLIST_ITEMS.length} {saving ? "— salvando..." : ""}
      </p>

      <div className="checklist-items">
        {CHECKLIST_ITEMS.map((item) => {
          const checked = !!items[item.id];
          return (
            <label key={item.id} className={`checklist-item${checked ? " checked" : ""}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
              <span>{item.label}</span>
            </label>
          );
        })}
      </div>

      {done === CHECKLIST_ITEMS.length && (
        <p className="microlabel" style={{ marginTop: 16, color: "var(--emerald-400)", fontWeight: 700 }}>
          🎉 Todos os pontos cobertos — é isso que separa quem só manda preço de quem vende valor.
        </p>
      )}
    </div>
  );
}
