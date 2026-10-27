import type { Job, JobStatus, SalaryRange } from "@/types";
import type { JobRow, TablesInsert } from "@/lib/supabase/types";
import {
  JOB_PROVENANCE_DESCRIPTIONS,
  JOB_PROVENANCE_LABELS,
  type JobProvenance,
  type JobProvenanceKind,
} from "./types";

/**
 * Adapters between the PostgreSQL row shape (`snake_case`, normalised, several
 * tables) and the application's domain `Job` (camelCase, one object).
 *
 * Everything that crosses the database boundary funnels through here, so a
 * column rename is a one-file change and there is exactly one place to audit for
 * "did we leak another user's data?".
 */

export interface JobHydrationContext {
  /** Job ids the signed-in user has saved. */
  savedJobIds?: ReadonlySet<string>;
  /** Job ids the signed-in user has an application for. */
  appliedJobIds?: ReadonlySet<string>;
}

/**
 * Map a catalogue row to the domain type.
 *
 * Two honest caveats, both documented in the architecture notes:
 *
 *  1. `Job.status` in the browser-storage model *is* the user's own pipeline
 *     state. In the cloud model that state lives in `saved_jobs` and
 *     `applications`, so it is reconstructed from `JobHydrationContext`.
 *     `savedJobIds` in the search result remains the authoritative "have I saved
 *     this?" answer; `status` is a convenience projection for existing views.
 *  2. `companyWebsite`, `companyLogo`, `responsibilities` and `education` have no
 *     column: the schema stores a single `description`. They come back as
 *     `null`/empty rather than being invented.
 */
export function toDomainJob(
  row: JobRow,
  context: JobHydrationContext = {},
): Job {
  const salary = toDomainSalary(row);
  const saved = context.savedJobIds?.has(row.id) ?? false;
  const applied = context.appliedJobIds?.has(row.id) ?? false;

  return {
    id: row.id,
    title: row.title,
    company: row.company_name,
    companyWebsite: null,
    companyLogo: null,
    location: row.location ?? "",
    workMode: row.work_mode ?? "onsite",
    employmentType: row.employment_type ?? "full-time",
    seniority: row.seniority,
    salary,
    description: row.description ?? "",
    responsibilities: [],
    requiredSkills: row.required_skills ?? [],
    preferredSkills: row.preferred_skills ?? [],
    experienceYears: row.experience_years,
    education: null,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    publishedAt: row.published_at,
    deadline: row.expires_at,
    addedAt: row.created_at,
    status: toDomainStatus(saved, applied),
    notes: null,
    tags: [],
    origin: row.is_sample || row.source_type === "sample" ? "demo" : "user",
  };
}

function toDomainStatus(saved: boolean, applied: boolean): JobStatus {
  if (applied) return "applied";
  if (saved) return "saved";
  // Not saved and not applied: the listing is simply part of the public
  // catalogue. `archived` is used because no candidate-specific state exists yet
  // and it is the only neutral value in the domain union. Views must rely on
  // `savedJobIds` rather than this projection for save state.
  return "archived";
}

function toDomainSalary(row: JobRow): SalaryRange | null {
  if (row.salary_min === null && row.salary_max === null) return null;
  return {
    min: row.salary_min,
    max: row.salary_max,
    currency: row.currency ?? "MAD",
    period: "year",
  };
}

/** Derive the honest provenance badge for a listing. */
export function toProvenance(row: {
  source_type: JobRow["source_type"];
  source_name: string | null;
  source_url: string | null;
  is_sample: boolean;
}): JobProvenance {
  const kind: JobProvenanceKind = row.is_sample ? "sample" : row.source_type;
  return {
    kind,
    label: JOB_PROVENANCE_LABELS[kind],
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    isSample: kind === "sample",
    // Only an administrator-managed source that carries an upstream URL counts
    // as verified. A row typed by hand is "in the catalogue", not "verified".
    isVerified:
      !row.is_sample &&
      (row.source_type === "platform" || row.source_type === "api") &&
      Boolean(row.source_url),
  };
}

export function describeProvenance(provenance: JobProvenance): string {
  return JOB_PROVENANCE_DESCRIPTIONS[provenance.kind];
}

// ---------------------------------------------------------------------------
// Domain → row
// ---------------------------------------------------------------------------

export interface JobWriteInput {
  title: string;
  company: string;
  description: string | null;
  location: string | null;
  workMode: Job["workMode"] | null;
  employmentType: Job["employmentType"] | null;
  seniority: Job["seniority"] | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceType: JobRow["source_type"];
  externalId: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  status: JobRow["status"];
  isSample: boolean;
  createdBy: string | null;
}

export function toJobInsert(input: JobWriteInput): TablesInsert<"jobs"> {
  return {
    title: input.title,
    company_name: input.company,
    description: input.description,
    location: input.location,
    work_mode: input.workMode,
    employment_type: input.employmentType,
    seniority: input.seniority,
    salary_min: input.salaryMin,
    salary_max: input.salaryMax,
    currency: input.currency,
    required_skills: input.requiredSkills,
    preferred_skills: input.preferredSkills,
    experience_years: input.experienceYears,
    source_name: input.sourceName,
    source_url: input.sourceUrl,
    source_type: input.sourceType,
    external_id: input.externalId,
    published_at: input.publishedAt,
    expires_at: input.expiresAt,
    status: input.status,
    is_sample: input.isSample,
    created_by: input.createdBy,
  };
}

/** Inverse of `toJobInsert` for round-tripping an existing domain job. */
export function fromDomainJob(job: Job, createdBy: string | null): JobWriteInput {
  return {
    title: job.title,
    company: job.company,
    description: job.description || null,
    location: job.location || null,
    workMode: job.workMode,
    employmentType: job.employmentType,
    seniority: job.seniority,
    salaryMin: job.salary?.min ?? null,
    salaryMax: job.salary?.max ?? null,
    currency: job.salary?.currency ?? null,
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    experienceYears: job.experienceYears,
    sourceName: job.sourceName,
    sourceUrl: job.sourceUrl,
    sourceType: job.origin === "demo" ? "sample" : "platform",
    externalId: null,
    publishedAt: job.publishedAt,
    expiresAt: job.deadline,
    status: "published",
    isSample: job.origin === "demo",
    createdBy,
  };
}
