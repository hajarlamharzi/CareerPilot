import "server-only";

import { invalidInput } from "@/lib/auth/errors";
import { rankJob } from "@/lib/jobs/ranking";
import { analyseSkillGap, suggestProjects } from "@/lib/jobs/skill-gap";
import type { Job } from "@/types";
import {
  APPLICATION_EMAIL_SYSTEM,
  COVER_LETTER_SYSTEM,
  CV_COACH_SYSTEM,
  DATA_HEADERS,
  INTERVIEW_SYSTEM,
  ROADMAP_SYSTEM,
  SKILL_GAP_SYSTEM,
} from "./prompts";
import {
  UNTRUSTED_LIMITS,
  condenseJobDescription,
  prepareUntrusted,
} from "./safety";
import {
  buildCandidateContext,
  findVisibleJob,
  type JobCard,
  type ToolContext,
} from "./tools";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AiFeature } from "./types";

/**
 * The six single-shot AI features, behind one endpoint.
 *
 * They share the assistant's guarantees — server-side key, validated input,
 * untrusted content fenced, no fabricated facts — but not its tool loop: each
 * one writes prose from data the server already holds, so `allowTools` is false.
 *
 * Two of them also return **deterministic** diagnostics (match score, skill gap)
 * computed by the same pure functions the rest of the app uses. The model
 * explains those numbers; it never produces them.
 */

export interface FeatureDefinition {
  id: AiFeature;
  label: string;
  description: string;
  systemInstruction: string;
  /** `true` when a `jobId` must resolve to a visible listing. */
  requiresJob: boolean;
  maxOutputTokens: number;
  temperature: number;
}

export const FEATURES: Record<AiFeature, FeatureDefinition> = {
  assistant: {
    id: "assistant",
    label: "Assistant",
    description: "Conversation avec outils (route séparée).",
    systemInstruction: "",
    requiresJob: false,
    maxOutputTokens: 2_048,
    temperature: 0.35,
  },
  "cv-coach": {
    id: "cv-coach",
    label: "Coach CV",
    description: "Relecture critique du CV, sans invention d'expérience.",
    systemInstruction: CV_COACH_SYSTEM,
    requiresJob: false,
    maxOutputTokens: 2_048,
    temperature: 0.3,
  },
  "cover-letter": {
    id: "cover-letter",
    label: "Lettre de motivation",
    description: "Lettre adaptée à une offre précise, en français ou en anglais.",
    systemInstruction: COVER_LETTER_SYSTEM,
    requiresJob: true,
    maxOutputTokens: 1_800,
    temperature: 0.5,
  },
  interview: {
    id: "interview",
    label: "Préparation d'entretien",
    description: "Questions probables et axes de réponse pour ce poste.",
    systemInstruction: INTERVIEW_SYSTEM,
    requiresJob: true,
    maxOutputTokens: 2_200,
    temperature: 0.4,
  },
  "skill-gap": {
    id: "skill-gap",
    label: "Écart de compétences",
    description: "Comparaison entre votre profil et les exigences de l'offre.",
    systemInstruction: SKILL_GAP_SYSTEM,
    requiresJob: true,
    maxOutputTokens: 2_000,
    temperature: 0.35,
  },
  roadmap: {
    id: "roadmap",
    label: "Feuille de route",
    description: "Plan d'apprentissage ordonné pour combler l'écart.",
    systemInstruction: ROADMAP_SYSTEM,
    requiresJob: true,
    maxOutputTokens: 1_800,
    temperature: 0.4,
  },
  "application-email": {
    id: "application-email",
    label: "Message de candidature",
    description: "E-mail court à joindre au CV. Rien n'est envoyé.",
    systemInstruction: APPLICATION_EMAIL_SYSTEM,
    requiresJob: true,
    maxOutputTokens: 900,
    temperature: 0.45,
  },
};

/** The features a client may call through `/api/ai/[feature]`. */
export const REQUESTABLE_FEATURES: readonly AiFeature[] = [
  "cv-coach",
  "cover-letter",
  "interview",
  "skill-gap",
  "roadmap",
  "application-email",
];

export function isRequestableFeature(value: string): value is AiFeature {
  return (REQUESTABLE_FEATURES as readonly string[]).includes(value);
}

export interface FeatureInput {
  jobId: string | null;
  /** Free-form CV text supplied by the client (paste, upload extraction). */
  cvText: string | null;
  language: "fr" | "en";
  tone: "sobre" | "direct" | "enthousiaste";
  /** Extra instructions from the user, capped and fenced. */
  extraInstructions: string | null;
}

export interface FeatureResourceLink {
  skill: string;
  label: string;
  url: string;
  kind: string;
}

/**
 * Non-AI facts returned alongside the prose, so the UI can show real numbers
 * rather than re-deriving them from the model's wording.
 */
export interface FeatureDiagnostics {
  jobTitle?: string;
  company?: string;
  provenanceLabel?: string;
  isSample?: boolean;
  matchScore?: number;
  matchCategory?: string;
  matchReasons?: string[];
  missingRequiredSkills?: string[];
  requiredCoverage?: number | null;
  overallCoverage?: number | null;
  caveats?: string[];
  resources?: FeatureResourceLink[];
  suggestedProjects?: string[];
  /** Where the CV text came from, so the UI can say it honestly. */
  cvSource?: "provided" | "stored-cv" | "none";
}

export interface FeaturePrompt {
  prompt: string;
  diagnostics: FeatureDiagnostics;
  /** Signals found in third-party content handed to the model. */
  injectionWarnings: { code: string; message: string }[];
}

// ---------------------------------------------------------------------------
// CV text
// ---------------------------------------------------------------------------

/**
 * Best-effort plain-text rendering of a CV.
 *
 * Takes `unknown` on purpose: in cloud mode the CV is a `structured_content`
 * JSON blob, in local demo mode it is a `CvDocument`. Both hold the same
 * information under slightly different keys, and the extraction is written
 * defensively so a missing field degrades the prompt instead of throwing.
 */
export function summarizeCv(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const root = value as Record<string, unknown>;
  const sections =
    root.sections && typeof root.sections === "object"
      ? (root.sections as Record<string, unknown>)
      : root;

  const lines: string[] = [];

  const title = typeof root.title === "string" ? root.title.trim() : "";
  if (title) lines.push(`Titre : ${title}`);

  const summary = typeof sections.summary === "string" ? sections.summary.trim() : "";
  if (summary) lines.push(`Résumé : ${summary}`);

  const groups = Array.isArray(sections.skillGroups) ? sections.skillGroups : [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const entry = group as Record<string, unknown>;
    const skills = Array.isArray(entry.skills)
      ? entry.skills.filter((skill): skill is string => typeof skill === "string")
      : [];
    if (skills.length === 0) continue;
    const label = typeof entry.label === "string" && entry.label ? entry.label : "Compétences";
    lines.push(`${label} : ${skills.join(", ")}`);
  }

  const experience = Array.isArray(sections.experience) ? sections.experience : [];
  for (const item of experience) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const role = firstString(entry.title) ?? firstString(entry.role) ?? "Poste";
    const company = firstString(entry.company) ?? firstString(entry.employer) ?? "";
    const start = firstString(entry.startDate) ?? firstString(entry.start) ?? "";
    const end = firstString(entry.endDate) ?? firstString(entry.end) ?? "en cours";
    const highlights = Array.isArray(entry.highlights)
      ? entry.highlights.filter((value): value is string => typeof value === "string")
      : [];
    const description = firstString(entry.description) ?? "";
    const body = highlights.length > 0 ? highlights.join(" | ") : description;
    lines.push(`Expérience : ${role}${company ? ` — ${company}` : ""} (${start || "?"} → ${end})${body ? ` : ${body}` : ""}`);
  }

  const education = Array.isArray(sections.education) ? sections.education : [];
  for (const item of education) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const degree = firstString(entry.degree) ?? firstString(entry.title) ?? "Formation";
    const school = firstString(entry.school) ?? firstString(entry.institution) ?? "";
    lines.push(`Formation : ${degree}${school ? ` — ${school}` : ""}`);
  }

  const projects = Array.isArray(sections.projects) ? sections.projects : [];
  for (const item of projects) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name = firstString(entry.name) ?? firstString(entry.title) ?? "Projet";
    const description = firstString(entry.description) ?? "";
    lines.push(`Projet : ${name}${description ? ` — ${description}` : ""}`);
  }

  if (lines.length === 0) {
    // No recognisable section: hand the model the raw JSON rather than nothing,
    // clearly labelled, bounded by the caller's sanitizer.
    return JSON.stringify(value).slice(0, 4_000);
  }

  return lines.join("\n");
}

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Resolve the CV text to use, and say where it came from.
 *
 * Precedence: client-supplied text (a paste or an upload the user just made) →
 * the caller's stored CV → nothing (the feature then says what it needs).
 */
export async function resolveCvText(
  context: ToolContext,
  provided: string | null,
): Promise<{ text: string; source: FeatureDiagnostics["cvSource"] }> {
  if (provided && provided.trim().length > 0) {
    return { text: provided.trim(), source: "provided" };
  }

  if (context.snapshot?.cv) {
    const text = summarizeCv(context.snapshot.cv);
    if (text) return { text, source: "stored-cv" };
  }

  const supabase = context.supabase;
  const userId = context.principal.userId;
  if (supabase && userId) {
    const { data } = await supabase
      .from("cv_profiles")
      .select("structured_content")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.structured_content) {
      const text = summarizeCv(data.structured_content);
      if (text) return { text, source: "stored-cv" };
    }
  }

  return { text: "", source: "none" };
}

// ---------------------------------------------------------------------------
// Job + profile sections
// ---------------------------------------------------------------------------

function jobSection(job: Job): { block: string; warnings: { code: string; message: string }[] } {
  const prepared = prepareUntrusted(
    DATA_HEADERS.job,
    [
      `Intitulé : ${job.title}`,
      `Entreprise : ${job.company}`,
      `Lieu : ${job.location || "non précisé"} (${job.workMode})`,
      `Contrat : ${job.employmentType}${job.seniority ? `, niveau ${job.seniority}` : ""}`,
      job.requiredSkills.length > 0 ? `Compétences requises : ${job.requiredSkills.join(", ")}` : "",
      job.preferredSkills.length > 0
        ? `Compétences appréciées : ${job.preferredSkills.join(", ")}`
        : "",
      "",
      "Description :",
      condenseJobDescription(job.description ?? ""),
    ]
      .filter(Boolean)
      .join("\n"),
    UNTRUSTED_LIMITS.jobDescription,
  );

  return { block: prepared.block, warnings: prepared.signals };
}

function profileSection(skills: readonly string[], candidateSummary: string): string {
  const lines = [DATA_HEADERS.profile, candidateSummary];
  if (skills.length > 0) lines.push(`Compétences déclarées : ${skills.join(", ")}`);
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/** Build the user prompt for one feature. Throws `invalid_input` on bad input. */
export async function buildFeaturePrompt(
  feature: AiFeature,
  context: ToolContext,
  input: FeatureInput,
): Promise<FeaturePrompt> {
  const definition = FEATURES[feature];
  const diagnostics: FeatureDiagnostics = {};
  const injectionWarnings: { code: string; message: string }[] = [];

  const job = definition.requiresJob
    ? await requireJob(context, input.jobId, diagnostics)
    : null;

  const { text: cvText, source: cvSource } = await resolveCvText(context, input.cvText);
  diagnostics.cvSource = cvSource;

  const candidateContext = await buildCandidateContext(context);
  const candidateSummary = describeCandidateContext(candidateContext);

  const sections: string[] = [];

  if (job) {
    const { block, warnings } = jobSection(job.job);
    sections.push(block);
    injectionWarnings.push(...warnings);

    if (definition.id === "skill-gap" || definition.id === "roadmap") {
      const gap = analyseSkillGap(candidateContext.skills, job.job);
      diagnostics.requiredCoverage = gap.requiredCoverage;
      diagnostics.overallCoverage = gap.overallCoverage;
      diagnostics.missingRequiredSkills = gap.missingRequired.map((item) => item.skill);
      diagnostics.caveats = gap.caveats;
      const resources = gap.missingRequired.flatMap((item) =>
        item.resources.map((resource) => ({
          skill: item.skill,
          label: resource.label,
          url: resource.url,
          kind: resource.kind,
        })),
      );
      diagnostics.resources = resources;
      diagnostics.suggestedProjects = suggestProjects(gap.suggestedOrder);

      sections.push(
        [
          DATA_HEADERS.analysis,
          `Compétences couvertes : ${gap.covered.map((item) => item.skill).join(", ") || "aucune"}`,
          `Compétences requises manquantes : ${gap.missingRequired.map((item) => item.skill).join(", ") || "aucune"}`,
          `Compétences appréciées manquantes : ${gap.missingPreferred.map((item) => item.skill).join(", ") || "aucune"}`,
          `Couverture des compétences requises : ${gap.requiredCoverage === null ? "non calculable" : `${gap.requiredCoverage} %`}`,
          `Ordre d'apprentissage suggéré : ${gap.suggestedOrder.join(" → ") || "aucun"}`,
          resources.length > 0
            ? `Ressources vérifiées disponibles : ${resources
                .map((resource) => `${resource.skill} → ${resource.label} (${resource.url})`)
                .join(" ; ")}`
            : "Aucune ressource vérifiée disponible pour ces compétences.",
        ].join("\n"),
      );
    }

    if (definition.id === "skill-gap" || definition.id === "interview" || definition.id === "cover-letter") {
      const rank = rankJob(job.job, candidateContext);
      diagnostics.matchScore = rank.score;
      diagnostics.matchCategory = rank.category;
      diagnostics.matchReasons = rank.breakdown
        .filter((entry) => entry.score >= 0.5)
        .slice(0, 4)
        .map((entry) => entry.evidence);
    }
  }

  sections.push(profileSection(candidateContext.skills, candidateSummary));

  if (cvText) {
    const prepared = prepareUntrusted(DATA_HEADERS.cv, cvText, UNTRUSTED_LIMITS.cvText);
    sections.push(prepared.block);
    injectionWarnings.push(...prepared.signals);
  } else if (definition.id === "cv-coach") {
    throw invalidInput(
      "Aucun CV n'a été trouvé. Ajoutez un CV dans « Mes CV », ou collez le texte de votre CV dans le champ prévu.",
    );
  }

  if (input.extraInstructions) {
    const prepared = prepareUntrusted(
      "Consignes complémentaires de l'utilisateur",
      input.extraInstructions,
      600,
    );
    sections.push(prepared.block);
  }

  if (definition.id === "cover-letter" || definition.id === "application-email") {
    sections.push(
      `Langue de rédaction : ${input.language === "en" ? "anglais" : "français"}. Ton : ${input.tone}.`,
    );
  }

  sections.push(instructionFor(definition.id));

  return { prompt: sections.join("\n\n"), diagnostics, injectionWarnings };
}

function instructionFor(feature: AiFeature): string {
  switch (feature) {
    case "cv-coach":
      return "Tâche : propose trois à six améliorations prioritaires du CV ci-dessus, dans l'ordre d'impact, avec une reformulation pour chacune.";
    case "cover-letter":
      return "Tâche : rédige la lettre de motivation. Aucune formule d'appel inventée : utilise [Nom du recruteur] si nécessaire.";
    case "interview":
      return "Tâche : prépare l'entretien en suivant la structure demandée.";
    case "skill-gap":
      return "Tâche : explique l'écart de compétences à partir de l'analyse fournie. Ne recalcule rien et n'ajoute aucune compétence manquante absente de la liste.";
    case "roadmap":
      return "Tâche : construis la feuille de route d'apprentissage à partir des manques listés, dans l'ordre suggéré fourni.";
    case "application-email":
      return "Tâche : rédige le message de candidature (objet + corps). Rappelle en une phrase, à la fin de ta réponse et hors du message, que rien n'a été envoyé.";
    default:
      return "Tâche : réponds à la demande de l'utilisateur.";
  }
}

async function requireJob(
  context: ToolContext,
  jobId: string | null,
  diagnostics: FeatureDiagnostics,
): Promise<{ job: Job; card: JobCard }> {
  if (!jobId) {
    throw invalidInput("Une offre est requise pour cette fonctionnalité. Sélectionnez une offre.");
  }

  const found = await findVisibleJob(context, jobId);
  if (!found) {
    throw invalidInput(
      "Cette offre est introuvable dans le catalogue accessible. Rechargez la page des offres puis réessayez.",
    );
  }

  diagnostics.jobTitle = found.job.title;
  diagnostics.company = found.job.company;
  diagnostics.provenanceLabel = found.provenance.label;
  diagnostics.isSample = found.provenance.isSample;

  return {
    job: found.job,
    card: {
      id: found.job.id,
      title: found.job.title,
      company: found.job.company,
      location: found.job.location,
      workMode: found.job.workMode,
      employmentType: found.job.employmentType,
      seniority: found.job.seniority,
      salaryLabel: null,
      publishedAt: found.job.publishedAt,
      sourceName: found.job.sourceName,
      sourceUrl: found.job.sourceUrl,
      provenanceLabel: found.provenance.label,
      provenanceKind: found.provenance.kind,
      isSample: found.provenance.isSample,
      isVerified: found.provenance.isVerified,
      href: `/jobs/${found.job.id}`,
      matchScore: null,
      matchCategory: null,
      matchReasons: [],
      missingRequired: [],
      alreadySaved: false,
    },
  };
}

export function describeCandidateContext(context: {
  targetTitles: string[];
  locations: string[];
  workModes: string[];
  employmentTypes: string[];
  seniorities: string[];
  minimumSalary: number | null;
  currency: string | null;
}): string {
  const lines: string[] = [];
  if (context.targetTitles.length > 0) lines.push(`- Intitulés visés : ${context.targetTitles.join(", ")}`);
  if (context.locations.length > 0) lines.push(`- Zones : ${context.locations.join(", ")}`);
  if (context.workModes.length > 0) lines.push(`- Modes de travail : ${context.workModes.join(", ")}`);
  if (context.employmentTypes.length > 0) lines.push(`- Contrats : ${context.employmentTypes.join(", ")}`);
  if (context.seniorities.length > 0) lines.push(`- Niveau : ${context.seniorities.join(", ")}`);
  if (context.minimumSalary !== null) {
    lines.push(`- Prétention : ${context.minimumSalary} ${context.currency ?? "EUR"} / an`);
  }
  return lines.length > 0
    ? lines.join("\n")
    : "Aucune préférence de recherche renseignée.";
}

/** Convenience for the route: a Supabase client only for a verified account. */
export async function featureSupabase(userId: string | null) {
  return userId ? await createServerSupabase() : null;
}
