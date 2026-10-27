import { MATCH_THRESHOLDS, MATCH_WEIGHTS } from "@/config/app";
import type {
  CvDocument,
  DimensionScore,
  Job,
  MatchCategory,
  MatchFinding,
  MatchReport,
  SkillEvidence,
} from "@/types";

import { canonicalSkill, SKILL_CANONICALS } from "./skill-alias";

/**
 * Deterministic CV–job matching.
 *
 * Methodology (documented in full in docs/MATCHING.md):
 *  - requiredSkills (50%) — fraction of required skills found in the CV
 *  - preferredSkills (20%) — fraction of preferred skills found in the CV
 *  - experience        (20%) — min(1, CV years / role years)
 *  - alignment         (10%) — title/role overlap plus seniority fit
 *
 * Dimensions that cannot be computed (e.g. the role states no experience
 * requirement) have their weight redistributed proportionally across the
 * remaining dimensions. Protected characteristics are never used.
 */
export interface ComputeMatchInput {
  job: Job;
  cv: CvDocument;
  now?: Date;
}

export type ComputeMatchResult = Omit<MatchReport, "id" | "createdAt">;

export const DIMENSIONS = [
  "requiredSkills",
  "preferredSkills",
  "experience",
  "alignment",
] as const satisfies readonly MatchReport["breakdown"][number]["dimension"][];

// ---------------------------------------------------------------------------
// Skill evidence
// ---------------------------------------------------------------------------

/** Aliases such as "js" or "go" only match as whole words to avoid false hits. */
function containsAlias(haystack: string, alias: string): boolean {
  if (alias.length === 0) return false;
  if (/^[a-z0-9.+#]+$/.test(alias)) {
    const pattern = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`, "i").test(haystack);
  }
  return haystack.includes(alias.toLowerCase());
}

function snippetFrom(text: string, alias: string): string | null {
  const lower = text.toLowerCase();
  const index = lower.indexOf(alias.toLowerCase());
  if (index === -1) return null;
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + alias.length + 60);
  const cut = text.slice(start, end).replace(/\s+/g, " ").trim();
  return cut.length > text.length ? cut : `…${cut}…`;
}

/**
 * All skills evidenced in the CV. Explicit skill lists are guaranteed finds;
 * free text (summaries, highlights, descriptions) adds alias-based matches with
 * an evidence snippet.
 */
export function collectCandidateSkills(doc: CvDocument): Map<string, string | null> {
  const found = new Map<string, string | null>();

  const addExplicit = (skills: string[]) => {
    for (const skill of skills) {
      const canonical = canonicalSkill(skill);
      if (canonical && !found.has(canonical)) found.set(canonical, null);
    }
  };

  for (const group of doc.sections.skillGroups) addExplicit(group.skills);
  for (const entry of doc.sections.experience) addExplicit(entry.skills);
  for (const project of doc.sections.projects) addExplicit(project.skills);

  const haystack = [
    doc.sections.summary,
    doc.title,
    ...doc.sections.experience.flatMap((e) => [
      e.role,
      e.company,
      e.description,
      ...e.highlights,
    ]),
    ...doc.sections.projects.flatMap((p) => [p.name, p.description, ...p.highlights]),
    ...doc.sections.education.map((e) => e.degree),
    doc.sourceText ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const lower = haystack.toLowerCase();
  for (const [canonical, aliases] of Object.entries(SKILL_CANONICALS)) {
    for (const alias of aliases) {
      if (containsAlias(lower, alias)) {
        const existing = found.get(canonical);
        if (existing === undefined || existing === null) {
          found.set(canonical, snippetFrom(haystack, alias));
        }
        break;
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Experience & alignment
// ---------------------------------------------------------------------------

function parseYm(value: string | null): { y: number; m: number } | null {
  if (!value) return null;
  const ym = /^(\d{4})-(\d{1,2})/.exec(value);
  if (ym) return { y: Number(ym[1]), m: Number(ym[2]) - 1 };
  const y = /^(\d{4})/.exec(value);
  if (y) return { y: Number(y[1]), m: 0 };
  return null;
}

function toDate(ym: { y: number; m: number } | null): Date | null {
  if (!ym) return null;
  // Month is stored 0-based; a year-only value defaults to January.
  return new Date(ym.y, ym.m, 1);
}

function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

export function candidateYears(doc: CvDocument, now = new Date()): number {
  let total = 0;
  for (const entry of doc.sections.experience) {
    const start = toDate(parseYm(entry.startDate));
    if (!start) continue;
    const end = entry.current ? now : toDate(parseYm(entry.endDate)) ?? now;
    total += Math.max(0, monthsBetween(start, end));
  }
  return total / 12;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#./]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic match report. Never consults the network and never
 * considers protected characteristics.
 */
export function computeMatch(input: ComputeMatchInput): ComputeMatchResult {
  const { job, cv } = input;
  const now = input.now ?? new Date();
  const candidateSkills = collectCandidateSkills(cv);
  const years = candidateYears(cv, now);

  const resolved = (skills: string[]) =>
    skills.map((skill) => {
      const canonical = canonicalSkill(skill);
      const identifier = canonical ?? skill.trim().toLowerCase();
      return { original: skill, canonical: identifier };
    });

  const required = resolved(job.requiredSkills);
  const preferred = resolved(job.preferredSkills);

  const hasSkill = (canonical: string) => candidateSkills.has(canonical);
  const skillEvidence = (canonical: string): string | null =>
    candidateSkills.get(canonical) ?? null;

  const matchedRequired = required.filter((s) => hasSkill(s.canonical));
  const matchedPreferred = preferred.filter((s) => hasSkill(s.canonical));
  const missingRequired = required.filter((s) => !hasSkill(s.canonical));
  const missingPreferred = preferred.filter((s) => !hasSkill(s.canonical));

  // ---- Dimension scoring ---------------------------------------------------
  const requiredScore =
    required.length === 0 ? 1 : matchedRequired.length / required.length;
  const preferredScore =
    preferred.length === 0 ? 1 : matchedPreferred.length / preferred.length;

  let experienceScore: number | null;
  let experienceNote: string;
  if (job.experienceYears === null) {
    experienceScore = null;
    experienceNote =
      "The role does not state an experience requirement, so this dimension was not scored and its weight was redistributed.";
  } else if (years === 0) {
    experienceScore = null;
    experienceNote =
      "No work experience could be read from the CV, so this dimension was not scored and its weight was redistributed.";
  } else {
    experienceScore = round2(Math.min(1, years / job.experienceYears));
    experienceNote = `The role asks for about ${job.experienceYears} year(s); the CV documents roughly ${years.toFixed(1)} year(s).`;
  }

  const jobTokens = tokenSet(job.title);
  const candidateTitle = [cv.title, cv.sections.experience[0]?.role]
    .filter(Boolean)
    .join(" ");
  const overlap = jaccard(jobTokens, tokenSet(candidateTitle));

  let alignmentScore = overlap >= 0.5 ? 0.85 : overlap >= 0.2 ? 0.6 : 0.4;
  if (job.seniority === "junior" || job.seniority === "intern") {
    if (years < 2) alignmentScore = Math.min(1, alignmentScore + 0.1);
  }
  if (job.seniority === "senior" || job.seniority === "lead" || job.seniority === "principal") {
    if (years < 2) alignmentScore = Math.max(0.15, alignmentScore - 0.2);
  }
  alignmentScore = round2(alignmentScore);

  // ---- Weight redistribution -------------------------------------------------
  const raw: { dimension: (typeof DIMENSIONS)[number]; score: number | null; weight: number; explanation: string }[] = [
    {
      dimension: "requiredSkills",
      score: requiredScore,
      weight: MATCH_WEIGHTS.requiredSkills,
      explanation:
        required.length === 0
          ? "The role lists no required skills, so full credit was given."
          : `${matchedRequired.length} of ${required.length} required skills were found in the CV.`,
    },
    {
      dimension: "preferredSkills",
      score: preferredScore,
      weight: MATCH_WEIGHTS.preferredSkills,
      explanation:
        preferred.length === 0
          ? "The role lists no preferred skills, so full credit was given."
          : `${matchedPreferred.length} of ${preferred.length} preferred skills were found in the CV.`,
    },
    {
      dimension: "experience",
      score: experienceScore,
      weight: MATCH_WEIGHTS.experience,
      explanation: experienceNote,
    },
    {
      dimension: "alignment",
      score: alignmentScore,
      weight: MATCH_WEIGHTS.alignment,
      explanation:
        overlap >= 0.5
          ? "The job title and the CV's headline and most recent role overlap strongly."
          : overlap >= 0.2
            ? "The roles share some relevant language, but the fit is partial."
            : "The job title has little in common with the CV's headline and recent roles.",
    },
  ];

  const applicable = raw.filter((d) => d.score !== null);
  const appliedWeight = applicable.reduce((sum, d) => sum + d.weight, 0);

  const breakdown: DimensionScore[] = raw.map((d) => ({
    dimension: d.dimension,
    score: d.score,
    weight: d.weight,
    effectiveWeight:
      d.score === null || appliedWeight === 0
        ? d.weight
        : round2(d.weight / appliedWeight),
    explanation: d.explanation,
  }));

  const total = applicable.reduce((sum, d) => sum + (d.score ?? 0) * d.weight, 0);
  const score = appliedWeight === 0 ? 0 : Math.round((total / appliedWeight) * 100);

  const category: MatchCategory =
    score >= MATCH_THRESHOLDS.strong
      ? "strong"
      : score >= MATCH_THRESHOLDS.moderate
        ? "moderate"
        : "low";

  // ---- Findings ------------------------------------------------------------
  const findings: MatchFinding[] = [];

  if (required.length > 0) {
    const coverage = matchedRequired.length / required.length;
    if (coverage === 1) {
      findings.push({
        id: "f-required-all",
        severity: "positive",
        title: "Full required-skill coverage",
        detail: "Every skill the role asks for was found in the CV.",
        evidence: matchedRequired.map((s) => s.canonical).join(", "),
      });
    } else if (coverage >= 0.6) {
      findings.push({
        id: "f-required-most",
        severity: "positive",
        title: "Most required skills matched",
        detail: `${matchedRequired.length} of ${required.length} required skills appear in the CV.`,
        evidence: matchedRequired.map((s) => s.canonical).join(", "),
      });
    } else {
      findings.push({
        id: "f-required-gap",
        severity: "warning",
        title: "Several required skills are missing",
        detail: `${missingRequired.length} of ${required.length} required skills were not found in the CV.`,
        evidence: missingRequired.map((s) => s.canonical).join(", "),
      });
    }
  }

  if (experienceScore !== null && job.experienceYears !== null && experienceScore < 0.7) {
    findings.push({
      id: "f-experience",
      severity: "warning",
      title: "Experience below the stated level",
      detail: `The role expects about ${job.experienceYears} years and the CV shows roughly ${years.toFixed(1)}.`,
      evidence: null,
    });
  }

  if (alignmentScore < 0.5) {
    findings.push({
      id: "f-alignment",
      severity: "neutral",
      title: "Partial role fit",
      detail: "The role's focus differs from the candidate's headline and most recent position.",
      evidence: null,
    });
  }

  const matchedSkills: SkillEvidence[] = [...matchedRequired, ...matchedPreferred].map(
    (s) => ({ skill: s.original, evidence: skillEvidence(s.canonical) }),
  );

  let confidence = 0.55;
  if (cv.sections.skillGroups.length > 0) confidence += 0.15;
  if (cv.sections.experience.length > 0) confidence += 0.1;
  if (cv.sections.projects.length > 0 || cv.sourceText) confidence += 0.1;
  confidence = Math.min(0.95, Math.max(0.1, round2(confidence)));

  const qualificationGaps = missingRequired.map(
    (s) => `No evidence of ${s.original} in the current CV`,
  );
  const learningPriorities = [
    ...new Set([
      ...missingRequired.map((s) => s.original),
      ...missingPreferred.map((s) => s.original),
    ]),
  ];

  const cvImprovements: string[] = [];
  if (missingRequired.length > 0) {
    cvImprovements.push(
      `Where the ${missingRequired[0].original} gap is real, add concrete, verifiable examples of using it — never claim skills you do not have.`,
    );
  }
  if (missingPreferred.length > 0) {
    cvImprovements.push(
      `Consider whether any ${missingPreferred.slice(0, 2).map((s) => s.original).join(" or ")} experience is under-stated and worth a dedicated bullet.`,
    );
  }
  if (cv.sections.skillGroups.length > 0 && cv.sections.experience.length > 0) {
    cvImprovements.push(
      "Mirror the most important keywords from the job description in your headline and top skills — keyword matching is how ATS tools screen CVs.",
    );
  }

  return {
    jobId: job.id,
    cvId: cv.id,
    mode: "baseline",
    score,
    category,
    breakdown,
    matchedSkills,
    missingRequiredSkills: missingRequired.map((s) => s.original),
    missingPreferredSkills: missingPreferred.map((s) => s.original),
    findings,
    keywordsToConsider: missingPreferred.map((s) => s.original),
    qualificationGaps,
    learningPriorities,
    cvImprovements,
    confidence,
    aiAssessment: null,
    providerId: null,
    modelId: null,
  };
}