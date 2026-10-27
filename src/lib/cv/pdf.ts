"use client";

import { formatDate } from "@/lib/format";
import type { CvDocument, CvTemplate } from "@/types";

type JsPdf = import("jspdf").jsPDF;

const PAGE_WIDTH = 210;
const MARGIN = 18;
const COLUMN_GAP = 8;
const TOP = 22;
const BOTTOM = 278;

type FontName = "helvetica" | "times" | "courier";
type Rgb = [number, number, number];

interface TemplateStyle {
  font: FontName;
  /** Accent used for headings, the header rule and non-classic titles. */
  accent: Rgb;
  body: Rgb;
  headerAlign: "left" | "center";
  /** Draw a thick accent rule under the header (modern / technical / two-column). */
  headerBorder: boolean;
  /** Skills, certifications, languages and achievements move to a sidebar. */
  twoColumn: boolean;
}

/**
 * Each CV template maps to a distinct PDF look so the exported file matches
 * what the on-screen preview shows. `two-column` renders a sidebar layout.
 */
const TEMPLATE_STYLES: Record<CvTemplate, TemplateStyle> = {
  classic: {
    font: "helvetica",
    accent: [23, 23, 23],
    body: [60, 60, 60],
    headerAlign: "center",
    headerBorder: false,
    twoColumn: false,
  },
  modern: {
    font: "helvetica",
    accent: [37, 99, 235],
    body: [55, 65, 81],
    headerAlign: "left",
    headerBorder: true,
    twoColumn: false,
  },
  technical: {
    font: "courier",
    accent: [17, 24, 39],
    body: [31, 41, 55],
    headerAlign: "left",
    headerBorder: true,
    twoColumn: false,
  },
  "two-column": {
    font: "helvetica",
    accent: [37, 99, 235],
    body: [55, 65, 81],
    headerAlign: "left",
    headerBorder: true,
    twoColumn: true,
  },
};

function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9_\- ]/g, "")
    .replace(/\s+/g, "_");
  return cleaned || "CV";
}

function dateRange(
  start: string | null,
  end: string | null,
  current: boolean,
): string {
  if (!start && !end) return "";
  const fmt = (value: string | null) =>
    value ? formatDate(value, { month: "short", year: "numeric" }) : "—";
  return `${fmt(start)} – ${current ? "Present" : fmt(end)}`;
}

/** Writes wrapped text down a single column, adding pages as it fills. */
class ColumnWriter {
  y: number;

  constructor(
    private readonly pdf: JsPdf,
    private readonly style: TemplateStyle,
    readonly x: number,
    readonly width: number,
    startY: number,
  ) {
    this.y = startY;
  }

  private ensure(needed: number): void {
    if (this.y + needed <= BOTTOM) return;
    this.pdf.addPage("a4", "portrait");
    this.y = MARGIN;
  }

  heading(title: string): void {
    this.ensure(14);
    this.y += 5;
    this.pdf.setFont(this.style.font, "bold");
    this.pdf.setFontSize(11);
    this.pdf.setTextColor(...this.style.accent);
    this.pdf.text(title.toUpperCase(), this.x, this.y);
    this.y += 2.5;
    this.pdf.setDrawColor(...this.style.accent);
    this.pdf.setLineWidth(0.4);
    this.pdf.line(this.x, this.y, this.x + this.width, this.y);
    this.y += 4.5;
    this.pdf.setFont(this.style.font, "normal");
    this.pdf.setFontSize(9.5);
    this.pdf.setTextColor(...this.style.body);
  }

  paragraph(text: string, bold = false): void {
    if (!text) return;
    this.pdf.setFont(this.style.font, bold ? "bold" : "normal");
    const lines = this.pdf.splitTextToSize(text, this.width) as string[];
    for (const line of lines) {
      this.ensure(5.5);
      this.pdf.text(line, this.x, this.y);
      this.y += 4.8;
    }
    this.pdf.setFont(this.style.font, "normal");
  }

  metaLine(left: string, right: string): void {
    const lines = this.pdf.splitTextToSize(
      left,
      Math.max(this.width - 45, 30),
    ) as string[];
    this.ensure(lines.length * 5.5);
    for (const line of lines) {
      this.pdf.text(line, this.x, this.y);
      this.y += 4.8;
    }
    if (right) {
      this.pdf.setFont(this.style.font, "bold");
      this.pdf.text(right, this.x + this.width, this.y - 4.8, {
        align: "right",
      });
      this.pdf.setFont(this.style.font, "normal");
    }
    this.y += 1;
  }
}

function drawHeader(
  pdf: JsPdf,
  style: TemplateStyle,
  doc: CvDocument,
): number {
  const centered = style.headerAlign === "center";
  const x = centered ? PAGE_WIDTH / 2 : MARGIN;
  const options = centered ? { align: "center" as const } : undefined;
  let y = TOP;

  pdf.setFont(style.font, "bold");
  pdf.setFontSize(21);
  pdf.setTextColor(23, 23, 23);
  pdf.text(doc.contact.fullName || "CV", x, y, options);
  y += 8;

  if (doc.title) {
    pdf.setFont(style.font, "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(...(centered ? style.body : style.accent));
    pdf.text(doc.title, x, y, options);
    y += 6.5;
  }

  const contact = [
    doc.contact.email,
    doc.contact.phone,
    doc.contact.location,
    doc.contact.website,
    doc.contact.linkedin,
    doc.contact.github,
  ].filter((item): item is string => Boolean(item));

  if (contact.length > 0) {
    pdf.setFont(style.font, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(90, 90, 90);
    const lines = pdf.splitTextToSize(
      contact.join("  ·  "),
      PAGE_WIDTH - MARGIN * 2,
    ) as string[];
    for (const line of lines) {
      pdf.text(line, x, y, options);
      y += 4.6;
    }
  }

  y += 2;
  if (style.headerBorder) {
    pdf.setDrawColor(...style.accent);
    pdf.setLineWidth(1.2);
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 4;
  }
  return y;
}

function renderSummary(column: ColumnWriter, doc: CvDocument): void {
  if (!doc.sections.summary) return;
  column.heading("Summary");
  column.paragraph(doc.sections.summary);
}

function renderExperience(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.experience.length === 0) return;
  column.heading("Experience");
  for (const entry of doc.sections.experience) {
    column.metaLine(
      entry.role,
      dateRange(entry.startDate, entry.endDate, entry.current),
    );
    if (entry.company) column.paragraph(entry.company, true);
    if (entry.description) column.paragraph(entry.description);
    for (const highlight of entry.highlights) {
      column.paragraph(`•  ${highlight}`);
    }
    if (entry.skills.length > 0) {
      column.paragraph(`Skills: ${entry.skills.join(", ")}`);
    }
    column.y += 2;
  }
}

function renderSkills(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.skillGroups.length === 0) return;
  column.heading("Skills");
  for (const group of doc.sections.skillGroups) {
    column.paragraph(
      `${group.label}: ${group.skills.join(", ")}`,
      group.label.length > 0,
    );
  }
}

function renderEducation(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.education.length === 0) return;
  column.heading("Education");
  for (const entry of doc.sections.education) {
    column.metaLine(entry.degree, dateRange(entry.startDate, entry.endDate, false));
    if (entry.institution) column.paragraph(entry.institution, true);
    if (entry.description) column.paragraph(entry.description);
    column.y += 1;
  }
}

function renderProjects(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.projects.length === 0) return;
  column.heading("Projects");
  for (const project of doc.sections.projects) {
    column.metaLine(
      project.name,
      dateRange(project.startDate, project.endDate, false),
    );
    if (project.url) column.paragraph(project.url);
    if (project.description) column.paragraph(project.description);
    if (project.skills.length > 0) {
      column.paragraph(`Skills: ${project.skills.join(", ")}`);
    }
    column.y += 1;
  }
}

function renderCertifications(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.certifications.length === 0) return;
  column.heading("Certifications");
  for (const cert of doc.sections.certifications) {
    column.paragraph(`${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ""}`);
  }
}

function renderLanguages(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.languages.length === 0) return;
  column.heading("Languages");
  column.paragraph(
    doc.sections.languages
      .map((lang) => (lang.level ? `${lang.name} (${lang.level})` : lang.name))
      .join(", "),
  );
}

function renderAchievements(column: ColumnWriter, doc: CvDocument): void {
  if (doc.sections.achievements.length === 0) return;
  column.heading("Achievements");
  for (const item of doc.sections.achievements) {
    column.paragraph(`•  ${item.text}`);
  }
}

/**
 * Export a CV document to a real, selectable PDF using jsPDF. No server
 * involved — the file is generated entirely in the browser, and the layout
 * follows the document's selected template.
 */
export async function exportCvPdf(doc: CvDocument): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const style = TEMPLATE_STYLES[doc.template] ?? TEMPLATE_STYLES.classic;
  const startY = drawHeader(pdf, style, doc);

  if (style.twoColumn) {
    const available = PAGE_WIDTH - MARGIN * 2 - COLUMN_GAP;
    const sidebarWidth = available * 0.34;
    const mainWidth = available - sidebarWidth;
    const sidebar = new ColumnWriter(pdf, style, MARGIN, sidebarWidth, startY);
    const main = new ColumnWriter(
      pdf,
      style,
      MARGIN + sidebarWidth + COLUMN_GAP,
      mainWidth,
      startY,
    );

    renderSkills(sidebar, doc);
    renderCertifications(sidebar, doc);
    renderLanguages(sidebar, doc);
    renderAchievements(sidebar, doc);

    renderSummary(main, doc);
    renderExperience(main, doc);
    renderEducation(main, doc);
    renderProjects(main, doc);
  } else {
    const column = new ColumnWriter(
      pdf,
      style,
      MARGIN,
      PAGE_WIDTH - MARGIN * 2,
      startY,
    );
    renderSummary(column, doc);
    renderExperience(column, doc);
    renderSkills(column, doc);
    renderEducation(column, doc);
    renderProjects(column, doc);
    renderCertifications(column, doc);
    renderLanguages(column, doc);
    renderAchievements(column, doc);
  }

  pdf.save(`${safeFileName(doc.contact.fullName)}_CV.pdf`);
}
