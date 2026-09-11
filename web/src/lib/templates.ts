import type { Deal } from "./calc";
import { formatBRL } from "./calc";

export interface MessageTemplate {
  id: string;
  label: string;
  build: (deal: Deal, companyName: string, valorFinal: number) => string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "enviar_orcamento",
    label: "Enviar orçamento",
    build: (d, empresa, valor) =>
      `Olá, ${d.clientName || "tudo bem"}! Segue o orçamento do serviço solicitado, no valor de ${formatBRL(valor)}. Qualquer dúvida, estou à disposição. — ${empresa}`,
  },
  {
    id: "confirmacao_recebimento",
    label: "Confirmar recebimento (mesmo dia)",
    build: (d, empresa) => `Oi, ${d.clientName || ""}! Chegou certinho a proposta? Qualquer dúvida estou aqui. — ${empresa}`,
  },
  {
    id: "primeiro_followup",
    label: "Primeiro follow-up (dia 2)",
    build: (d, empresa) =>
      `Oi, ${d.clientName || ""}! Passando pra saber se conseguiu dar uma olhada na proposta que enviei. Fico à disposição pra qualquer ajuste. — ${empresa}`,
  },
  {
    id: "segundo_followup",
    label: "Segundo follow-up",
    build: (d, empresa) =>
      `Oi, ${d.clientName || ""}, tudo bem? Ainda estou à disposição caso queira fechar o serviço ou tirar alguma dúvida sobre o orçamento. — ${empresa}`,
  },
  {
    id: "criar_urgencia",
    label: "Criar urgência (dia 4)",
    build: (d, empresa) =>
      `Oi, ${d.clientName || ""}! Sua proposta vence amanhã. Quer que eu renove ou já confirmamos a data de início? — ${empresa}`,
  },
  {
    id: "encerramento_proposta",
    label: "Encerrar proposta (dia 5)",
    build: (d, empresa) =>
      `Oi, ${d.clientName || ""}! Vou encerrar sua proposta hoje, já que não tivemos retorno. Se precisar no futuro, é só chamar. — ${empresa}`,
  },
  {
    id: "nao_respondeu",
    label: "Cliente não respondeu",
    build: (d, empresa) =>
      `Olá, ${d.clientName || ""}! Não sei se recebeu minha última mensagem sobre o orçamento — segue novamente à disposição, é só me chamar. — ${empresa}`,
  },
  {
    id: "pediu_desconto",
    label: "Cliente pediu desconto",
    build: (d, empresa, valor) =>
      `Oi, ${d.clientName || ""}! Sobre o desconto, consigo rever alguns pontos do orçamento (${formatBRL(valor)}) — me conta qual valor faria sentido pra fecharmos. — ${empresa}`,
  },
  {
    id: "vai_pensar",
    label: "Cliente disse que vai pensar",
    build: (d, empresa) =>
      `Sem problema, ${d.clientName || ""}! Fico no aguardo. Se surgir alguma dúvida enquanto decide, é só chamar. — ${empresa}`,
  },
  {
    id: "retomar_antiga",
    label: "Retomar proposta antiga",
    build: (d, empresa, valor) =>
      `Olá, ${d.clientName || ""}! Retomando aqui aquele orçamento de ${formatBRL(valor)} que conversamos — ainda está de pé, e consigo revisar os valores se precisar. — ${empresa}`,
  },
];
