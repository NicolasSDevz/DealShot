import { calcDeal, formatBRL, formatDateBR, num, type Deal } from "./calc";
import type { CompanyProfile } from "./db";

type RGB = [number, number, number];
const NAVY: RGB = [20, 32, 58];
const BLUE: RGB = [37, 99, 235];
const BLUE_DARK: RGB = [29, 78, 216];
const MUTED: RGB = [103, 114, 138];
const BORDER: RGB = [222, 227, 236];
const BG_SOFT: RGB = [244, 246, 250];
const WHITE: RGB = [255, 255, 255];
const HEADER_SUBTEXT: RGB = [198, 209, 228];

const PAGE_W = 210;
const MARGIN_X = 16;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const HEADER_H = 34;
const FOOTER_Y = 287;

function getImageDimensions(src: string): Promise<{ width: number; height: number; img: HTMLImageElement } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.width, height: img.height, img });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitBox(natW: number, natH: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / natW, maxH / natH);
  return { w: natW * scale, h: natH * scale };
}

// jsPDF só é importado quando alguém realmente gera um PDF -- carregá-lo de cara no bundle
// principal engordava o JS inicial de todo mundo por causa de uma ação que a maioria das
// visitas nunca usa.
async function buildProposalDoc(
  deal: Deal,
  company: CompanyProfile,
  obraNumero: number,
  imgInfo: { width: number; height: number; img: HTMLImageElement } | null,
  includeCosts: boolean,
) {
  const { jsPDF } = await import("jspdf");
  const companyName = company.companyName || "Sua empresa";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const calc = calcDeal(deal);
  let y = 0;
  let page = 1;

  function drawHeader() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, PAGE_W, HEADER_H, "F");

    let textX = MARGIN_X;
    if (imgInfo) {
      const chipSize = 22;
      doc.setFillColor(...WHITE);
      doc.roundedRect(MARGIN_X, (HEADER_H - chipSize) / 2, chipSize, chipSize, 2, 2, "F");
      const box = fitBox(imgInfo.width, imgInfo.height, chipSize - 5, chipSize - 5);
      doc.addImage(imgInfo.img, MARGIN_X + (chipSize - box.w) / 2, (HEADER_H - box.h) / 2, box.w, box.h);
      textX = MARGIN_X + chipSize + 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text(companyName, textX, HEADER_H / 2 - 2);

    const companyLine = [company.cnpj && `CNPJ ${company.cnpj}`, company.endereco, company.telefone, company.email]
      .filter(Boolean)
      .join("   •   ");
    if (companyLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...HEADER_SUBTEXT);
      doc.text(doc.splitTextToSize(companyLine, PAGE_W - textX - MARGIN_X - 45), textX, HEADER_H / 2 + 5);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(includeCosts ? "ORÇAMENTO INTERNO" : "ORÇAMENTO", PAGE_W - MARGIN_X, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...HEADER_SUBTEXT);
    doc.text(`Obra Nº ${obraNumero}`, PAGE_W - MARGIN_X, 19, { align: "right" });
    doc.text(new Date().toLocaleDateString("pt-BR"), PAGE_W - MARGIN_X, 24, { align: "right" });

    y = HEADER_H + 12;
  }

  function drawFooter() {
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN_X, FOOTER_Y - 4, PAGE_W - MARGIN_X, FOOTER_Y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const agora = new Date();
    const geradoEm = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(`Gerado em ${geradoEm} — ${companyName}`, MARGIN_X, FOOTER_Y);
    doc.text(`Página ${page}`, PAGE_W - MARGIN_X, FOOTER_Y, { align: "right" });
  }

  function newPage() {
    drawFooter();
    doc.addPage();
    page += 1;
    drawHeader();
  }

  function ensureSpace(needed: number) {
    if (y + needed > FOOTER_Y - 10) newPage();
  }

  function sectionTitle(title: string) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BLUE_DARK);
    doc.text(title.toUpperCase(), MARGIN_X, y);
    y += 6;
  }

  function infoCard(pairs: [string, string][]) {
    const rowsPerCol = Math.ceil(pairs.length / 2);
    const pad = 6;
    const rowH = 10.5;
    const colW = (CONTENT_W - pad * 2 - 8) / 2;
    const boxH = rowsPerCol * rowH + pad * 2;
    ensureSpace(boxH + 4);

    doc.setFillColor(...BG_SOFT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 3, 3, "FD");

    pairs.forEach(([label, value], i) => {
      const col = i < rowsPerCol ? 0 : 1;
      const row = i % rowsPerCol;
      const cellX = MARGIN_X + pad + col * (colW + 8);
      const cellY = y + pad + row * rowH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), cellX, cellY + 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(doc.splitTextToSize(value, colW)[0] || value, cellX, cellY + 8.5);
    });

    y += boxH + 9;
  }

  function noteBox(text: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, CONTENT_W - 12);
    const boxH = lines.length * 5 + 10;
    ensureSpace(boxH + 4);
    doc.setFillColor(...BG_SOFT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 3, 3, "FD");
    doc.setTextColor(60, 68, 84);
    doc.text(lines, MARGIN_X + 6, y + 7);
    y += boxH + 9;
  }

  type TableRow = { label: string; value: string; emphasis?: boolean };

  function costsTable(rows: TableRow[]) {
    const headerH = 8;
    const rowH = 7.5;
    ensureSpace(headerH + rowH + 2);

    doc.setFillColor(...BLUE);
    doc.rect(MARGIN_X, y, CONTENT_W, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text("ITEM", MARGIN_X + 4, y + 5.5);
    doc.text("VALOR", PAGE_W - MARGIN_X - 4, y + 5.5, { align: "right" });
    y += headerH;

    rows.forEach((row, i) => {
      ensureSpace(rowH + 2);
      if (row.emphasis) {
        doc.setFillColor(...BG_SOFT);
        doc.rect(MARGIN_X, y, CONTENT_W, rowH, "F");
      } else if (i % 2 === 1) {
        doc.setFillColor(250, 251, 253);
        doc.rect(MARGIN_X, y, CONTENT_W, rowH, "F");
      }
      doc.setFont("helvetica", row.emphasis ? "bold" : "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      doc.text(row.label, MARGIN_X + 4, y + 5.2);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(row.emphasis ? BLUE_DARK[0] : NAVY[0], row.emphasis ? BLUE_DARK[1] : NAVY[1], row.emphasis ? BLUE_DARK[2] : NAVY[2]);
      doc.text(row.value, PAGE_W - MARGIN_X - 4, y + 5.2, { align: "right" });
      y += rowH;
    });
    doc.setDrawColor(...BORDER);
    doc.rect(MARGIN_X, y - rows.length * rowH - headerH, CONTENT_W, rows.length * rowH + headerH);
    y += 9;
  }

  function priceBanner(label: string, value: string) {
    const boxH = 26;
    ensureSpace(boxH + 4);
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 3, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...HEADER_SUBTEXT);
    doc.text(label.toUpperCase(), MARGIN_X + 8, y + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...WHITE);
    doc.text(value, MARGIN_X + 8, y + 20);
    y += boxH + 8;
  }

  drawHeader();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(deal.obraNome || "Orçamento de serviço", MARGIN_X, y);
  y += 9;

  if (company.descricao) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(company.descricao, CONTENT_W);
    ensureSpace(lines.length * 4.5 + 4);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 4.5 + 6;
  }

  const autoridade = [
    num(company.anosExperiencia) > 0 ? `${company.anosExperiencia}+ anos de experiência` : null,
    num(company.obrasEntregues) > 0 ? `${company.obrasEntregues}+ obras entregues` : null,
  ].filter(Boolean);
  if (autoridade.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE_DARK);
    ensureSpace(8);
    doc.text(autoridade.join("   •   "), MARGIN_X, y);
    y += 8;
  }

  sectionTitle("Dados do cliente e da obra");
  infoCard([
    ["Cliente", deal.clientName || "-"],
    ["Tipo de imóvel", deal.clientType || "-"],
    ["Endereço", deal.endereco || "-"],
    ["Responsável pelo serviço", deal.responsavel || "-"],
    ["Tamanho do local", `${deal.metragem || 0} m²`],
    ["Duração do serviço", `${deal.dias || 0} dia(s)`],
    ["Data da visita técnica", formatDateBR(deal.dataVisitaTecnica)],
    ["Início do serviço", formatDateBR(deal.dataInicio)],
    ["Previsão de término", formatDateBR(deal.dataTermino)],
  ]);

  if (deal.observacoesVisita) {
    sectionTitle("Observações da vistoria");
    noteBox(deal.observacoesVisita);
  }

  if (includeCosts) {
    sectionTitle("Resumo de custos (uso interno)");
    const rows: TableRow[] = [
      { label: "Equipe", value: formatBRL(calc.maoDeObraTotal) },
    ];
    if (calc.encargosTotal > 0) rows.push({ label: "Encargos", value: formatBRL(calc.encargosTotal) });
    if (calc.proLaboreTotal > 0) rows.push({ label: "Pró-labore do responsável", value: formatBRL(calc.proLaboreTotal) });
    rows.push({ label: "Transporte e alimentação", value: formatBRL(calc.apoioTotal) });
    (deal.produtos || [])
      .filter((p) => p.nome || p.valorUnitario)
      .forEach((p) => {
        const qtd = Number(p.quantidade) || 1;
        const subtotal = qtd * (Number(p.valorUnitario) || 0);
        rows.push({ label: `Produto: ${p.nome || "-"} (${qtd}x)`, value: formatBRL(subtotal) });
      });
    rows.push({ label: "Materiais (total)", value: formatBRL(calc.materiaisTotal) });
    if (calc.gorduraValor > 0) rows.push({ label: "Gordura de segurança", value: formatBRL(calc.gorduraValor) });
    rows.push({ label: "Custo total do serviço", value: formatBRL(calc.custosOperacionais), emphasis: true });
    if (calc.impostoTotal > 0) rows.push({ label: "Imposto sobre a venda", value: formatBRL(calc.impostoTotal) });
    rows.push({ label: "Lucro estimado", value: formatBRL(calc.lucroRS), emphasis: true });
    rows.push({ label: "Margem real", value: `${(calc.margemReal * 100).toFixed(1)}%`, emphasis: true });
    costsTable(rows);
  }

  if (deal.ofertarPremium && num(deal.premiumValor) > 0) {
    sectionTitle("Opções de investimento");
    if (deal.premiumDescricao) {
      noteBox(`A opção Premium inclui: ${deal.premiumDescricao}`);
    }
    priceBanner("Opção Padrão", formatBRL(calc.valorFinal));
    priceBanner("Opção Premium", formatBRL(num(deal.premiumValor)));
  } else {
    priceBanner("Valor final da proposta", formatBRL(calc.valorFinal));
  }

  drawFooter();

  const nomeArquivo = (deal.clientName || "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const sufixo = includeCosts ? "interno" : "cliente";
  return { doc, fileName: `orcamento-obra-${obraNumero}-${nomeArquivo || "cliente"}-${sufixo}.pdf` };
}

async function buildProposalPdf(deal: Deal, company: CompanyProfile, obraNumero: number, includeCosts: boolean) {
  const imgInfo = company.logoUrl ? await getImageDimensions(company.logoUrl) : null;
  return buildProposalDoc(deal, company, obraNumero, imgInfo, includeCosts);
}

/** PDF limpo pra mandar ao cliente — sem detalhamento de custos nem margem. */
export async function downloadClientPdf(deal: Deal, company: CompanyProfile, obraNumero: number) {
  const { doc, fileName } = await buildProposalPdf(deal, company, obraNumero, false);
  doc.save(fileName);
}

/** PDF completo, com o detalhamento de custos e margem — só pra uso interno da empresa. */
export async function downloadInternalPdf(deal: Deal, company: CompanyProfile, obraNumero: number) {
  const { doc, fileName } = await buildProposalPdf(deal, company, obraNumero, true);
  doc.save(fileName);
}

export async function getProposalPdfBlob(deal: Deal, company: CompanyProfile, obraNumero: number) {
  const { doc, fileName } = await buildProposalPdf(deal, company, obraNumero, false);
  return { blob: doc.output("blob") as Blob, fileName };
}
