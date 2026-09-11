import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LogoUploadError, type CompanyProfile } from "../lib/db";
import { formatCpfCnpj } from "../lib/calc";

/** Lê o arquivo como data URL (base64) -- usado pra logo "só nesta sessão", sem subir pro Storage. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  initial: CompanyProfile;
  onSave: (data: Omit<CompanyProfile, "logoUrl">, logoFile: File | null) => Promise<void>;
  onCancel?: () => void;
  /** Quando true, não desenha o wrapper de tela cheia (usado dentro de um Modal). */
  bare?: boolean;
  /** Falso no plano Teste: a logo não sobe pro Storage, só é usada localmente nos PDFs desta sessão. */
  canSaveLogo?: boolean;
  /** Chamado com a logo em base64 quando canSaveLogo é false -- fica só na tela, nunca vai pro banco. */
  onLogoPreviewOnly?: (dataUrl: string) => void;
}

export default function CompanySetupForm({ initial, onSave, onCancel, bare = false, canSaveLogo = true, onLogoPreviewOnly }: Props) {
  const [name, setName] = useState(initial.companyName || "");
  const [cnpj, setCnpj] = useState(initial.cnpj || "");
  const [endereco, setEndereco] = useState(initial.endereco || "");
  const [telefone, setTelefone] = useState(initial.telefone || "");
  const [email, setEmail] = useState(initial.email || "");
  const [descricao, setDescricao] = useState(initial.descricao || "");
  const [anosExperiencia, setAnosExperiencia] = useState(initial.anosExperiencia || "");
  const [obrasEntregues, setObrasEntregues] = useState(initial.obrasEntregues || "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deriva a prévia a partir do arquivo escolhido, em vez de guardar a URL num state à parte
  // (que exigia um efeito só pra sincronizar) -- o efeito abaixo só cuida da revogação.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : initial.logoUrl || null), [file, initial.logoUrl]);

  useEffect(() => {
    if (!file) return;
    return () => URL.revokeObjectURL(previewUrl!);
  }, [file, previewUrl]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMsg("Informe o nome da empresa.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const textData = {
        companyName: name.trim(),
        cnpj: cnpj.trim(),
        endereco: endereco.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        descricao: descricao.trim(),
        anosExperiencia: anosExperiencia.trim(),
        obrasEntregues: obrasEntregues.trim(),
      };
      if (file && !canSaveLogo) {
        // Plano Teste: não sobe a logo pro Storage -- só guarda em base64 na tela, pra usar
        // nos PDFs gerados agora. Some se recarregar a página ou trocar de conta.
        onLogoPreviewOnly?.(await fileToDataUrl(file));
        await onSave(textData, null);
      } else {
        await onSave(textData, file);
      }
    } catch (err) {
      console.error("Falha ao salvar dados da empresa", err);
      setMsg(err instanceof LogoUploadError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <form className="panel auth-panel" onSubmit={handleSubmit}>
      <h2 className="panel-title">Dados da empresa</h2>
      <p className="panel-help" style={{ marginTop: 0 }}>
        Aparecem no PDF de todos os orçamentos.
      </p>
      <div className="field">
        <label htmlFor="company-name">Nome da empresa (obrigatório)</label>
        <input id="company-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Limpa Tudo Serviços" required />
      </div>
      <div className="field">
        <label htmlFor="company-cnpj">CNPJ (opcional)</label>
        <input id="company-cnpj" className="input" value={cnpj} onChange={(e) => setCnpj(formatCpfCnpj(e.target.value))} placeholder="00.000.000/0001-00" />
      </div>
      <div className="field">
        <label htmlFor="company-endereco">Endereço (opcional)</label>
        <input id="company-endereco" className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, cidade" />
      </div>
      <div className="field">
        <label htmlFor="company-telefone">Telefone (opcional)</label>
        <input id="company-telefone" className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
      </div>
      <div className="field">
        <label htmlFor="company-email">E-mail de contato (opcional)</label>
        <input id="company-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
      </div>
      <div className="field">
        <label htmlFor="company-descricao">Descrição da empresa (opcional)</label>
        <textarea
          id="company-descricao"
          className="input"
          rows={2}
          style={{ resize: "vertical" }}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Mais de 10 anos de experiência em limpeza pós-obra, atendendo toda a região."
        />
        <p className="microlabel" style={{ marginTop: 4 }}>
          Aparece logo abaixo do nome da empresa, no início do PDF dos orçamentos.
        </p>
      </div>
      <div className="cost-group-fields" style={{ marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="company-anos">Há quantos anos no mercado (opcional)</label>
          <input
            id="company-anos"
            className="input"
            type="number"
            min={0}
            value={anosExperiencia}
            onChange={(e) => setAnosExperiencia(e.target.value)}
            placeholder="Ex: 8"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="company-obras">Quantas obras já entregou (opcional)</label>
          <input
            id="company-obras"
            className="input"
            type="number"
            min={0}
            value={obrasEntregues}
            onChange={(e) => setObrasEntregues(e.target.value)}
            placeholder="Ex: 80"
          />
        </div>
      </div>
      <p className="microlabel" style={{ margin: "-10px 0 16px" }}>
        Viram diferenciais automáticos na apresentação e no PDF (ex: "Mais de 8 anos de experiência"). Deixe em branco pra não mostrar.
      </p>
      <div className="field">
        <span id="company-logo-label">Logo da empresa (opcional)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Escolher ou trocar a logo da empresa"
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              border: "1px dashed var(--n-700)",
              background: "var(--n-950)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              padding: 0,
            }}
            title="Escolher logo"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Prévia da logo atual" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span className="microlabel" aria-hidden="true">
                Logo
              </span>
            )}
          </button>
          <div>
            <button type="button" className="link-btn" onClick={() => fileInputRef.current?.click()}>
              {previewUrl ? "Trocar logo" : "Escolher logo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-labelledby="company-logo-label"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="save-btn" type="submit" style={{ width: "100%" }} disabled={saving}>
          Salvar {onCancel ? "" : "e continuar"}
        </button>
        {onCancel && (
          <button className="link-btn" type="button" onClick={onCancel}>
            cancelar
          </button>
        )}
      </div>
      <p className={`save-msg${msg.startsWith("Não") ? " is-error" : ""}`} role="status" aria-live="polite">
        {msg}
      </p>
    </form>
  );

  if (bare) return content;
  return <div className="auth-screen">{content}</div>;
}
