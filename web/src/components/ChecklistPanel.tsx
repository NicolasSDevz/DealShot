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

  const ring = 2 * Math.PI * 52;

  return (
    <div className="checklist-layout">
      <aside className="checklist-score">
        <div className="checklist-ring" role="img" aria-label={`${done} de ${TOTAL_ITEMS} hábitos na rotina`}>
          <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
            <circle cx="60" cy="60" r="52" className="checklist-ring-track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className={`checklist-ring-fill${pct === 100 ? " full" : ""}`}
              strokeDasharray={ring}
              strokeDashoffset={ring - (ring * pct) / 100}
            />
          </svg>
          <span className="checklist-ring-pct">{pct}%</span>
        </div>
        <strong className="checklist-score-title">
          {done} de {TOTAL_ITEMS} hábitos na rotina
        </strong>
        <p className="checklist-score-text">
          Marque o que já é rotina na sua empresa. São esses detalhes que fazem o cliente sentir que está fazendo um bom negócio antes mesmo
          de ver o preço.
        </p>
        <span className="checklist-saving" role="status" aria-live="polite">
          {saving ? "Salvando..." : ""}
        </span>
        {done === TOTAL_ITEMS && (
          <p className="checklist-done">Todos os pontos cobertos. É isso que separa quem só manda preço de quem vende valor.</p>
        )}
      </aside>

      <div className="checklist-groups">
        {CHECKLIST_GROUPS.map((group) => {
          const groupDone = group.items.filter((i) => items[i.id]).length;
          return (
            <section className="checklist-group-card" key={group.title}>
              <header className="checklist-group-head">
                <span className="checklist-group-icon" style={{ background: group.color }}>
                  {group.icon}
                </span>
                <h2>{group.title}</h2>
                <span className="checklist-group-count">
                  {groupDone}/{group.items.length}
                </span>
              </header>
              <div className="checklist-items">
                {group.items.map((item) => {
                  const checked = !!items[item.id];
                  return (
                    <label key={item.id} className={`checklist-item${checked ? " checked" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
                      <span className="checklist-box" aria-hidden="true">
                        ✓
                      </span>
                      <span className="checklist-text">
                        {item.label}
                        <span className="checklist-item-why">{item.why}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
