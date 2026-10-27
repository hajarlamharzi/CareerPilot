"use client";

import { createId } from "@/lib/id";
import { canonicalSkill } from "@/lib/matching/skill-alias";
import type {
  CvDocument,
  CvExtraction,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
} from "@/types";

export class CvParseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CvParseError";
    if (cause !== undefined) this.cause = cause;
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{6,}\d)/;
const LINKEDIN_RE = /linkedin\.com\/in\/[A-Za-z0-9_-]+/;
const GITHUB_RE = /github\.com\/[A-Za-z0-9_-]+/;
const URL_RE = /https?:\/\/[^\s<>"']+/g;
/** e.g. "Mar 2020 – Jun 2023" or "2020 - present" or "2018-2021" or "2022 - Présent" */
const DATE_RANGE_RE =
  /((?:[A-Z][a-z]{2,}\.?\s+)?(?:19|20)\d{2})\s*[-–—to/]+\s*((?:[A-Z][a-z]{2,}\.?\s+)?(?:19|20)\d{2}|present|current|now|aujourd'?hui|en\s+cours|actuel|actuellement|présent|present)\b/i;
const YEAR_ONLY_RE = /\b(19|20)\d{2}\b/;
const ROLE_KEYWORDS =
  /\b(engineer|developer|designer|analyst|architect|intern|manager|scientist|administrator|consultant|specialist|lead|tester|director|founder|officer|assistant|technician|accountant|nurse|teacher|chef|writer|editor|marketer|ingénieur|ingenieur|développeur|developpeur|développeuse|developpeuse|designer|analyste|architecte|stagiaire|gestionnaire|scientifique|consultant|spécialiste|specialiste|responsable|directeur|directrice|assistant|assistante|technicien|technicienne|comptable|infirmier|infirmière|enseignant|enseignante|rédacteur|rédactrice|chargé|chargée|gérant|gérante)\b/i;
/** Degree/qualification markers, English and French. */
const DEGREE_KEYWORDS =
  /\b(bsc|msc|ba|ma|b\.?a|m\.?a|phd|beng|meng|hnd|bachelor|master|doctorate|engineer(?:'s)? (?:degree|school)|degree|diploma|high school|associate|licence|license|licenciatura|bts|dut|deug|dut|master|magistère|magistere|ingénieur|ingenieur|doctorat|docteur|baccalauréat|baccalaureat|bac|cap|bep|dea|dess|certificat|diplôme|diplome|université|universite|école|ecole|faculté|faculte)\b/i;

/** Section buckets a CV body line can be assigned to. */
type CvSectionKey =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "projects"
  | "certifications"
  | "languages"
  | "achievements";

const SECTION_RULES: { key: CvSectionKey; patterns: RegExp[] }[] = [
  {
    key: "summary",
    patterns: [
      /^(?:professional|career|executive)\s+summary$/,
      /^(?:profile|about(?:\s+me)?|objective|resume\s+summary|personal\s+statement)$/,
      /^(?:profil|a\s+propos|objectif|resume|presentation|presentation\s+personnelle)$/,
    ],
  },
  {
    key: "experience",
    patterns: [
      /^(?:(?:work|professional|relevant|employment)\s+)?experience$/,
      /^(?:work|career)\s+history$/,
      /^(?:employment(?:\s+history)?|professional\s+background)$/,
      /^(?:experience(?:\s+professionnelle)?|experiences?\s+professionnelles?)$/,
      /^(?:parcours(?:\s+professionnel)?|emplois?|carriere)$/,
    ],
  },
  {
    key: "skills",
    patterns: [
      /^(?:(?:technical|core|key|professional|hard|soft)\s+)?skills$/,
      /^(?:skills?\s*(?:and|&)\s*(?:tools|technologies|expertise))$/,
      /^(?:technologies|tech\s+stack|technical\s+expertise|competencies|competences)$/,
      /^(?:competences?(?:\s+(?:techniques?|professionnelles?|cles?))?|savoir[- ]faire|outils)$/,
    ],
  },
  {
    key: "education",
    patterns: [
      /^(?:education|educational\s+background|academic\s+background|academics|university|studies)$/,
      /^(?:education\s*(?:and|&)\s*training|training|qualifications?)$/,
      /^(?:formation|etudes|diplomes?|scolarite|parcours\s+(?:academique|scolaire)|cursus)$/,
    ],
  },
  {
    key: "projects",
    patterns: [
      /^(?:projects?|personal\s+projects?|side\s+projects?|portfolio|selected\s+projects?|key\s+projects?)$/,
      /^(?:projets?(?:\s+(?:personnels?|professionnels?|selectionnes?))?|realisations?|portfolio)$/,
    ],
  },
  {
    key: "certifications",
    patterns: [
      /^(?:certifications?|certificates?|licenses?\s*(?:and|&)?\s*certifications?|credentials?)$/,
      /^(?:certifications?\s*(?:and|&)\s*(?:licenses?|training))$/,
      /^(?:certifications?|certificats?|attestations?|habilitations?)$/,
    ],
  },
  {
    key: "languages",
    patterns: [/^(?:languages?|language\s+skills)$/, /^(?:langues?|langues?\s+parlees?)$/],
  },
  {
    key: "achievements",
    patterns: [
      /^(?:achievements?|honou?rs?(?:\s*(?:and|&)\s*awards?)?|awards?|accomplishments?)$/,
      /^(?:distinctions?|recompenses?|prix|realisations?\s+notables?|centres?\s+d.?interets?|interests?|hobbies)$/,
    ],
  },
];

const SKILL_SEPARATOR_RE = /[,|\n;•·]/;

/**
 * Normalize a candidate heading for matching.
 *
 * Real PDF/DOCX extraction is messy: headings arrive in ALL CAPS, with accents
 * (`COMPÉTENCES`), decorative separators (`— PROFIL —`), trailing colons, and
 * sometimes a page number appended. Matching the raw line with `^…$` anchors
 * silently dropped whole sections, which is how an imported CV ended up with
 * only its contact block. We fold accents, lowercase, strip decoration, then
 * match against the same anchor.
 */
function normalizeHeading(line: string): string {
  return line
    .normalize("NFD")
    // Strip combining diacritical marks left behind by NFD.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Drop leading/trailing bullets, dashes, underscores and colons.
    .replace(/^[\s\-–—_*•·|:.]+/, "")
    .replace(/[\s\-–—_*•·|:.]+$/, "")
    // Collapse internal punctuation used as decoration, keeping word spacing.
    .replace(/[|•·]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isHeadingLine(line: string): boolean {
  const normalized = normalizeHeading(line);
  if (!normalized) return false;
  return SECTION_RULES.some((rule) =>
    rule.patterns.some((p) => p.test(normalized)),
  );
}

/**
 * Extract content that shares a line with its heading.
 *
 * Handles both `TECHNICAL SKILLS: Go, Rust` and `PROFIL — Développeuse…`.
 * Returns `null` when the line is a bare heading. The heading is matched
 * against the normalized line, then removed from the original line by the
 * number of *words* it spans, so accents and casing in the remainder survive.
 */
function inlineContentAfterHeading(line: string, key: CvSectionKey): string | null {
  const rule = SECTION_RULES.find((r) => r.key === key);
  if (!rule) return null;

  const stripped = line.replace(/^\s*[\-–—_*•·|:.]+/, "").replace(/[\s\-–—_*•·|:.]+$/, "");
  const normalized = normalizeHeading(line);
  const match = rule.patterns
    .map((pattern) => pattern.exec(normalized))
    .find((candidate) => candidate && candidate.index === 0);
  if (!match) return null;

  const headingWordCount = match[0].split(/\s+/).filter(Boolean).length;
  const strippedWords = stripped.split(/\s+/).filter(Boolean);
  if (strippedWords.length <= headingWordCount) return null;

  const remaining = strippedWords
    .slice(headingWordCount)
    .join(" ")
    .replace(/^[\-–—|:•·]+\s*/, "")
    .trim();
  return remaining || null;
}

function normalizeDate(value: string): string | null {
  const match = /(?:([A-Z][a-z]{2,})\.?\s+)?((?:19|20)\d{2})\b/i.exec(
    value.trim(),
  );
  if (!match) return null;
  const year = match[2];
  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const month = match[1] ? monthMap[match[1].slice(0, 3).toLowerCase()] ?? null : null;
  return month ? `${year}-${String(month).padStart(2, "0")}` : year;
}

function isContactish(line: string): boolean {
  return (
    EMAIL_RE.test(line) ||
    PHONE_RE.test(line) ||
    LINKEDIN_RE.test(line) ||
    GITHUB_RE.test(line) ||
    /@/.test(line)
  );
}

function looksLikeNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60 || isHeadingLine(trimmed)) return false;
  if (isContactish(trimmed)) return false;
  // At least two words, mostly letters, no obvious data.
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 4 && /^[A-Za-zÀ-ÿ'’\-.\s]+$/.test(trimmed);
}

/** Split raw CV text into ordered paragraphs (bullet-safe). */
function toLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitSkillsBlob(value: string): string[] {
  const parts = value
    .split(SKILL_SEPARATOR_RE)
    .map((part) => part.trim())
    .filter(Boolean);
  const result: string[] = [];
  for (const part of parts) {
    const canonical = canonicalSkill(part);
    if (canonical) result.push(canonical);
    else if (part.split(/\s+/).length <= 4) result.push(part);
  }
  return [...new Set(result)];
}

/**
 * Turn raw extracted text into a structured CV candidate. This is a pragmatic
 * local heuristic — it will never be perfect, so every field is editable and
 * every uncertainty is surfaced as a warning.
 */
export function structureCvText(rawText: string): CvExtraction {
  const warnings: string[] = [];
  const lines = toLines(rawText);
  const fullText = rawText;

  // ---- Contact -----------------------------------------------------------
  const email = EMAIL_RE.exec(fullText)?.[0] ?? null;
  const phoneMatch = PHONE_RE.exec(fullText)?.[0] ?? null;
  const phone = phoneMatch ? phoneMatch.replace(/[^+\d]/g, "").slice(0, 15) : null;
  const linkedin = LINKEDIN_RE.exec(fullText)?.[0] ?? null;
  const github = GITHUB_RE.exec(fullText)?.[0] ?? null;
  const website = (URL_RE.exec(fullText)?.[0] ?? null) === linkedin || (URL_RE.exec(fullText)?.[0] ?? null) === github
    ? null
    : URL_RE.exec(fullText)?.[0] ?? null;

  // Name: the first plausible name line, skipping obvious headings/contact lines.
  let name = "";
  for (const line of lines) {
    if (looksLikeNameLine(line)) {
      name = line;
      break;
    }
  }

  // Location: a "City, Region" line without an URL/email.
  let location: string | null = null;
  for (const line of lines.slice(0, 8)) {
    const match = /^([A-Z][a-zA-ZÀ-ÿ'\- ]+),\s*([A-Z]{2}|[A-Z][a-zA-ZÀ-ÿ'\- ]+)\s*$/.exec(line);
    if (match && !line.includes("@") && !URL_RE.test(line)) {
      location = line;
      break;
    }
  }
  if (!location && /\bremote\b/i.test(fullText)) location = "Remote";

  // Title: first line containing a role keyword after the name.
  let title: string | null = null;
  const nameLineIndex = lines.findIndex((line) => line === name);
  for (const line of lines.slice(nameLineIndex + 1, nameLineIndex + 8)) {
    if (ROLE_KEYWORDS.test(line) && !isHeadingLine(line)) {
      title = line.split(/[–\-|,·]/)[0]?.trim() ?? line;
      break;
    }
  }

  // ---- Sections ----------------------------------------------------------
  let currentSection: CvSectionKey | null = null;
  const buckets: Record<CvSectionKey, string[]> = {
    summary: [], experience: [], skills: [], education: [],
    projects: [], certifications: [], languages: [], achievements: [],
  };

  for (const line of lines) {
    const normalized = normalizeHeading(line);
    const match = normalized
      ? SECTION_RULES.find((rule) => rule.patterns.some((p) => p.test(normalized)))
      : undefined;
    if (match) {
      currentSection = match.key;
      // Some exports put content on the same line as the heading
      // ("TECHNICAL SKILLS: Go, Rust"). Keep the remainder in the bucket.
      const inline = inlineContentAfterHeading(line, match.key);
      if (inline) buckets[currentSection].push(inline);
      continue;
    }
    if (currentSection) buckets[currentSection].push(line);
    // Lines before the first heading belong to the contact/header block.
  }

  // ---- Summary -----------------------------------------------------------
  const summary = buckets.summary
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .slice(0, 1200);

  // ---- Skills ------------------------------------------------------------
  const skills = [...new Set(splitSkillsBlob(buckets.skills.join(" ")))].slice(0, 60);

  // ---- Experience --------------------------------------------------------
  const experience: Omit<ExperienceEntry, "id">[] = [];
  let current: Partial<Omit<ExperienceEntry, "id">> | null = null;

  /**
   * Header lines ("Role — Company") usually appear *above* their date range,
   * so a line seen before the first date is buffered here and applied once the
   * range arrives. Without this, every CV written as
   * `Role — Company` / `Jan 2022 – Present` lost its role and was dropped.
   */
  let pendingHeader: string[] = [];

  const applyHeader = (header: string[], entry: Partial<Omit<ExperienceEntry, "id">>) => {
    const text = header.join(" ").trim();
    if (!text) return;
    // "Role at Company" / "Role — Company" / "Role, Company".
    const atSplit = text.split(/\s+(?:at|@|chez)\s+/i);
    if (atSplit.length > 1) {
      entry.role = atSplit[0].trim();
      entry.company = atSplit[1].trim().split(/[,|;]/)[0].trim();
      return;
    }
    const dashSplit = text.split(/\s+(?:—|–|\||-)\s+/);
    if (dashSplit.length > 1) {
      entry.role = dashSplit[0].trim();
      entry.company = dashSplit.slice(1).join(" ").trim();
      return;
    }
    const commaSplit = text.split(/\s*,\s*/);
    if (commaSplit.length > 1 && commaSplit[0].split(/\s+/).length <= 5) {
      entry.role = commaSplit[0].trim();
      entry.company = commaSplit.slice(1).join(", ").trim();
      return;
    }
    entry.role = text;
  };

  for (const line of buckets.experience) {
    const range = DATE_RANGE_RE.exec(line);
    if (range) {
      if (current?.role || current?.company) {
        experience.push(current as Omit<ExperienceEntry, "id">);
      }
      const endValue = /present|current|now|aujourd'?hui|en\s+cours|actuel|présent/i.test(range[2])
        ? null
        : normalizeDate(range[2]);
      current = {
        role: "",
        company: "",
        location: null,
        startDate: normalizeDate(range[1]),
        endDate: endValue,
        current: endValue === null,
        description: "",
        highlights: [],
        skills: [],
      };
      // Header text seen before the range takes priority over the remainder,
      // which may hold the same information in the other order.
      applyHeader(pendingHeader, current);
      pendingHeader = [];
      // The remainder of the line may hold role/company: "Role — Company".
      const remainder = line.replace(range[0], "").replace(/^[\s,\-–—:]+/, "");
      if (!current.role && !current.company && remainder) {
        applyHeader([remainder], current);
      }
      continue;
    }

    if (!current) {
      // Not inside an entry yet: remember the line as a header candidate.
      if (line.trim()) pendingHeader.push(line.trim());
      continue;
    }

    if (/^skills?\s*:/i.test(line)) {
      current.skills = splitSkillsBlob(line.replace(/^skills?\s*:/i, ""));
      continue;
    }
    if (!current.role && ROLE_KEYWORDS.test(line)) {
      current.role = line.split(/\s+(?:at|@)\s+/)[0]?.trim() ?? line;
      if (/(?:at|@)\s+/.test(line)) {
        current.company = line.split(/\s+(?:at|@)\s+/)[1]?.trim().split(/[,|;]/)[0]?.trim() ?? "";
      }
    } else if (/(?:at|@)\s+/.test(line) && !current.company) {
      current.company = line.split(/\s+(?:at|@)\s+/)[1]?.trim().split(/[,|;]/)[0]?.trim() ?? "";
    } else if (YEAR_ONLY_RE.test(line) && /^[A-Za-z][A-Za-z\s\-]+$/.test(line)) {
      if (!current.role) current.role = line;
    } else if (line.startsWith("•") || line.startsWith("-") || line.startsWith("·")) {
      current.highlights = [...(current.highlights ?? []), line.replace(/^[•\-·]\s*/, "")];
    } else if (!current.company && line.length <= 60 && !/[.!?;:]$/.test(line)) {
      // A short line directly after the role is almost always the employer.
      current.company = line;
    } else if (line.length > 40 && !YEAR_ONLY_RE.test(line)) {
      if (current.description) current.description += " " + line;
      else current.description = line;
    }
  }
  if (current?.role || current?.company) {
    experience.push(current as Omit<ExperienceEntry, "id">);
  }
  // A trailing header with no date still describes a real role, so keep it.
  if (pendingHeader.length > 0) {
    const trailing: Partial<Omit<ExperienceEntry, "id">> = {
      role: "",
      company: "",
      location: null,
      startDate: null,
      endDate: null,
      current: false,
      description: "",
      highlights: [],
      skills: [],
    };
    applyHeader(pendingHeader, trailing);
    if (trailing.role) experience.push(trailing as Omit<ExperienceEntry, "id">);
    pendingHeader = [];
  }

  // ---- Education ---------------------------------------------------------
  const education: Omit<EducationEntry, "id">[] = [];
  for (const line of buckets.education) {
    const hasDegree = DEGREE_KEYWORDS.test(line);
    if (hasDegree) {
      education.push({
        degree: line,
        institution: "",
        location: null,
        startDate: null,
        endDate: null,
        description: null,
      });
    } else if (education.length > 0 && !education[education.length - 1].institution) {
      education[education.length - 1].institution = line;
    }
  }

  // ---- Projects ----------------------------------------------------------
  const projects: Omit<ProjectEntry, "id">[] = [];
  for (const line of buckets.projects) {
    const hasUrl = URL_RE.test(line);
    if (hasUrl || (line.length <= 90 && !YEAR_ONLY_RE.test(line))) {
      projects.push({
        name: line.replace(URL_RE, "").replace(/[:\-–—]+$/, "").trim() || line.split(/\s+/)[0],
        description: "",
        url: URL_RE.exec(line)?.[0] ?? null,
        startDate: null,
        endDate: null,
        highlights: [],
        skills: [],
      });
    } else if (projects.length > 0) {
      projects[projects.length - 1].description =
        [projects[projects.length - 1].description, line].filter(Boolean).join(" ");
    }
  }

  // ---- Certifications / languages / achievements -------------------------
  const certifications = buckets.certifications
    .map((line) => line.replace(/^[•\-·\d.)\s]+/, "").trim())
    .filter(Boolean)
    .map((line) => ({ name: line, issuer: null, date: null, url: null }))
    .slice(0, 20);

  const languages = buckets.languages
    .flatMap((line) => line.split(SKILL_SEPARATOR_RE))
    .map((line) => line.trim())
    .filter((line) => /^[A-Za-zÀ-ÿ'\- ]{2,}$/.test(line))
    .map((line) => ({ name: line, level: "" }))
    .slice(0, 12);

  const achievements = buckets.achievements
    .map((line) => line.replace(/^[•\-·\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);

  // ---- Warnings & confidence ---------------------------------------------
  if (!email) warnings.push("No email address was detected — check the contact details.");
  if (!phone && !email && !linkedin) warnings.push("No clear contact details were detected.");
  if (skills.length === 0) warnings.push("No skills were detected — review the extracted text.");
  if (experience.length === 0) warnings.push("No work experience was detected — add it manually if needed.");
  if (education.length === 0 && buckets.education.length > 0)
    warnings.push("Education section was detected but couldn't be parsed reliably.");
  if (rawText.trim().length < 40)
    warnings.push("Very little text was extracted — the document may be an image.");

  const confidence = Math.min(
    1,
    0.2 +
      (email ? 0.15 : 0) +
      ((phone || linkedin) ? 0.1 : 0) +
      Math.min(0.2, skills.length * 0.02) +
      (experience.length > 0 ? 0.2 : 0) +
      (education.length > 0 ? 0.15 : 0),
  );

  return {
    contact: {
      fullName: name || "Unknown candidate",
      email,
      phone,
      location,
      website,
      linkedin,
      github,
    },
    title,
    summary: summary || null,
    skills,
    experience,
    education,
    projects,
    certifications,
    languages,
    achievements,
    warnings,
    confidence: Math.round(confidence * 100) / 100,
    rawText,
    charCount: rawText.length,
  };
}

/**
 * Extract plain text from a supported file purely in the browser.
 */
export async function extractTextFromFile(
  file: File,
): Promise<{ text: string; warnings: string[] }> {
  if (file.name.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(file);
  }
  if (file.name.toLowerCase().endsWith(".docx")) {
    return extractDocxText(file);
  }
  // Plain text fallback.
  const text = await file.text();
  return { text, warnings: [] };
}

/** Minimal shape of a pdf.js text item — just what we need to rebuild lines. */
export interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
  /** Horizontal position (`transform[4]`). */
  x: number;
  /** Baseline position (`transform[5]`). */
  y: number;
}

/**
 * Rebuild readable lines from pdf.js text items.
 *
 * pdf.js marks the last item of each *visual* line with `hasEOL`. Joining every
 * item with a plain space (as an earlier version did) flattens a whole page into
 * one line, so no heading, date or name line survives and a real CV imports as
 * an empty "Unknown candidate". When a document carries no EOL flags we fall
 * back to grouping items by baseline and ordering each line left-to-right.
 */
export function pdfTextItemsToLines(items: PdfTextItem[]): string {
  if (items.some((item) => item.hasEOL)) {
    return items
      .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
      .join("")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim();
  }

  const byBaseline = new Map<number, { x: number; str: string }[]>();
  for (const item of items) {
    const baseline = Math.round(item.y);
    const bucket = byBaseline.get(baseline);
    if (bucket) bucket.push({ x: item.x, str: item.str });
    else byBaseline.set(baseline, [{ x: item.x, str: item.str }]);
  }

  return [...byBaseline.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

async function extractPdfText(
  file: File,
): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    const data = await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist");
    // Official bundler pattern: hand the worker asset URL to pdf.js.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
    try {
      const doc = await loadingTask.promise;

      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        const items: PdfTextItem[] = [];
        for (const item of content.items) {
          if ("str" in item) {
            items.push({
              str: item.str,
              hasEOL: item.hasEOL,
              x: item.transform[4],
              y: item.transform[5],
            });
          }
        }
        pages.push(pdfTextItemsToLines(items));
      }

      const text = pages.join("\n\n");
      if (text.trim().length < 20) {
        warnings.push(
          "Almost no text could be extracted — this PDF may be a scanned image. OCR is not available, so please upload a text-based PDF or DOCX.",
        );
      }
      return { text, warnings };
    } finally {
      // pdfjs 6 owns teardown on the loading task; PDFDocumentProxy.destroy()
      // was removed, so calling it threw *after* a successful extraction.
      await loadingTask.destroy().catch(() => undefined);
    }
  } catch (error) {
    throw new CvParseError(
      "Could not read this PDF. It may be corrupted, encrypted or unsupported.",
      error,
    );
  }
}

async function extractDocxText(
  file: File,
): Promise<{ text: string; warnings: string[] }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      arrayBuffer,
    });
    const warnings = result.messages
      .filter((message) => message.type === "warning")
      .map((message) => message.message)
      .slice(0, 5);
    if (result.value.trim().length < 20) {
      warnings.push("Very little text was extracted from this Word document.");
    }
    return { text: result.value, warnings };
  } catch (error) {
    throw new CvParseError(
      "Could not read this Word document. It may be corrupted or password-protected.",
      error,
    );
  }
}

/** Build a full CV document from a parsed extraction. */
export function cvDocumentFromExtraction(
  extraction: CvExtraction,
  options: { name?: string } = {},
): CvDocument {
  const now = new Date().toISOString();
  return {
    id: createId("cv"),
    name: options.name ?? (extraction.contact.fullName || "Imported CV"),
    template: "classic",
    contact: { ...extraction.contact },
    title: extraction.title ?? "",
    sections: {
      summary: extraction.summary ?? "",
      skillGroups: extraction.skills.length
        ? [{ id: createId("group"), label: "Core skills", skills: extraction.skills }]
        : [],
      experience: extraction.experience.map((entry) => ({
        ...entry,
        id: createId("exp"),
      })),
      education: extraction.education.map((entry) => ({
        ...entry,
        id: createId("edu"),
      })),
      projects: extraction.projects.map((entry) => ({
        ...entry,
        id: createId("prj"),
      })),
      certifications: extraction.certifications.map((entry) => ({
        ...entry,
        id: createId("cert"),
      })),
      languages: extraction.languages.map((entry) => ({
        ...entry,
        id: createId("lang"),
      })),
      achievements: extraction.achievements.map((text) => ({
        id: createId("ach"),
        text,
      })),
    },
    sourceText: extraction.rawText,
    sourceFileName: null,
    origin: "user",
    updatedAt: now,
  };
}

/** A blank document for the "start from scratch" flow. */
export function blankCvDocument(options: { fullName?: string } = {}): CvDocument {
  const now = new Date().toISOString();
  return {
    id: createId("cv"),
    name: options.fullName ? `${options.fullName}'s CV` : "Untitled CV",
    template: "classic",
    contact: {
      fullName: options.fullName ?? "Your name",
      email: null,
      phone: null,
      location: null,
      website: null,
      linkedin: null,
      github: null,
    },
    title: "",
    sections: {
      summary: "",
      skillGroups: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
      achievements: [],
    },
    sourceText: null,
    sourceFileName: null,
    origin: "user",
    updatedAt: now,
  };
}