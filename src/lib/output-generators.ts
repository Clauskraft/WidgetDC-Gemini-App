/**
 * Client-side document generators — PPTX, DOCX, XLSX, HTML.
 * Ported from widgetdc-consulting-frontend/src/components/chat/OutputCreator.tsx.
 * Pure functions — no side effects, no fetch, no server deps.
 */

export type DocTheme = "modern" | "mckinsey" | "bcg" | "bain" | "dark";

interface Section {
  heading: string;
  level: number;
  lines: string[];
}

interface Slide {
  title: string;
  bullets: string[];
}

const THEME_COLORS: Record<DocTheme, { primary: string; bg: string; text: string }> = {
  modern: { primary: "#3b82f6", bg: "#0f172a", text: "#f8fafc" },
  mckinsey: { primary: "#6366f1", bg: "#1e1b4b", text: "#eef2ff" },
  bcg: { primary: "#10b981", bg: "#064e3b", text: "#ecfdf5" },
  bain: { primary: "#ef4444", bg: "#1c0707", text: "#fef2f2" },
  dark: { primary: "#94a3b8", bg: "#0f172a", text: "#e2e8f0" },
};

export function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/_{2}(.*?)_{2}/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .trim();
}

export function parseContentSections(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let current: Section = { heading: "Overview", level: 1, lines: [] };
  let inCodeFence = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      current.lines.push(line);
      continue;
    }
    const headingMatch = /^(#{1,3})\s+(.+)/.exec(line);
    if (headingMatch) {
      if (current.lines.length > 0 || sections.length > 0) sections.push(current);
      current = {
        heading: cleanMarkdown(headingMatch[2]),
        level: headingMatch[1].length,
        lines: [],
      };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

export function extractTextContent(lines: string[]): string[] {
  return lines
    .map((l) =>
      l
        .replace(/^[-*•▸]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .trim(),
    )
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export function extractTitle(content: string): string {
  const first = content.split("\n").find((l) => l.trim().length > 0) ?? "Deliverable";
  return cleanMarkdown(first.replace(/^#+\s+/, "")).slice(0, 60);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PPTX (HTML landscape slides) ─────────────────────────────────────────────

export function generatePPTX(content: string, theme: DocTheme = "modern"): Blob {
  const { primary, bg, text } = THEME_COLORS[theme];
  const sections = parseContentSections(content);
  const title = extractTitle(content);

  const slides: Slide[] = [{ title, bullets: [] }];
  for (const sec of sections) {
    const bullets = extractTextContent(sec.lines);
    if (bullets.length === 0 && sec.heading === "Overview") continue;
    const chunks: string[][] = [];
    for (let i = 0; i < bullets.length; i += 6) chunks.push(bullets.slice(i, i + 6));
    if (chunks.length === 0) chunks.push([]);
    chunks.forEach((chunk, idx) => {
      slides.push({ title: sec.heading + (idx > 0 ? " (forts.)" : ""), bullets: chunk });
    });
  }

  const renderSlide = (slide: Slide, isTitle: boolean) => `
    <div class="slide">
      <h1 style="color:${primary};border-left:4px solid ${primary};padding-left:12px">${escapeXml(slide.title)}</h1>
      ${isTitle ? `<p style="color:${text};opacity:0.6;font-size:1.1rem;margin-top:8px">Genereret af WidgeTDC Aurora</p>` : ""}
      ${slide.bullets.length > 0 ? `<ul>${slide.bullets.map((b) => `<li>${escapeXml(b)}</li>`).join("")}</ul>` : ""}
    </div>
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: landscape; margin: 0; }
    body { margin: 0; font-family: Calibri, Arial, sans-serif; background: ${bg}; color: ${text}; }
    .slide { page-break-after: always; width: 100vw; height: 100vh; display: flex; flex-direction: column;
             justify-content: center; padding: 48px 64px; box-sizing: border-box;
             background: linear-gradient(135deg, ${bg}, ${bg}dd); }
    h1 { font-size: 2rem; margin: 0 0 24px; font-weight: 700; line-height: 1.2; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 8px 0; font-size: 1.1rem; display: flex; align-items: flex-start; gap: 10px; }
    li::before { content: "▸"; color: ${primary}; flex-shrink: 0; font-weight: bold; }
  </style></head><body>${slides.map((s, i) => renderSlide(s, i === 0)).join("")}</body></html>`;

  return new Blob([html], { type: "text/html;charset=utf-8" });
}

// ── DOCX (Word-compatible HTML) ───────────────────────────────────────────────

export function contentToHtmlBody(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("```")) {
      inCode = !inCode;
      if (!inCode) out.push("</pre>");
      else {
        out.push("<pre>");
        closeList();
      }
      continue;
    }
    if (inCode) {
      out.push(escapeXml(line));
      continue;
    }

    const h3 = /^###\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    const h1 = /^#\s+(.+)/.exec(line);
    const li = /^[-*•▸]\s+(.+)/.exec(line);
    const num = /^\d+\.\s+(.+)/.exec(line);

    if (h1) {
      closeList();
      out.push(`<h1>${escapeXml(cleanMarkdown(h1[1]))}</h1>`);
    } else if (h2) {
      closeList();
      out.push(`<h2>${escapeXml(cleanMarkdown(h2[1]))}</h2>`);
    } else if (h3) {
      closeList();
      out.push(`<h3>${escapeXml(cleanMarkdown(h3[1]))}</h3>`);
    } else if (li || num) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeXml(cleanMarkdown((li ?? num)![1]))}</li>`);
    } else if (line.length === 0) {
      closeList();
    } else {
      closeList();
      out.push(`<p>${escapeXml(cleanMarkdown(line))}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

export function generateDOCX(content: string, theme: DocTheme = "modern"): Blob {
  const { primary } = THEME_COLORS[theme];
  const title = extractTitle(content);
  const body = contentToHtmlBody(content);

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>${escapeXml(title)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Calibri, Arial; font-size: 11pt; color: #1e293b; margin: 72pt; }
    h1 { font-size: 18pt; color: ${primary}; border-bottom: 2px solid ${primary}; padding-bottom: 4pt; }
    h2 { font-size: 14pt; color: ${primary}; margin-top: 16pt; }
    h3 { font-size: 12pt; color: #334155; }
    p { line-height: 1.6; margin: 6pt 0; }
    ul { margin: 0; padding-left: 18pt; }
    li { margin: 4pt 0; }
    pre { font-family: Consolas, monospace; background: #f1f5f9; padding: 8pt; font-size: 9pt; }
  </style></head><body>${body}</body></html>`;

  return new Blob(["﻿" + html], { type: "application/vnd.ms-word;charset=utf-8" });
}

// ── XLSX (HTML table) ─────────────────────────────────────────────────────────

export function generateXLSX(content: string): Blob {
  const tableMatch = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;
  const tables: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tableMatch.exec(content)) !== null) {
    const header = match[1]
      .split("|")
      .map((c) => `<th>${escapeXml(c.trim())}</th>`)
      .join("");
    const rows = match[2]
      .trim()
      .split("\n")
      .map(
        (row) =>
          "<tr>" +
          row
            .split("|")
            .filter((_, i, a) => i > 0 && i < a.length - 1)
            .map((c) => `<td>${escapeXml(c.trim())}</td>`)
            .join("") +
          "</tr>",
      )
      .join("");
    tables.push(
      `<table border="1"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table><br>`,
    );
  }

  if (tables.length === 0) {
    const lines = content.split("\n").filter((l) => l.match(/^[-*•▸]\s+.+:\s+.+/));
    if (lines.length > 0) {
      const rows = lines
        .map((l) => {
          const [key, ...rest] = l.replace(/^[-*•▸]\s+/, "").split(":");
          return `<tr><td>${escapeXml(key.trim())}</td><td>${escapeXml(rest.join(":").trim())}</td></tr>`;
        })
        .join("");
      tables.push(
        `<table border="1"><thead><tr><th>Nøgle</th><th>Værdi</th></tr></thead><tbody>${rows}</tbody></table>`,
      );
    }
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
  </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>td,th{padding:6pt 8pt;font-family:Calibri;font-size:10pt}th{background:#3b82f6;color:#fff;font-weight:bold}</style>
  </head><body>${tables.join("") || "<p>Ingen tabeldata fundet i indholdet.</p>"}</body></html>`;

  return new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
}

// ── Action-headline enforcement ────────────────────────────────────────────────
// Converts topic headlines ("Revenue Analysis") to governing-thought headlines
// ("Revenue decline er channel-driven, ikke volume-driven").
// Called client-side post-generation; uses platform LLM via MCP proxy.

export type HeadlineSlide = { title: string; governing_thought: string; key_points: string[] };

export function parseOutlineFromMarkdown(markdown: string): HeadlineSlide[] {
  const sections = parseContentSections(markdown);
  return sections
    .filter((s) => s.heading !== "Overview" || s.lines.some((l) => l.trim().length > 0))
    .map((s) => ({
      title: s.heading,
      governing_thought: "",
      key_points: extractTextContent(s.lines).slice(0, 6),
    }));
}

export function applyGoverningThoughts(
  slides: HeadlineSlide[],
  governingThoughts: string[],
): HeadlineSlide[] {
  return slides.map((slide, i) => ({
    ...slide,
    governing_thought: governingThoughts[i] ?? slide.governing_thought,
  }));
}

export function slidesToMarkdown(slides: HeadlineSlide[]): string {
  return slides
    .map((s) => {
      const headline = s.governing_thought || s.title;
      const points = s.key_points.map((p) => `- ${p}`).join("\n");
      return `## ${headline}\n\n${points}`;
    })
    .join("\n\n");
}
