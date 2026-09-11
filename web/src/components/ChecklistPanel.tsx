import { useState, type ReactElement } from "react";
import { saveChecklistAtendimento } from "../lib/db";
import { SendIcon, CreditCardIcon, CheckCircleIcon } from "./Icons";

interface ChecklistItem {
  id: string;
  label: string;
  /** Por que esse item importa -- vem direto do racional do roteiro de vendas, não só a regra seca. */
  why: string;
}

interface ChecklistGroup {
  title: string;
  icon: ReactElement;
  color: string;
  items: ChecklistItem[];
}

// Os 10 pontos de "você está gerando valor em cada ponto de contato?" do roteiro de vendas,
// agrupados na ordem em que acontecem de verdade (antes do serviço, na proposta, depois da
// entrega) -- em vez de uma lista solta de 10 linhas, difícil de escanear rápido.
const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    title: "Antes do serviço",
    icon: <SendIcon />,
    color: "var(--cat-1)",
    items: [
      {
        id: "resposta_1h",
        label: "Respondo mensagens do cliente em até 1 hora",
        why: "Quem responde primeiro transmite profissionalismo e sai na frente do concorrente.",
      },
      {
        id: "confirma_visita",
        label: "Confirmo a visita técnica por WhatsApp no dia anterior e 1h antes",
        why: "Reduz falta e já mostra organização antes de o serviço nem ter começado.",
      },
      {
        id: "explica_etapas",
        label: "Explico ao cliente cada etapa do serviço antes de começar",
        why: "Clareza gera segurança. Segurança fecha contrato.",
      },
    ],
  },
  {
    title: "Na proposta",
    icon: <CreditCardIcon />,
    color: "var(--cat-5)",
    items: [
      {
        id: "duas_opcoes",
        label: "Ofereço 2 opções de preço em toda proposta",
        why: "O cliente para de comparar seu preço com o do concorrente e passa a comparar suas duas opções.",
      },
      {
        id: "personaliza_proposta",
        label: "Personalizo a proposta com o nome do cliente e detalhes da obra",
        why: "Mensagem personalizada tem taxa de resposta até 3x maior que mensagem genérica.",
      },
      {
        id: "garantia_clara",
        label: "Tenho uma garantia clara para reduzir o risco percebido",
        why: "Elimina o risco que o cliente sente e derruba a resistência de fechar.",
      },
      {
        id: "proximo_passo",
        label: "Proponho o próximo passo sempre que envio uma proposta",
        why: "Proposta sem prazo nem próximo passo é proposta que o cliente vai \"pensar\" pra sempre.",
      },
    ],
  },
  {
    title: "Depois da entrega",
    icon: <CheckCircleIcon />,
    color: "var(--emerald-400)",
    items: [
      {
        id: "entrega_checklist",
        label: "Entrego o imóvel com checklist ou relatório fotográfico",
        why: "O cliente não precisa perguntar se ficou bom — ele já vê o valor na entrega.",
      },
      {
        id: "pede_avaliacao",
        label: "Peço avaliação no Google logo após a entrega",
        why: "É o momento de maior satisfação do cliente — a melhor hora de virar prova social pro próximo.",
      },
      {
        id: "acompanhamento_24h",
        label: "Envio mensagem de acompanhamento 24h após o serviço",
        why: "Mostra interesse real no resultado — vale mais do que qualquer desconto.",
      },
    ],
  },
];

const TOTAL_ITEMS = CHECKLIST_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

interface Props {
  accountId: string;
  initial: Record<string, boolean>;
}

export default function ChecklistPanel({ accountId, initial }: Props) {
  const [items, setItems] = useState<Record<string, boolean>>(initial || {});
  const [saving, setSaving] = useState(false);

  const done = CHECKLIST_GROUPS.reduce((sum, g) => sum + g.items.filter((i) => items[i.id]).length, 0);
  const pct = Math.round((done / TOTAL_ITEMS) * 100);

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
    <div className="panel" style={{ margin: 16, maxWidth: 680 }}>
      <h2 className="panel-title">Checklist de atendimento</h2>
      <p className="panel-help" style={{ marginTop: 0 }}>
        Boas práticas que fazem o cliente sentir que está fazendo um bom negócio antes mesmo de ver o preço. Marque o que já é rotina
        consolidada na sua empresa — cada item já vem com o porquê.
      </p>

      <div className="checklist-progress-track" style={{ marginBottom: 6 }}>
        <div className="checklist-progress-fill" style={{ width: `${pct}%`, background: pct === 100 ? "var(--emerald-400)" : "var(--amber-400)" }} />
      </div>
      <p className="microlabel" style={{ marginBottom: 20 }}>
        {done} de {TOTAL_ITEMS} {saving ? "— salvando..." : ""}
      </p>

      {CHECKLIST_GROUPS.map((group) => {
        const groupDone = group.items.filter((i) => items[i.id]).length;
        return (
          <div className="cost-group checklist-group" key={group.title} style={{ marginBottom: 16 }}>
            <div className="cost-group-icon" style={{ background: group.color, marginBottom: 10 }}>
              {group.icon}
            </div>
            <p className="cost-group-title">
              {group.title}
              <span className="microlabel" style={{ marginLeft: 8 }}>
                {groupDone}/{group.items.length}
              </span>
            </p>
            <div className="checklist-items">
              {group.items.map((item) => {
                const checked = !!items[item.id];
                return (
                  <label key={item.id} className={`checklist-item${checked ? " checked" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
                    <span>
                      {item.label}
                      <span className="checklist-item-why">{item.why}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {done === TOTAL_ITEMS && (
        <p className="microlabel" style={{ marginTop: 4, color: "var(--emerald-400)", fontWeight: 700 }}>
          🎉 Todos os pontos cobertos — é isso que separa quem só manda preço de quem vende valor.
        </p>
      )}
    </div>
  );
}
