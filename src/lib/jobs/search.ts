import "server-only";

import type { Job } from "@/types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { JobRow } from "@/lib/supabase/types";
import { notFound } from "@/lib/auth/errors";
import { toDomainJob, toProvenance } from "./mappers";
import { rankJob } from "./ranking";
import {
  CANDIDATE_LIMIT,
  buildFacets,
  buildResult,
  type JobFacets,
} from "./pipeline";
import type {
  CandidateContext,
  JobProvenance,
  JobSearchFilters,
  JobSearchHit,
  JobSearchResult,
} from "./types";

/**
 * Catalogue search, cloud edition.
 *
 * Structured filters (status, work mode, contract, seniority, currency, minimum
 * salary, publication date, sample flag) run **in PostgreSQL**, so the database
 * does the narrowing. Keyword and title matching then run in TypeScript through
 * the shared pipeline, which is what keeps cloud and local search bit-for-bit
 * consistent — and is honest about the trade-off: this shape is right for a
 * curated catalogue of hundreds to a few thousand rows, not a search engine.
 *
 * Row Level Security applies to every query below, so an unauthenticated caller
 * can only ever see `published`, unexpired listings.
 */

export interface CatalogueSearchOutcome {
  result: JobSearchResult;
  /** Job ids the caller has saved. Authoritative save state for the UI. */
  savedJobIds: string[];
  /** Job ids the caller already tracks in the application pipeline. */
  appliedJobIds: string[];
  /** Facet counts, computed from the same candidate set the search examined. */
  facets: JobFacets;
}

function toProvenanceMap(
  rows: readonly JobRow[],
): Map<string, JobProvenance> {
  const map = new Map<string, JobProvenance>();
  for (const row of rows) {
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

/** Apply only the filters PostgREST can express unambiguously. */
function buildStructuredQuery(
  supabase: ServerSupabaseClient,
  filters: JobSearchFilters,
) {
  let query = supabase
    .from("jobs")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_LIMIT);

  if (!filters.includeSamples) query = query.eq("is_sample", false);

  if (!filters.includeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }
  if (filters.workModes.length > 0) query = query.in("work_mode", filters.workModes);
  if (filters.employmentTypes.length > 0) {
    query = query.in("employment_type", filters.employmentTypes);
  }
  if (filters.seniorities.length > 0) query = query.in("seniority", filters.seniorities);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.publishedAfter) query = query.gte("published_at", filters.publishedAfter);
  if (filters.minSalary !== null) {
    // Keep rows whose advertised ceiling reaches the expectation. Rows without a
    // salary at all are filtered out by the pipeline, not silently included.
    query = query.or(
      `salary_max.gte.${filters.minSalary},salary_min.gte.${filters.minSalary}`,
    );
  }

  return query;
}

async function loadSavedAndApplied(
  supabase: ServerSupabaseClient,
  userId: string | null,
): Promise<{ savedJobIds: string[]; appliedJobIds: string[] }> {
  if (!userId) return { savedJobIds: [], appliedJobIds: [] };

  const [saved, applied] = await Promise.all([
    supabase.from("saved_jobs").select("job_id").eq("user_id", userId),
    supabase
      .from("applications")
      .select("job_id")
      .eq("user_id", userId)
      .not("job_id", "is", null),
  ]);

  return {
    savedJobIds: (saved.data ?? []).map((row) => row.job_id),
    appliedJobIds: (applied.data ?? [])
      .map((row) => row.job_id)
      .filter((id): id is string => Boolean(id)),
  };
}

export async function searchCloudCatalogue(
  supabase: ServerSupabaseClient,
  filters: JobSearchFilters,
  context: CandidateContext | null,
  userId: string | null,
): Promise<CatalogueSearchOutcome> {
  const [rowsResult, ownership] = await Promise.all([
    buildStructuredQuery(supabase, filters),
    loadSavedAndApplied(supabase, userId),
  ]);

  if (rowsResult.error) {
    throw new Error(`Recherche impossible : ${rowsResult.error.message}`);
  }

  const rows = rowsResult.data ?? [];
  const provenance = toProvenanceMap(rows);
  const savedSet = new Set(ownership.savedJobIds);
  const appliedSet = new Set(ownership.appliedJobIds);

  const candidates = rows.map((row) => ({
    job: toDomainJob(row, { savedJobIds: savedSet, appliedJobIds: appliedSet }),
    provenance: provenance.get(row.id) ?? toProvenance(row),
  }));

  const result = buildResult(
    candidates,
    filters,
    context,
    rows.length >= CANDIDATE_LIMIT,
  );

  return {
    result,
    savedJobIds: ownership.savedJobIds,
    appliedJobIds: ownership.appliedJobIds,
    facets: buildFacets(candidates.map((candidate) => candidate.job)),
  };
}

export interface JobDetail {
  job: Job;
  provenance: JobProvenance;
  rank: JobSearchHit["rank"];
  saved: boolean;
  applicationId: string | null;
}

/** Load one published listing plus the caller's own relationship to it. */
export async function getCloudJob(
  supabase: ServerSupabaseClient,
  jobId: string,
  context: CandidateContext | null,
  userId: string | null,
): Promise<JobDetail> {
  const { data: row, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(`Lecture de l'offre impossible : ${error.message}`);
  // `maybeSingle` returns null both when the row does not exist and when RLS
  // hides it. Either way the caller must not learn which.
  if (!row) throw notFound("Cette offre est introuvable ou n'est plus publiée.");

  let saved = false;
  let applicationId: string | null = null;

  if (userId) {
    const [savedRow, applicationRow] = await Promise.all([
      supabase
        .from("saved_jobs")
        .select("id")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .maybeSingle(),
      supabase
        .from("applications")
        .select("id")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .limit(1)
        .maybeSingle(),
    ]);
    saved = Boolean(savedRow.data);
    applicationId = applicationRow.data?.id ?? null;
  }

  const savedSet = new Set(saved ? [jobId] : []);
  const appliedSet = new Set(applicationId ? [jobId] : []);

  const job = toDomainJob(row, { savedJobIds: savedSet, appliedJobIds: appliedSet });
  const provenance = toProvenance(row);
  const rank = context ? rankJob(job, context) : null;

  return { job, provenance, rank, saved, applicationId };
}
