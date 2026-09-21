# Deal Shot

**Orçamentos rápidos e fáceis para empresas de limpeza.**

Deal Shot (da Arrow Shot, antes chamado "Converteu") é uma plataforma web por assinatura para empresas de limpeza — principalmente limpeza pós-obra — montarem orçamentos profissionais, apresentarem a proposta ao cliente e acompanharem a venda até o fechamento e o recebimento.

O coração do produto é a **calculadora de preço**: ela ensina quem não tem formação em gestão a precificar de verdade (equipe, encargos, pró-labore, transporte, materiais, imposto e margem), em vez de "chutar" um valor e trabalhar no prejuízo.

## O que a plataforma faz

**Para a empresa de limpeza (painel do usuário)**

- **Calculadora** — orçamento em 5 etapas (obra e cliente, equipe, transporte e apoio, materiais, custos e margem) que calcula o preço sugerido e avisa quando a margem fica abaixo do saudável.
- **Propostas** — quadro em 4 etapas (Em aberto → Aguardando resposta → Fechado / Perdido), com busca, mensagens prontas de WhatsApp e e-mail, sequência de follow-up (mesmo dia, dia 2, dia 4, dia 5) e registro de pagamento (Pix, cartão, boleto, parcelado, com controle de parcelas recebidas).
- **Apresentação** — a proposta em slides para mostrar ao vivo ao cliente, com opção **Padrão + Premium** (ancoragem de preço) e diferenciais de autoridade (anos de mercado, obras entregues).
- **PDF** — versão limpa para o cliente e versão interna com o detalhamento de custos e margem.
- **Resultados** — faturamento, taxa de conversão, venda média, funil, origem dos leads, formas de pagamento e evolução mensal.
- **Checklist de atendimento** — 10 boas práticas para gerar valor em cada ponto de contato com o cliente.
- **Perfil da empresa** — dados, descrição e logo que aparecem nos PDFs.

**Para o dono da plataforma (painel admin)**

- Receita mensal recorrente (MRR), distribuição de planos e contas que precisam de atenção.
- Lista de clientes com busca, filtros, renovação de assinatura, troca de plano, suspensão/ativação, anotações internas e exportação em CSV.
- Criação de contas de teste, gestão de administradores e visualização do painel como o cliente.

## Modelo de negócio

Oferta única de lançamento (R$ 29,90/mês, orçamentos ilimitados). O pagamento acontece fora do app, via Kiwify, e a conta nasce ativa com 30 dias de acesso. Já existe um webhook da Kiwify pronto (`web/api/kiwify-webhook.ts`) para o fluxo automático de ativação/renovação quando o processo virar self-service, e a grade de planos antiga (Start / Converte / Ilimitado, cobrança via Asaas) segue no código, desligada.

## Tecnologia

| Camada | O que usa |
|---|---|
| Front-end | React 19 + TypeScript + Vite (`web/`), PDF com jsPDF |
| Hospedagem | Vercel (site e funções em `web/api/`) |
| Banco e login | Firebase — Firestore, Authentication e Storage |
| E-mails de conta | Cloud Function `sendAuthEmail` via Resend (`functions/`, exige plano Blaze do Firebase) |
| Pagamento | Kiwify (webhook); Asaas dormente |

## Estrutura do repositório

```
web/         App em produção (React + Vite) e funções serverless (web/api/)
functions/   Cloud Functions do Firebase (e-mails de conta, Google Agenda, etc.)
firestore.rules, storage.rules   Regras de segurança do Firebase
NOTAS-DEPLOY.md                  Passo a passo de deploy do Firebase
app.js, index.html, admin.html…  Versão antiga em JS puro — não está mais no ar
```

O ID do projeto no Firebase continua `converteu-dec78` (não dá pra renomear um projeto existente).

## Rodando localmente

```bash
cd web
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção (checa os tipos antes)
npm run lint     # oxlint
```

Variáveis usadas pelas funções em `web/api/` (configuradas no Vercel): `FIREBASE_SERVICE_ACCOUNT` e `KIWIFY_WEBHOOK_TOKEN`. Os segredos das Cloud Functions estão listados em `NOTAS-DEPLOY.md`.

## Privacidade

O cadastro exige o aceite de uso dos dados (LGPD) antes de criar a conta. A logo da empresa não é gravada no banco: fica só no navegador da sessão atual.
