import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendBrandedAuthEmail } from "../lib/db";
import { useAuth } from "../context/useAuth";
import { EyeIcon, EyeOffIcon } from "../components/Icons";

export default function LoginPage({ adminHint = false }: { adminHint?: boolean }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, senha);
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setResetError(true);
      setResetMsg("Digite seu e-mail ali em cima primeiro.");
      return;
    }
    setSendingReset(true);
    setResetError(false);
    setResetMsg("");
    try {
      await sendBrandedAuthEmail(email.trim(), "reset");
      setResetMsg("Se esse e-mail tiver uma conta, você vai receber um link pra redefinir a senha.");
    } catch (err) {
      console.error("Falha ao enviar e-mail de redefinição de senha", err);
      setResetError(true);
      setResetMsg("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="panel auth-panel" onSubmit={handleSubmit}>
        <h2 className="panel-title">{adminHint ? "Entrar como admin" : "Entrar"}</h2>
        {!adminHint && (
          <p className="panel-help" style={{ marginTop: 0 }}>
            Ainda não tem conta? <Link to="/signup">Criar conta</Link>
          </p>
        )}
        <div className="field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Senha</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="login-password"
              className="input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
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
        <div style={{ textAlign: "right", marginTop: -8, marginBottom: 12 }}>
          <button type="button" className="link-btn" onClick={handleForgotPassword} disabled={sendingReset}>
            {sendingReset ? "Enviando..." : "Esqueceu a senha?"}
          </button>
        </div>
        <button className="save-btn" type="submit" style={{ width: "100%" }} disabled={submitting}>
          Entrar
        </button>
        <p className="save-msg is-error" role="alert" aria-live="assertive">
          {error}
        </p>
        <p className={`save-msg${resetError ? " is-error" : ""}`} role="status" aria-live="polite">
          {resetMsg}
        </p>
      </form>
    </div>
  );
}
