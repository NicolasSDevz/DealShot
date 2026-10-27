import type { ReactNode } from "react";

const BENEFITS = [
  "Preço certo de pós-obra em minutos, sem chute",
  "Proposta em PDF e apresentação com a sua marca",
  "Lembrete de follow-up para não perder cliente",
  "Faturamento, lucro e conversão num só lugar",
];

// Moldura das telas de entrar e criar conta: marca e benefícios de um lado, formulário do outro
// (no celular, a marca vira só uma faixa em cima do formulário).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <img src="/logo.png" alt="" className="sidebar-logo" />
          <span className="sidebar-brand-name">
            Deal <span>Shot</span>
          </span>
        </div>

        <div className="auth-brand-body">
          <h1 className="auth-headline">Orçamento de limpeza pós-obra com o preço certo.</h1>
          <p className="auth-lead">A calculadora que soma equipe, transporte, materiais, imposto e margem, e mostra quanto realmente sobra.</p>
          <ul className="auth-benefits">
            {BENEFITS.map((b) => (
              <li key={b}>
                <span className="auth-check" aria-hidden="true">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-brand-foot">Uma ferramenta da Arrow Shot</p>
      </aside>

      <main className="auth-main">{children}</main>
    </div>
  );
}
