import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calcDeal, formatBRL, num, type Deal } from "../lib/calc";

interface Props {
  deal: Deal;
  companyName: string;
  logoUrl?: string | null;
  /** "Há quantos anos no mercado" cadastrado no perfil da empresa -- vira diferencial automático. */
  anosExperiencia?: string;
  /** "Quantas obras já entregou" -- idem. */
  obrasEntregues?: string;
  onClose: () => void;
}

const DIFERENCIAIS = [
  "Vistoria técnica prévia — nada é orçado no chute",
  "Equipe especializada por tipo de superfície",
  "Registro fotográfico antes e depois",
  "Escopo detalhado — o que está incluso e o que não está",
  "Produtos com ficha técnica de segurança",
];

export default function PresentationView({ deal, companyName, logoUrl, anosExperiencia, obrasEntregues, onClose }: Props) {
  const calc = calcDeal(deal);
  const hasPremium = deal.ofertarPremium && num(deal.premiumValor) > 0;
  // Autoridade: se a empresa cadastrou tempo de mercado/obras entregues, isso entra como os
  // primeiros diferenciais (prova concreta pesa mais que qualificação genérica) -- senão a lista
  // fica só com os diferenciais padrão.
  const diferenciais = [
    ...(num(anosExperiencia) > 0 ? [`Mais de ${anosExperiencia} anos de experiência em limpeza pós-obra`] : []),
    ...(num(obrasEntregues) > 0 ? [`Mais de ${obrasEntregues} obras entregues com sucesso`] : []),
    ...DIFERENCIAIS,
  ];
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slides = [
    // 1. Abertura
    <div className="pres-slide" key="s0">
      {logoUrl ? <img src={logoUrl} alt="" className="pres-logo" /> : null}
      <p className="pres-eyebrow">{companyName || "Sua empresa"}</p>
      <h1 className="pres-title">Proposta para {deal.clientName || "o cliente"}</h1>
      {deal.obraNome && <p className="pres-sub">{deal.obraNome}</p>}
    </div>,

    // 2. Diagnóstico (usa as observações da vistoria — "retome o problema do cliente")
    <div className="pres-slide" key="s1">
      <p className="pres-eyebrow">O que encontramos na vistoria</p>
      <h2 className="pres-h2">Diagnóstico</h2>
      <p className="pres-body">
        {deal.observacoesVisita || `Local de ${deal.metragem || "-"} m², serviço com duração estimada de ${deal.dias || "-"} dia(s).`}
      </p>
    </div>,

    // 3. Escopo do serviço
    <div className="pres-slide" key="s2">
      <p className="pres-eyebrow">Nossa solução</p>
      <h2 className="pres-h2">O que está incluído</h2>
      <ul className="pres-list">
        <li>Limpeza pós-obra completa — {deal.metragem || "-"} m²</li>
        <li>Equipe dedicada por {deal.dias || "-"} dia(s)</li>
        <li>Produtos e materiais próprios para cada superfície</li>
        {deal.dataVisitaTecnica && <li>Início após vistoria técnica agendada</li>}
      </ul>
    </div>,

    // 4. Diferenciais
    <div className="pres-slide" key="s3">
      <p className="pres-eyebrow">Por que fechar com a gente</p>
      <h2 className="pres-h2">Diferenciais</h2>
      <ul className="pres-list">
        {diferenciais.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>,

    // 5. Preço -- sem detalhamento de custo, e com uma segunda opção (Premium) quando ativada,
    // pra ancorar o preço: o cliente compara as duas opções entre si, não com o concorrente.
    hasPremium ? (
      <div className="pres-slide" key="s4">
        <p className="pres-eyebrow">Escolha sua opção</p>
        <div className="pres-price-options">
          <div className="pres-price-card">
            <p className="pres-price-card-label">Padrão</p>
            <p className="pres-price-card-value">{formatBRL(calc.valorFinal)}</p>
            <p className="pres-price-card-note">Escopo completo, conforme descrito</p>
          </div>
          <div className="pres-price-card premium">
            <p className="pres-price-card-label">Premium</p>
            <p className="pres-price-card-value">{formatBRL(num(deal.premiumValor))}</p>
            <p className="pres-price-card-note">{deal.premiumDescricao || "Inclui tudo da opção Padrão + benefícios extras"}</p>
          </div>
        </div>
        <p className="pres-sub">Proposta válida por 5 dias</p>
      </div>
    ) : (
      <div className="pres-slide" key="s4">
        <p className="pres-eyebrow">Investimento total</p>
        <p className="pres-price">{formatBRL(calc.valorFinal)}</p>
        <p className="pres-sub">Proposta válida por 5 dias</p>
      </div>
    ),

    // 6. Fechamento
    <div className="pres-slide" key="s5">
      <h2 className="pres-h2">Podemos agendar?</h2>
      <p className="pres-body">
        Fale com a gente pelo WhatsApp pra confirmar a data e fechar o serviço — responda <strong>SIM</strong> nessa conversa que já
        agendamos o início.
      </p>
    </div>,
  ];

  function next() {
    setSlide((s) => Math.min(s + 1, slides.length - 1));
  }
  function prev() {
    setSlide((s) => Math.max(s - 1, 0));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  // Portal pra <body>: sem isso, o overlay "position: fixed" fica preso dentro de qualquer
  // ancestral com transform/filter (ex: o hover do card no Kanban), que vira um novo containing
  // block e faz a apresentação renderizar espremida dentro do card em vez de em tela cheia.
  return createPortal(
    <div
      className="pres-overlay"
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const diff = e.changedTouches[0].clientX - touchStartX.current;
        if (diff > 50) prev();
        if (diff < -50) next();
        touchStartX.current = null;
      }}
    >
      <button className="pres-close" onClick={onClose} aria-label="Fechar apresentação">
        ×
      </button>

      <div className="pres-content" onClick={(e) => (e.clientX > window.innerWidth / 2 ? next() : prev())}>
        {slides[slide]}
      </div>

      <div className="pres-nav">
        <button onClick={prev} disabled={slide === 0} aria-label="Anterior">
          ‹
        </button>
        <div className="pres-dots">
          {slides.map((_, i) => (
            <span key={i} className={`pres-dot${i === slide ? " active" : ""}`} />
          ))}
        </div>
        <button onClick={next} disabled={slide === slides.length - 1} aria-label="Próximo">
          ›
        </button>
      </div>
    </div>,
    document.body,
  );
}
