import "server-only";

import { z } from "zod";

import { canonicalSkill } from "@/lib/matching/skill-alias";
import { can } from "@/lib/auth/roles";
import type { Principal } from "@/lib/auth/session";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Application, CvDocument, Job, Seniority } from "@/types";
import { createConfirmationToken } from "./confirmations";
import {
  DEFAULT_JOB_SEARCH_FILTERS,
  type CandidateContext,
  type JobProvenance,
  type JobRank,
} from "@/lib/jobs/types";
import {
  localProvenance as defaultLocalProvenance,
  searchLocalCatalogue,
} from "@/lib/jobs/pipeline";
import { analyseSkillGap, suggestProjects } from "@/lib/jobs/skill-gap";
import { fold } from "@/lib/jobs/text";
import { condenseJobDescription, prepareUntrusted } from "./safety";
import type { AiFeature, ToolDefinition, ToolParameterSchema } from "./types";

/**
 * The assistant's tool registry — the complete list of things the model can do.
 *
 * This file is the security boundary. It is the only place that maps a
 * model-produced name and JSON blob onto real code, and it enforces, in order:
 *
 *   1. the tool exists at all (unknown names are rejected, never guessed);
 *   2. the caller holds the permission the tool requires (RBAC, re-checked here
 *      and not merely in the UI);
 *   3. the arguments satisfy a Zod schema (the model gets validation errors back
 *      so it can correct itself, instead of a 500);
 *   4. write actions are stopped and turned into a signed confirmation the model
 *      cannot forge (`confirmations.ts`).
 *
 * There is deliberately no `run_sql`, `fetch_url`, `exec` or `send_email` tool,
 * and no tool accepts a URL the server will call. Server-side request forgery is
 * not mitigated — it is impossible by construction.
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * A read-only copy of the caller's own data.
 *
 * In cloud mode every tool reads the database through the caller's RLS-bound
 * client. In local demo mode there is no database, so the browser sends its
 * workspace snapshot; it is validated against the same Zod schemas the storage
 * layer uses and every write tool refuses to run against it.
 */
export interface WorkspaceSnapshot {
  profile: {
    fullName: string;
    headline: string | null;
    location: string | null;
    summary: string | null;
  };
  skills: string[];
  preferences: {
    targetTitles: string[];
    locations: string[];
    workModes: string[];
    employmentTypes: string[];
    seniorities: string[];
    minimumSalary: number | null;
    currency: string | null;
  };
  jobs: Job[];
  applications: Application[];
  savedJobIds: string[];
  cv: CvDocument | null;
}

export interface ToolContext {
  principal: Principal;
  /** `null` in local demo mode. */
  supabase: ServerSupabaseClient | null;
  snapshot: WorkspaceSnapshot | null;
  /** Present when the caller supplied a natural-language request. */
  keywords: string[];
  /** Abort signal shared with the upstream provider. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

export interface JobCard {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  seniority: string | null;
  salaryLabel: string | null;
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  provenanceLabel: string;
  provenanceKind: JobProvenance["kind"];
  isSample: boolean;
  isVerified: boolean;
  /** Internal page for the listing. */
  href: string;
  matchScore: number | null;
  matchCategory: JobRank["category"] | null;
  matchReasons: string[];
  missingRequired: string[];
  alreadySaved: boolean;
}

export type ToolOutcome =
  | { kind: "data"; data: Record<string, unknown>; summary: string }
  | {
      kind: "confirmation_required";
      tool: string;
      confirmationId: string;
      expiresAt: number;
      summary: string;
      details: Record<string, unknown>;
    }
  | {
      kind: "client_action";
      action: "save_job" | "unsave_job" | "create_application" | "update_application_status";
      payload: Record<string, unknown>;
      summary: string;
    }
  | { kind: "error"; code: string; message: string };

interface ToolSpec {
  name: string;
  description: string;
  parameters: ToolDefinition["parameters"];
  /** Permission required to run the tool at all. */
  permission:
    | "jobs:read"
    | "jobs:save"
    | "jobs:unsave"
    | "assistant:use"
    | "applications:write:own";
  /** `required` means: stop and ask the user before doing anything. */
  confirmation: "none" | "required";
  /** `true` for tools that change stored data. */
  mutating: boolean;
  /** Pure validation of the model's arguments. */
  parse: (raw: Record<string, unknown>) => Record<string, unknown>;
  run: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolOutcome>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SALARY_PERIOD_LABEL = "/ an";

function formatSalary(job: Job): string | null {
  if (!job.salary) return null;
  const { min, max, currency } = job.salary;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return `${min} – ${max} ${currency} ${SALARY_PERIOD_LABEL}`;
  }
  return `${min ?? max} ${currency} ${SALARY_PERIOD_LABEL}`;
}

function toJobCard(
  job: Job,
  provenance: JobProvenance,
  rank: JobRank | null,
  savedJobIds: ReadonlySet<string>,
): JobCard {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location || "Non précisé",
    workMode: job.workMode,
    employmentType: job.employmentType,
    seniority: job.seniority,
    salaryLabel: formatSalary(job),
    publishedAt: job.publishedAt,
    sourceName: job.sourceName,
    sourceUrl: job.sourceUrl,
    provenanceLabel: provenance.label,
    provenanceKind: provenance.kind,
    isSample: provenance.isSample,
    isVerified: provenance.isVerified,
    href: `/jobs/${job.id}`,
    matchScore: rank?.score ?? null,
    matchCategory: rank?.category ?? null,
    matchReasons:
      rank?.breakdown
        .filter((entry) => entry.score >= 0.5)
        .slice(0, 4)
        .map((entry) => entry.evidence) ?? [],
    missingRequired: rank?.missingRequired ?? [],
    alreadySaved: savedJobIds.has(job.id),
  };
}

/** Candidate context assembled from whichever backend is in play. */
export async function buildCandidateContext(
  context: ToolContext,
): Promise<CandidateContext> {
  if (context.snapshot) {
    const { profile, preferences, skills } = context.snapshot;
    return {
      targetTitles: [...new Set([...preferences.targetTitles, profile.headline ?? ""].filter(Boolean))],
      skills,
      locations: preferences.locations.length
        ? preferences.locations
        : profile.location
          ? [profile.location]
          : [],
      workModes: preferences.workModes.filter(isWorkMode),
      employmentTypes: preferences.employmentTypes.filter(isEmploymentType),
      seniorities: preferences.seniorities.filter(isSeniority),
      minimumSalary: preferences.minimumSalary,
      currency: preferences.currency,
      keywords: context.keywords,
    };
  }

  const supabase = context.supabase;
  const userId = context.principal.userId;

  if (!supabase || !userId) {
    // Cloud mode without a signed-in user: rank with an empty context rather
    // than inventing preferences. Scores then honestly reflect "no data".
    return emptyContext(context.keywords);
  }

  const [preferencesResult, skillsResult, profileResult] = await Promise.all([
    supabase
      .from("candidate_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("candidate_skills").select("skill_id").eq("user_id", userId),
    supabase.from("profiles").select("headline, location").eq("id", userId).maybeSingle(),
  ]);

  const preferences = preferencesResult.data;

  // Two flat queries rather than one embedded select: `Relationships` is empty
  // in the generated types, so an embedded `skills ( name )` would be untyped.
  let skillNames: string[] = [];
  const skillIds = (skillsResult.data ?? []).map((row) => row.skill_id);
  if (skillIds.length > 0) {
    const { data: skillRows } = await supabase
      .from("skills")
      .select("name")
      .in("id", skillIds);
    skillNames = (skillRows ?? []).map((row) => row.name);
  }

  return {
    targetTitles: unique([
      ...(preferences?.desired_job_titles ?? []),
      profileResult.data?.headline ?? "",
    ]),
    skills: skillNames,
    locations: preferences?.preferred_locations?.length
      ? preferences.preferred_locations
      : unique([profileResult.data?.location ?? ""]),
    workModes: (preferences?.work_modes ?? []).filter(isWorkMode),
    employmentTypes: (preferences?.employment_types ?? []).filter(isEmploymentType),
    seniorities: preferences?.seniority ? [preferences.seniority] : [],
    minimumSalary: preferences?.minimum_salary ?? null,
    currency: preferences?.salary_currency ?? null,
    keywords: context.keywords,
  };
}

const isWorkMode = (value: string): value is Job["workMode"] =>
  value === "remote" || value === "hybrid" || value === "onsite";

const isEmploymentType = (value: string): value is Job["employmentType"] =>
  ["full-time", "part-time", "contract", "internship", "temporary"].includes(value);

const isSeniority = (value: string): value is Seniority =>
  ["intern", "junior", "mid", "senior", "lead", "principal"].includes(value);

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function emptyContext(keywords: string[]): CandidateContext {
  return {
    targetTitles: [],
    skills: [],
    locations: [],
    workModes: [],
    employmentTypes: [],
    seniorities: [],
    minimumSalary: null,
    currency: null,
    keywords,
  };
}

/** All jobs visible to the caller. Bounded in cloud mode. */
async function loadVisibleJobs(context: ToolContext): Promise<Job[]> {
  if (context.snapshot) return context.snapshot.jobs;
  const supabase = context.supabase;
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) throw new Error(`Catalogue inaccessible : ${error.message}`);

  // Reuse the shared mapper so provenance badges match the jobs page exactly.
  const { toDomainJob } = await import("@/lib/jobs/mappers");
  return (data ?? []).map((row) => toDomainJob(row));
}

async function loadProvenanceMap(context: ToolContext): Promise<Map<string, JobProvenance>> {
  const map = new Map<string, JobProvenance>();
  if (context.snapshot) {
    for (const job of context.snapshot.jobs) {
      map.set(job.id, defaultLocalProvenance(job));
    }
    return map;
  }
  const supabase = context.supabase;
  if (!supabase) return map;

  const { data } = await supabase
    .from("jobs")
    .select("id, source_type, source_name, source_url, is_sample")
    .eq("status", "published")
    .limit(500);

  const { toProvenance } = await import("@/lib/jobs/mappers");
  for (const row of data ?? []) {
    map.set(
      row.id,
      toProvenance({
        source_type: row.source_type,
        source_name: row.source_name,
        source_url: row.source_url,
        is_sample: row.is_sample,
      }),
    );
  }
  return map;
}

async function savedJobIds(context: ToolContext): Promise<Set<string>> {
  if (context.snapshot) return new Set(context.snapshot.savedJobIds);
  const supabase = context.supabase;
  const userId = context.principal.userId;
  if (!supabase || !userId) return new Set();

  const { data } = await supabase.from("saved_jobs").select("job_id").eq("user_id", userId);
  return new Set((data ?? []).map((row) => row.job_id));
}

async function findJob(
  context: ToolContext,
  jobId: string,
): Promise<{ job: Job; provenance: JobProvenance } | null> {
  const provenanceMap = await loadProvenanceMap(context);
  if (context.snapshot) {
    const job = context.snapshot.jobs.find((candidate) => candidate.id === jobId);
    if (!job) return null;
    return { job, provenance: provenanceMap.get(jobId) ?? defaultLocalProvenance(job) };
  }

  const supabase = context.supabase;
  if (!supabase) return null;

  const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!data) return null;

  const { toDomainJob, toProvenance } = await import("@/lib/jobs/mappers");
  return {
    job: toDomainJob(data),
    provenance:
      provenanceMap.get(jobId) ??
      toProvenance({
        source_type: data.source_type,
        source_name: data.source_name,
        source_url: data.source_url,
        is_sample: data.is_sample,
      }),
  };
}

/**
 * Resolve one listing the caller is allowed to see.
 *
 * Exported because the single-shot AI features need the same resolution rules as
 * the tools: snapshot in local demo mode, RLS-bound query in cloud mode, `null`
 * when the listing is invisible. Sharing it means a feature can never widen
 * access relative to the assistant.
 */
export async function findVisibleJob(
  context: ToolContext,
  jobId: string,
): Promise<{ job: Job; provenance: JobProvenance } | null> {
  return findJob(context, jobId);
}

// ---------------------------------------------------------------------------
// JSON Schema fragments
// ---------------------------------------------------------------------------

const stringArray = (description: string): ToolParameterSchema => ({
  type: "array",
  description,
  items: { type: "string", description: "Valeur" },
});

const enumArray = (description: string, values: readonly string[]): ToolParameterSchema => ({
  type: "array",
  description,
  items: { type: "string", description: "Valeur autorisée", enum: [...values] },
});

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const searchJobsSpec: ToolSpec = {
  name: "search_jobs",
  description:
    "Recherche des offres : d'abord dans le catalogue CareerPilot, puis dans les sources en direct configurées (Adzuna, Jobicy) quand elles sont disponibles. À utiliser dès que l'utilisateur décrit un poste, un lieu, un type de contrat ou des compétences recherchées. Retourne des offres avec leur provenance (catalogue ou source externe), leur score d'adéquation et les compétences manquantes. Les résultats « source externe » pointent vers la page d'origine et peuvent avoir été pourvus entre-temps.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Mots-clés libres (intitulé de poste, technologie, secteur).",
      },
      titles: stringArray("Intitulés de poste recherchés."),
      locations: stringArray("Villes ou pays recherchés."),
      companies: stringArray("Entreprises ciblées."),
      workModes: enumArray("Modes de travail acceptés.", ["remote", "hybrid", "onsite"]),
      employmentTypes: enumArray("Types de contrat acceptés.", [
        "full-time",
        "part-time",
        "contract",
        "internship",
        "temporary",
      ]),
      seniorities: enumArray("Niveaux d'expérience acceptés.", [
        "intern",
        "junior",
        "mid",
        "senior",
        "lead",
        "principal",
      ]),
      minSalary: {
        type: "integer",
        description: "Salaire annuel minimum souhaité, en nombre entier.",
        minimum: 0,
      },
      limit: {
        type: "integer",
        description: "Nombre maximum d'offres à retourner (1 à 10).",
        minimum: 1,
        maximum: 10,
      },
    },
  },
  permission: "jobs:read",
  confirmation: "none",
  mutating: false,
  parse: (raw) => searchArgsSchema.parse(raw),
  run: async (args, context) => {
    const parsed = args as z.infer<typeof searchArgsSchema>;
    const filters = {
      ...DEFAULT_JOB_SEARCH_FILTERS,
      query: parsed.query ?? "",
      titles: parsed.titles,
      locations: parsed.locations,
      companies: parsed.companies,
      workModes: parsed.workModes,
      employmentTypes: parsed.employmentTypes,
      seniorities: parsed.seniorities,
      minSalary: parsed.minSalary ?? null,
      sort: "relevance" as const,
      page: 1,
      pageSize: parsed.limit,
    };

    const [candidateContext, provenanceMap, saved] = await Promise.all([
      buildCandidateContext(context),
      loadProvenanceMap(context),
      savedJobIds(context),
    ]);

    // Catalogue and live sources are independent: a live failure must never
    // take the catalogue results down with it.
    const jobs = await loadVisibleJobs(context);
    const result = searchLocalCatalogue(
      jobs,
      filters,
      candidateContext,
      (job) => provenanceMap.get(job.id) ?? defaultLocalProvenance(job),
    );

    const { rankJob } = await import("@/lib/jobs/ranking");
    const { searchLiveJobs } = await import("@/lib/jobs/live/search-service");
    const { resolveCountryCode } = await import("@/lib/jobs/live/normalizer");

    const liveKeywords = [parsed.query ?? "", ...parsed.titles].filter(Boolean);
    const liveCountry =
      parsed.locations.map(resolveCountryCode).find((code) => code !== null) ?? null;
    const liveLocation =
      parsed.locations.find((entry) => resolveCountryCode(entry) === null) ?? null;
    const remoteOnly =
      parsed.workModes.length === 1 && parsed.workModes[0] === "remote";

    let live: Awaited<ReturnType<typeof searchLiveJobs>> | null = null;
    let liveError: string | null = null;
    // Live sources are never consulted from a test environment: the suite must
    // stay offline, deterministic and free. `NODE_ENV` is "test" under Vitest.
    const liveEnabled = process.env.NODE_ENV !== "test";
    if (liveEnabled) {
      try {
        live = await searchLiveJobs({
          keywords: liveKeywords,
          country: liveCountry,
          location: liveLocation,
          remote: remoteOnly,
          employmentTypes: parsed.employmentTypes,
          seniority: parsed.seniorities[0] ?? null,
          minSalary: parsed.minSalary ?? null,
          withinDays: null,
          page: 1,
          pageSize: 8,
        });
      } catch {
        liveError = "Les sources en direct sont momentanément indisponibles.";
      }
    }

    const catalogueCards = result.items.map((hit) =>
      toJobCard(hit.job, hit.provenance, hit.rank, saved),
    );

    const liveCards = (live?.items ?? []).map((item) => {
      const rank = rankJob(item.job, candidateContext);
      const card = toJobCard(
        item.job,
        {
          kind: "api",
          label: "Source externe en direct",
          sourceName: item.job.sourceName,
          sourceUrl: item.job.sourceUrl,
          isSample: false,
          isVerified: true,
        },
        rank,
        saved,
      );
      // No internal page exists for a live listing: the card links to the
      // validated upstream URL and says so.
      return { ...card, href: item.job.sourceUrl ?? card.href };
    });

    const sourceSummary = (live?.sources ?? []).map((run) => ({
      source: run.sourceLabel,
      status: run.status,
      resultCount: run.resultCount,
      message: run.message,
      cached: run.cached,
      checkedAt: run.checkedAt,
    }));

    const totalCards = catalogueCards.length + liveCards.length;

    return {
      kind: "data",
      summary:
        totalCards === 0
          ? "Aucune offre ne correspond à ces critères, ni dans le catalogue ni dans les sources en direct."
          : `${totalCards} offre(s) : ${catalogueCards.length} dans le catalogue, ${liveCards.length} en direct.`,
      data: {
        totalMatching: result.total + (live?.items.length ?? 0),
        returned: totalCards,
        searchedScope:
          "Catalogue CareerPilot et sources en direct configurées. " +
          "Les offres « Source externe en direct » proviennent réellement de l'API de la source indiquée " +
          "et renvoient vers sa page d'origine ; elles peuvent avoir été pourvus entre-temps. " +
          "Aucune offre n'est inventée.",
        liveSources: sourceSummary,
        liveUnavailable: liveError,
        jobs: [...catalogueCards, ...liveCards],
      },
    };
  },
};

const getJobDetailsSpec: ToolSpec = {
  name: "get_job_details",
  description:
    "Retourne la description complète d'une offre du catalogue, sa provenance, son lien d'origine et l'analyse d'écart de compétences avec le profil de l'utilisateur.",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "Identifiant de l'offre (champ `id`)." },
    },
    required: ["jobId"],
  },
  permission: "jobs:read",
  confirmation: "none",
  mutating: false,
  parse: (raw) => jobIdArgsSchema.parse(raw),
  run: async (args, context) => {
    const { jobId } = args as z.infer<typeof jobIdArgsSchema>;
    const found = await findJob(context, jobId);
    if (!found) {
      return {
        kind: "error",
        code: "job_not_found",
        message:
          "Cette offre n'existe pas ou n'est plus publiée dans le catalogue CareerPilot.",
      };
    }

    const [candidateContext, saved] = await Promise.all([
      buildCandidateContext(context),
      savedJobIds(context),
    ]);

    const { rankJob } = await import("@/lib/jobs/ranking");
    const rank = rankJob(found.job, candidateContext);
    const gap = analyseSkillGap(candidateContext.skills, found.job);

    const prepared = prepareUntrusted(
      `Description de l'offre « ${found.job.title} »`,
      found.job.description || "(aucune description fournie)",
      6_000,
    );

    return {
      kind: "data",
      summary: `Détails de « ${found.job.title} » chez ${found.job.company}.`,
      data: {
        job: toJobCard(found.job, found.provenance, rank, saved),
        descriptionExcerpt: condenseJobDescription(found.job.description ?? ""),
        /** Fenced so the model reads it as data, never as instructions. */
        descriptionForModel: prepared.block,
        injectionSignals: prepared.signals,
        rankBreakdown: rank.breakdown,
        rankCaveats: rank.caveats,
        skillGap: {
          covered: gap.covered.map((item) => item.skill),
          missingRequired: gap.missingRequired.map((item) => item.skill),
          missingPreferred: gap.missingPreferred.map((item) => item.skill),
          requiredCoverage: gap.requiredCoverage,
        },
      },
    };
  },
};

const getCandidateProfileSpec: ToolSpec = {
  name: "get_candidate_profile",
  description:
    "Retourne le profil et les préférences de carrière de l'utilisateur connecté. À utiliser pour personnaliser une réponse (ville, intitulé visé, mode de travail, prétention salariale).",
  parameters: { type: "object", properties: {} },
  permission: "assistant:use",
  confirmation: "none",
  mutating: false,
  parse: () => ({}),
  run: async (_args, context) => {
    const candidateContext = await buildCandidateContext(context);
    return {
      kind: "data",
      summary: "Profil et préférences récupérés.",
      data: {
        targetTitles: candidateContext.targetTitles,
        locations: candidateContext.locations,
        workModes: candidateContext.workModes,
        employmentTypes: candidateContext.employmentTypes,
        seniorities: candidateContext.seniorities,
        minimumSalary: candidateContext.minimumSalary,
        currency: candidateContext.currency,
        skillCount: candidateContext.skills.length,
        // Skills are returned because the profile page owns them; no CV body,
        // e-mail address or phone number is ever included here.
      },
    };
  },
};

const getCandidateSkillsSpec: ToolSpec = {
  name: "get_candidate_skills",
  description:
    "Retourne la liste des compétences déclarées par l'utilisateur, sous forme canonique.",
  parameters: { type: "object", properties: {} },
  permission: "assistant:use",
  confirmation: "none",
  mutating: false,
  parse: () => ({}),
  run: async (_args, context) => {
    const candidateContext = await buildCandidateContext(context);
    const canonical = candidateContext.skills.map(
      (skill) => canonicalSkill(skill) ?? fold(skill),
    );
    return {
      kind: "data",
      summary: `${canonical.length} compétence(s) déclarée(s).`,
      data: { skills: candidateContext.skills, canonical: unique(canonical) },
    };
  },
};

const analyzeSkillGapsSpec: ToolSpec = {
  name: "analyze_skill_gaps",
  description:
    "Compare les compétences de l'utilisateur avec les exigences d'une offre et retourne les compétences couvertes, manquantes, des idées de projet et un ordre d'apprentissage.",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "Identifiant de l'offre de référence." },
    },
    required: ["jobId"],
  },
  permission: "assistant:use",
  confirmation: "none",
  mutating: false,
  parse: (raw) => jobIdArgsSchema.parse(raw),
  run: async (args, context) => {
    const { jobId } = args as z.infer<typeof jobIdArgsSchema>;
    const found = await findJob(context, jobId);
    if (!found) {
      return {
        kind: "error",
        code: "job_not_found",
        message: "Offre introuvable dans le catalogue.",
      };
    }
    const candidateContext = await buildCandidateContext(context);
    const gap = analyseSkillGap(candidateContext.skills, found.job);
    return {
      kind: "data",
      summary: `Écart de compétences analysé pour « ${found.job.title} ».`,
      data: {
        jobTitle: found.job.title,
        company: found.job.company,
        requiredCoverage: gap.requiredCoverage,
        overallCoverage: gap.overallCoverage,
        covered: gap.covered,
        missingRequired: gap.missingRequired,
        missingPreferred: gap.missingPreferred,
        unclassified: gap.unclassified,
        suggestedOrder: gap.suggestedOrder,
        suggestedProjects: suggestProjects(gap.suggestedOrder),
        caveats: gap.caveats,
      },
    };
  },
};

const saveJobSpec: ToolSpec = {
  name: "save_job",
  description:
    "Enregistre une offre dans les favoris de l'utilisateur. Action réversible et immédiatement annulable ; aucune confirmation n'est demandée.",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "Identifiant de l'offre à enregistrer." },
    },
    required: ["jobId"],
  },
  permission: "jobs:save",
  confirmation: "none",
  mutating: true,
  parse: (raw) => jobIdArgsSchema.parse(raw),
  run: async (args, context) => {
    const { jobId } = args as z.infer<typeof jobIdArgsSchema>;
    const found = await findJob(context, jobId);
    if (!found) {
      return { kind: "error", code: "job_not_found", message: "Offre introuvable." };
    }

    const userId = context.principal.userId;
    if (!userId || !context.supabase) {
      return {
        kind: "client_action",
        action: "save_job",
        payload: { jobId },
        summary: `« ${found.job.title} » ajouté aux favoris de cet espace de démonstration.`,
      };
    }

    const { error } = await context.supabase
      .from("saved_jobs")
      .upsert(
        { user_id: userId, job_id: jobId },
        { onConflict: "user_id,job_id", ignoreDuplicates: true },
      );

    if (error) {
      return {
        kind: "error",
        code: "save_failed",
        message: "L'offre n'a pas pu être enregistrée. Réessayez.",
      };
    }
    return {
      kind: "data",
      summary: `« ${found.job.title} » chez ${found.job.company} est maintenant dans vos favoris.`,
      data: { jobId, saved: true, href: `/jobs/${jobId}` },
    };
  },
};

const unsaveJobSpec: ToolSpec = {
  name: "unsave_job",
  description: "Retire une offre des favoris de l'utilisateur.",
  parameters: {
    type: "object",
    properties: {
      jobId: { type: "string", description: "Identifiant de l'offre." },
    },
    required: ["jobId"],
  },
  permission: "jobs:unsave",
  confirmation: "none",
  mutating: true,
  parse: (raw) => jobIdArgsSchema.parse(raw),
  run: async (args, context) => {
    const { jobId } = args as z.infer<typeof jobIdArgsSchema>;
    const userId = context.principal.userId;
    if (!userId || !context.supabase) {
      return {
        kind: "client_action",
        action: "unsave_job",
        payload: { jobId },
        summary: "Offre retirée des favoris de cet espace de démonstration.",
      };
    }
    const { error } = await context.supabase
      .from("saved_jobs")
      .delete()
      .eq("user_id", userId)
      .eq("job_id", jobId);
    if (error) {
      return { kind: "error", code: "unsave_failed", message: "Retrait impossible." };
    }
    return { kind: "data", summary: "Offre retirée des favoris.", data: { jobId, saved: false } };
  },
};

const createApplicationSpec: ToolSpec = {
  name: "create_application",
  description:
    "Crée une candidature dans le suivi de l'utilisateur. ACTION À CONFIRMER : appelez cet outil, l'utilisateur devra valider avant que quoi que ce soit ne soit enregistré.",
  parameters: {
    type: "object",
    properties: {
      jobId: {
        type: "string",
        description: "Identifiant de l'offre du catalogue, si la candidature en provient.",
      },
      companyName: { type: "string", description: "Nom de l'entreprise." },
      jobTitle: { type: "string", description: "Intitulé du poste." },
      status: {
        type: "string",
        description: "Statut initial.",
        enum: ["interested", "saved", "applied"],
      },
      notes: { type: "string", description: "Notes libres (facultatif)." },
    },
    required: ["companyName", "jobTitle"],
  },
  permission: "applications:write:own",
  confirmation: "required",
  mutating: true,
  parse: (raw) => createApplicationArgsSchema.parse(raw),
  run: async (args, context) => {
    const parsed = args as z.infer<typeof createApplicationArgsSchema>;

    // Re-validate that a referenced job is really visible to this caller, so the
    // model cannot attach somebody else's listing (or a made-up id).
    if (parsed.jobId) {
      const found = await findJob(context, parsed.jobId);
      if (!found) {
        return {
          kind: "error",
          code: "job_not_found",
          message: "L'offre référencée n'existe pas dans le catalogue.",
        };
      }
    }

    const userId = context.principal.userId;
    if (!userId || !context.supabase) {
      return {
        kind: "client_action",
        action: "create_application",
        payload: { ...parsed },
        summary: `Candidature « ${parsed.jobTitle} » chez ${parsed.companyName} ajoutée au suivi de démonstration.`,
      };
    }

    const { data, error } = await context.supabase
      .from("applications")
      .insert({
        user_id: userId,
        job_id: parsed.jobId ?? null,
        company_name: parsed.companyName,
        job_title: parsed.jobTitle,
        status: parsed.status,
        notes: parsed.notes ?? null,
        applied_at: parsed.status === "applied" ? new Date().toISOString() : null,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return {
        kind: "error",
        code: "application_failed",
        message: "La candidature n'a pas pu être créée.",
      };
    }

    return {
      kind: "data",
      summary: `Candidature créée : ${parsed.jobTitle} chez ${parsed.companyName}.`,
      data: { applicationId: data.id, href: `/applications/${data.id}` },
    };
  },
};

const updateApplicationStatusSpec: ToolSpec = {
  name: "update_application_status",
  description:
    "Change le statut d'une candidature existante de l'utilisateur. ACTION À CONFIRMER par l'utilisateur.",
  parameters: {
    type: "object",
    properties: {
      applicationId: { type: "string", description: "Identifiant de la candidature." },
      status: {
        type: "string",
        description: "Nouveau statut.",
        enum: [
          "interested",
          "saved",
          "applied",
          "screening",
          "interview",
          "assessment",
          "offer",
          "rejected",
          "withdrawn",
        ],
      },
      note: { type: "string", description: "Note à ajouter à l'historique (facultatif)." },
    },
    required: ["applicationId", "status"],
  },
  permission: "applications:write:own",
  confirmation: "required",
  mutating: true,
  parse: (raw) => updateStatusArgsSchema.parse(raw),
  run: async (args, context) => {
    const parsed = args as z.infer<typeof updateStatusArgsSchema>;

    const userId = context.principal.userId;
    if (!userId || !context.supabase) {
      return {
        kind: "client_action",
        action: "update_application_status",
        payload: { ...parsed },
        summary: "Statut de candidature mis à jour dans l'espace de démonstration.",
      };
    }

    const { data: existing } = await context.supabase
      .from("applications")
      .select("id, status, job_title, company_name, history")
      .eq("id", parsed.applicationId)
      // Explicit ownership filter, in addition to RLS: belt and braces.
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return {
        kind: "error",
        code: "application_not_found",
        message: "Cette candidature n'existe pas ou n'appartient pas à votre compte.",
      };
    }

    const history = Array.isArray(existing.history) ? existing.history : [];

    const { error } = await context.supabase
      .from("applications")
      .update({
        status: parsed.status,
        // Append rather than overwrite, so the timeline the user sees stays
        // complete.
        history: [
          ...history,
          {
            from: existing.status,
            to: parsed.status,
            at: new Date().toISOString(),
            note: parsed.note ?? null,
          },
        ],
      })
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (error) {
      return {
        kind: "error",
        code: "application_update_failed",
        message: "Le statut n'a pas pu être mis à jour.",
      };
    }

    return {
      kind: "data",
      summary: `Statut de « ${existing.job_title} » passé de « ${existing.status} » à « ${parsed.status} ».`,
      data: { applicationId: existing.id, status: parsed.status },
    };
  },
};

// ---------------------------------------------------------------------------
// Argument schemas
// ---------------------------------------------------------------------------

const searchArgsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  titles: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  locations: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  companies: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3).optional().default([]),
  employmentTypes: z
    .array(z.enum(["full-time", "part-time", "contract", "internship", "temporary"]))
    .max(5)
    .optional()
    .default([]),
  seniorities: z
    .array(z.enum(["intern", "junior", "mid", "senior", "lead", "principal"]))
    .max(6)
    .optional()
    .default([]),
  minSalary: z.number().int().min(0).max(10_000_000).optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

const jobIdArgsSchema = z.object({
  jobId: z.string().trim().min(1).max(120),
});

const createApplicationArgsSchema = z.object({
  jobId: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().min(1).max(160),
  jobTitle: z.string().trim().min(1).max(200),
  status: z.enum(["interested", "saved", "applied"]).optional().default("interested"),
  notes: z.string().trim().max(2_000).optional(),
});

const updateStatusArgsSchema = z.object({
  applicationId: z.string().trim().min(1).max(120),
  status: z.enum([
    "interested",
    "saved",
    "applied",
    "screening",
    "interview",
    "assessment",
    "offer",
    "rejected",
    "withdrawn",
  ]),
  note: z.string().trim().max(500).optional(),
});

const SPECS: readonly ToolSpec[] = [
  searchJobsSpec,
  getJobDetailsSpec,
  getCandidateProfileSpec,
  getCandidateSkillsSpec,
  analyzeSkillGapsSpec,
  saveJobSpec,
  unsaveJobSpec,
  createApplicationSpec,
  updateApplicationStatusSpec,
];

const SPEC_BY_NAME = new Map(SPECS.map((spec) => [spec.name, spec]));

/** Tool definitions in provider format. `generate_cover_letter` is intentionally
 * absent here — generating prose inside a tool call would nest a second model
 * call inside the first; it is a first-class feature endpoint instead. */
export const TOOL_DEFINITIONS: ToolDefinition[] = SPECS.map((spec) => ({
  name: spec.name,
  description: spec.description,
  parameters: spec.parameters,
}));

export const TOOL_NAMES: readonly string[] = SPECS.map((spec) => spec.name);

/** Human sentence describing what a confirmation would do. */
export function describePendingAction(
  tool: string,
  args: Record<string, unknown>,
): string {
  switch (tool) {
    case "create_application":
      return `Créer une candidature pour « ${String(args.jobTitle ?? "?")} » chez ${String(args.companyName ?? "?")}.`;
    case "update_application_status":
      return `Passer la candidature ${String(args.applicationId ?? "?")} au statut « ${String(args.status ?? "?")} ».`;
    default:
      return `Exécuter « ${tool} ».`;
  }
}

/** `true` when the tool changes stored data. Used by the agent to annotate UI. */
export function isMutatingTool(name: string): boolean {
  return SPEC_BY_NAME.get(name)?.mutating ?? false;
}

export function toolRequiresConfirmation(name: string): boolean {
  return SPEC_BY_NAME.get(name)?.confirmation === "required";
}

/** Look up a spec by name (used by the confirmation endpoint). */
export function getToolSpec(name: string): { mutating: boolean } | null {
  const spec = SPEC_BY_NAME.get(name);
  return spec ? { mutating: spec.mutating } : null;
}

/** JSON payload handed back to the model for a given outcome. */
export function outcomeToToolContent(outcome: ToolOutcome): string {
  switch (outcome.kind) {
    case "data":
      return JSON.stringify({ status: "ok", summary: outcome.summary, data: outcome.data });
    case "confirmation_required":
      return JSON.stringify({
        status: "confirmation_required",
        summary: outcome.summary,
        instruction:
          "Rien n'a été enregistré. L'utilisateur doit valider la confirmation affichée dans l'interface. Ne prétends pas que l'action est terminée.",
        confirmationId: outcome.confirmationId,
      });
    case "client_action":
      return JSON.stringify({
        status: "ok",
        summary: outcome.summary,
        note: "Action appliquée à l'espace local de l'utilisateur.",
      });
    case "error":
      return JSON.stringify({ status: "error", code: outcome.code, message: outcome.message });
  }
}

export interface ExecuteToolOptions {
  /** Set only after a confirmation token has been verified. */
  confirmed?: boolean;
}

/**
 * Validate and run one tool call.
 *
 * Never throws for model-caused problems: an unknown tool, a missing permission
 * or invalid arguments all come back as an `error` outcome so the model can adapt
 * and the transcript can explain what happened. Throwing is reserved for
 * genuinely exceptional conditions (a database outage), which the caller turns
 * into a 5xx.
 */
export async function executeTool(
  name: string,
  rawArguments: Record<string, unknown>,
  context: ToolContext,
  options: ExecuteToolOptions = {},
): Promise<ToolOutcome> {
  const spec = SPEC_BY_NAME.get(name);
  if (!spec) {
    return {
      kind: "error",
      code: "unknown_tool",
      message: `L'outil « ${name} » n'existe pas. Outils disponibles : ${TOOL_NAMES.join(", ")}.`,
    };
  }

  // --- 1. Authorisation -----------------------------------------------------
  if (!can(context.principal.roles, spec.permission)) {
    return {
      kind: "error",
      code: "forbidden",
      message: `Action refusée : la permission « ${spec.permission} » est requise pour utiliser ${name}.`,
    };
  }

  // --- 2. Argument validation ----------------------------------------------
  let parsed: Record<string, unknown>;
  try {
    parsed = spec.parse(rawArguments);
  } catch (error) {
    const details =
      error instanceof z.ZodError
        ? error.issues.map(
            (issue) => `${issue.path.join(".") || "argument"}: ${issue.message}`,
          )
        : ["arguments illisibles"];
    return {
      kind: "error",
      code: "invalid_arguments",
      message: `Arguments invalides pour ${name}. ${details.join(" ; ")}`,
    };
  }

  // --- 3. Confirmation gate -------------------------------------------------
  if (spec.confirmation === "required" && !options.confirmed) {
    // A local-demo caller has no verified identity, so no token can be bound to
    // them: ask for confirmation in the UI and let the client apply the change
    // to its own workspace.
    if (!context.principal.isAuthenticated || !context.principal.userId) {
      return {
        kind: "confirmation_required",
        tool: name,
        confirmationId: "",
        expiresAt: 0,
        summary: describePendingAction(name, parsed),
        details: parsed,
      };
    }

    const { token, expiresAt, nonce } = createConfirmationToken({
      tool: name,
      args: parsed,
      userId: context.principal.userId,
    });

    return {
      kind: "confirmation_required",
      tool: name,
      confirmationId: token,
      expiresAt,
      summary: describePendingAction(name, parsed),
      details: { ...parsed, nonce },
    };
  }

  // --- 4. Execute ----------------------------------------------------------
  return spec.run(parsed, context);
}

export const __testing = {
  searchArgsSchema,
  createApplicationArgsSchema,
  updateStatusArgsSchema,
  jobIdArgsSchema,
  SPECS,
};

export type { AiFeature };
