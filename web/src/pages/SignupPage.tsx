import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { saveCompanyProfile } from "../lib/db";
import { formatCpfCnpj } from "../lib/calc";
import { EyeIcon, EyeOffIcon } from "../components/Icons";

// Fase manual, antes de hospedar oficialmente num domínio: o pagamento acontece fora do app
// (Nicolas manda o link da Kiwify direto pra pessoa) e só depois de confirmado ele libera o
// link desta tela. Por isso não tem nenhuma etapa de pagamento aqui -- ao criar a conta, ela já
// nasce ativa com acesso ilimitado por 1 mês (precisa da regra extra em firestore.rules, ver
// comentário lá). O fluxo automático via webhook da Kiwify (KIWIFY_CHECKOUT_URL em lib/db.ts,
// web/api/kiwify-webhook.ts) fica pronto pra quando o processo virar self-service de verdade.
const ACESSO_DIAS = 30;

export default function SignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [descricao, setDescricao] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    if (cpfCnpj.replace(/\D/g, "").length < 11) {
      setError("Informe um CPF ou CNPJ válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (!lgpdConsent) {
      setError("Você precisa marcar a autorização de uso dos dados pra criar a conta.");
      return;
    }
    setError("");
    setSubmitting(true);

    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      uid = cred.user.uid;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ACESSO_DIAS);
      await setDoc(doc(db, "accounts", uid), {
        companyName: companyName.trim(),
        email: email.trim(),
        ownerUid: uid,
        // O pagamento já foi confirmado fora do app (Kiwify, manual) antes desse link ser
        // liberado pra pessoa -- então a conta já nasce ativa, sem limite de orçamentos, com
        // 1 mês de acesso a partir de agora.
        plan: "sem_limite",
        billingCycle: "mensal",
        status: "active",
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
      });
      // Já aproveita o nome e o CNPJ/CPF que ele acabou de digitar, pra não pedir de novo
      // na primeira vez que entrar no app.
      await saveCompanyProfile(uid, { companyName: companyName.trim(), cnpj: cpfCnpj.trim(), descricao: descricao.trim() });
    } catch (err) {
      console.error("Falha ao criar a conta", err);
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setError("Já existe uma conta com esse e-mail. Faça login.");
      } else {
        setError("Não foi possível criar a conta. Tente novamente.");
      }
      setSubmitting(false);
      return;
    }

    navigate("/");
  }

  return (
    <div className="auth-screen">
      <form className="panel auth-panel signup-panel" onSubmit={handleSubmit}>
        <h2 className="panel-title">Criar conta</h2>
        <p className="panel-help" style={{ marginTop: 0 }}>
          Acesso completo: calculadora, propostas com funil, PDF profissional e gráficos de resultados.
        </p>

        <div className="field">
          <label htmlFor="signup-company">Nome da empresa</label>
          <input id="signup-company" className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="signup-cpfcnpj">CPF ou CNPJ</label>
          <input
            id="signup-cpfcnpj"
            className="input"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            required
          />
          <p className="panel-help" style={{ margin: "4px 0 0" }}>
            Fica registrado no perfil da sua empresa (dá pra editar depois).
          </p>
        </div>
        <div className="field">
          <label htmlFor="signup-descricao">Descrição da empresa (opcional)</label>
          <textarea
            id="signup-descricao"
            className="input"
            rows={2}
            style={{ resize: "vertical" }}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Mais de 10 anos de experiência em limpeza pós-obra, atendendo toda a região."
          />
          <p className="panel-help" style={{ margin: "4px 0 0" }}>
            Aparece no PDF dos seus orçamentos. Pode preencher depois, no seu perfil.
          </p>
        </div>
        <div className="field">
          <label htmlFor="signup-email">E-mail</label>
          <input
            id="signup-email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Senha</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="signup-password"
              className="input"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
        <label className="lgpd-check">
          <input type="checkbox" checked={lgpdConsent} onChange={(e) => setLgpdConsent(e.target.checked)} required />
          <span>
            Autorizo o uso dos meus dados (nome da empresa, e-mail, CPF/CNPJ e demais dados que eu cadastrar) para criar minha conta, entrar em
            contato comigo e dar suporte ao uso do Deal Shot, conforme a Lei Geral de Proteção de Dados (LGPD).
          </span>
        </label>
        <button className="save-btn signup-cta" type="submit" style={{ width: "100%" }} disabled={submitting}>
          {submitting ? "Criando..." : "Criar conta"}
        </button>
        <p className="save-msg" role="alert" aria-live="assertive">
          {error}
        </p>
        <p className="panel-help" style={{ textAlign: "center" }}>
          Já tem conta? <Link to="/">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
