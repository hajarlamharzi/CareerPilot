import type { Job } from "@/types";
import { fold } from "./text";
import { rankJob } from "./ranking";
import type {
  CandidateContext,
  JobProvenance,
  JobSearchFilters,
  JobSearchHit,
  JobSearchResult,
} from "./types";

/**
 * The search pipeline, as pure functions.
 *
 * Filtering, ranking, sorting and pagination all happen here so that the
 * browser-storage catalogue and the PostgreSQL catalogue behave identically —
 * there is exactly one definition of "does this job match?", and it is unit
 * tested without a database.
 *
 * Deliberately documented limitation: keyword matching is substring-based on
 * folded text, not PostgreSQL full-text search. It is predictable, accent
 * insensitive and good enough for a curated catalogue. The schema already
 * carries a GIN index on `to_tsvector(...)` should a much larger catalogue
 * require `websearch_to_tsquery` ranking later.
 */

/** Hard ceiling on rows considered in one search. */
export const CANDIDATE_LIMIT = 500;

function matchesAny(haystack: string | null, needles: readonly string[]): boolean {
  if (needles.length === 0) return true;
  if (!haystack) return false;
  const folded = fold(haystack);
  return needles.some((needle) => folded.includes(fold(needle)));
}

function isExpired(job: Job, now: number): boolean {
  if (!job.deadline) return false;
  const deadline = Date.parse(job.deadline);
  return Number.isFinite(deadline) && deadline < now;
}

function salaryCeiling(job: Job): number | null {
  if (!job.salary) return null;
  return job.salary.max ?? job.salary.min;
}

/** `true` when `job` satisfies every active structured and keyword filter. */
export function matchesFilters(
  job: Job,
  provenance: JobProvenance,
  filters: JobSearchFilters,
  now: number = Date.now(),
): boolean {
  if (!filters.includeSamples && provenance.isSample) return false;
  if (!filters.includeExpired && isExpired(job, now)) return false;

  if (filters.workModes.length > 0 && !filters.workModes.includes(job.workMode)) {
    return false;
  }
  if (
    filters.employmentTypes.length > 0 &&
    !filters.employmentTypes.includes(job.employmentType)
  ) {
    return false;
  }
  if (
    filters.seniorities.length > 0 &&
    (!job.seniority || !filters.seniorities.includes(job.seniority))
  ) {
    return false;
  }
  if (filters.currency && job.salary && job.salary.currency !== filters.currency) {
    return false;
  }

  if (filters.minSalary !== null) {
    const ceiling = salaryCeiling(job);
    // No advertised salary ⇒ cannot confirm the expectation ⇒ exclude, and say so
    // in the empty state rather than guessing.
    if (ceiling === null || ceiling < filters.minSalary) return false;
  }

  if (filters.publishedAfter) {
    if (!job.publishedAt) return false;
    if (Date.parse(job.publishedAt) < Date.parse(filters.publishedAfter)) {
      return false;
    }
  }

  if (!matchesAny(job.location, filters.locations)) return false;
  if (!matchesAny(job.company, filters.companies)) return false;
  if (!matchesAny(job.title, filters.titles)) return false;

  if (filters.query) {
    const terms = filters.query
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 1);
    if (terms.length > 0) {
      const haystack = fold(
        [
          job.title,
          job.company,
          job.location,
          job.description,
          job.requiredSkills.join(" "),
          job.preferredSkills.join(" "),
        ].join(" "),
      );
      // Every term must appear somewhere: "stage data" must match both.
      if (!terms.every((term) => haystack.includes(fold(term)))) return false;
    }
  }

  return true;
}

export type ProvenanceResolver = (job: Job) => JobProvenance;

/**
 * Default provenance for catalogue jobs coming from browser storage.
 *
 * A user-created entry that carries an external URL is labelled as
 * user-submitted — the app must not imply it verified somebody else's advert.
 */
export const localProvenance: ProvenanceResolver = (job) => {
  if (job.origin === "demo") {
    return {
      kind: "sample",
      label: "Donnée d'exemple",
      sourceName: job.sourceName,
      sourceUrl: job.sourceUrl,
      isSample: true,
      isVerified: false,
    };
  }
  if (job.sourceUrl) {
    return {
      kind: "user-submitted",
      label: "Proposée par un utilisateur",
      sourceName: job.sourceName,
      sourceUrl: job.sourceUrl,
      isSample: false,
      isVerified: false,
    };
  }
  return {
    kind: "platform",
    label: "Catalogue CareerPilot",
    sourceName: job.sourceName,
    sourceUrl: null,
    isSample: false,
    isVerified: false,
  };
};

/** Rank, sort and page a candidate set. Pure. */
export function buildResult(
  candidates: { job: Job; provenance: JobProvenance }[],
  filters: JobSearchFilters,
  context: CandidateContext | null,
  truncated = false,
): JobSearchResult {
  const now = Date.now();

  const matched = candidates.filter(({ job, provenance }) =>
    matchesFilters(job, provenance, filters, now),
  );

  const hits: JobSearchHit[] = matched.map(({ job, provenance }) => ({
    job,
    provenance,
    rank: context ? rankJob(job, context) : null,
  }));

  sortHits(hits, filters);

  const total = hits.length;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * filters.pageSize;
  const items = hits.slice(start, start + filters.pageSize);

  if (truncated) {
    console.warn(
      `[careerpilot] search examined only the first ${CANDIDATE_LIMIT} catalogue rows; ` +
        "narrow the filters or move ranking into SQL before the catalogue grows past this.",
    );
  }

  return {
    items,
    total,
    page,
    pageSize: filters.pageSize,
    pageCount,
    source: "catalogue",
    appliedFilters: filters,
  };
}

/** Deterministic total ordering, so equal scores never shuffle between renders. */
export function sortHits(hits: JobSearchHit[], filters: JobSearchFilters): void {
  const byRecent = (a: JobSearchHit, b: JobSearchHit): number => {
    const aTime = a.job.publishedAt ? Date.parse(a.job.publishedAt) : 0;
    const bTime = b.job.publishedAt ? Date.parse(b.job.publishedAt) : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.job.title.localeCompare(b.job.title, "fr");
  };

  const comparators: Record<JobSearchFilters["sort"], (a: JobSearchHit, b: JobSearchHit) => number> = {
    relevance: (a, b) => {
      const scoreDiff = (b.rank?.score ?? 0) - (a.rank?.score ?? 0);
      return scoreDiff !== 0 ? scoreDiff : byRecent(a, b);
    },
    recent: byRecent,
    salary: (a, b) => {
      const aCeiling = salaryCeiling(a.job) ?? -1;
      const bCeiling = salaryCeiling(b.job) ?? -1;
      if (bCeiling !== aCeiling) return bCeiling - aCeiling;
      return byRecent(a, b);
    },
    company: (a, b) => {
      const diff = a.job.company.localeCompare(b.job.company, "fr");
      return diff !== 0 ? diff : byRecent(a, b);
    },
  };

  hits.sort(comparators[filters.sort]);
}

/** In-memory catalogue search. Used in local demo mode and in tests. */
export function searchLocalCatalogue(
  jobs: readonly Job[],
  filters: JobSearchFilters,
  context: CandidateContext | null,
  resolveProvenance: ProvenanceResolver = localProvenance,
): JobSearchResult {
  const candidates = jobs.map((job) => ({
    job,
    provenance: resolveProvenance(job),
  }));
  return buildResult(candidates, filters, context, false);
}

/** Facets for the filter sidebar, computed from the same candidate set. */
export interface JobFacets {
  companies: { value: string; count: number }[];
  locations: { value: string; count: number }[];
  sources: { value: string; count: number }[];
}

export function buildFacets(jobs: readonly Job[]): JobFacets {
  const count = (values: (string | null)[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const value of values) {
      if (!value) continue;
      const key = value.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  };

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([value, occurrences]) => ({ value, count: occurrences }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"))
      .slice(0, 30);

  return {
    companies: toSorted(count(jobs.map((job) => job.company))),
    locations: toSorted(count(jobs.map((job) => job.location || null))),
    sources: toSorted(count(jobs.map((job) => job.sourceName))),
  };
}
