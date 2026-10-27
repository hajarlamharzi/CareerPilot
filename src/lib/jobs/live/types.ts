import type { EmploymentType, Job, Seniority } from "@/types";

/**
 * Contract every live job source adapter implements.
 *
 * Design rules, in priority order:
 *
 *  1. **No fabrication.** An adapter may only shape what the upstream API
 *     actually returned. Fields the source does not publish stay `null`/empty —
 *     never guessed, never defaulted to something plausible.
 *  2. **Isolation.** One broken, slow or misconfigured source must never break
 *     the others: every adapter call is bounded by a timeout and surfaced as a
 *     per-source status, not an exception.
 *  3. **Server-only credentials.** Adapters run exclusively in Route Handlers and
 *     server modules; API keys never reach browser code.
 *  4. **Honest capabilities.** `capabilities.countries` lists only markets the
 *     source documents or that were confirmed against its API. A search for an
 *     unlisted country is reported as "source not queried" — not silently
 *     dropped and not answered with another country's jobs.
 */

/** ISO 3166-1 alpha-2, uppercase. */
export type CountryCode = string;

export interface SourceCapabilities {
  /** Markets this source documents. Empty means "no geography filter". */
  countries: readonly CountryCode[];
  /**
   * How faithfully the source applies the country filter:
   *  - `strict`      — the request is scoped to that market server-side;
   *  - `indicative`  — the source biases results but also returns multi-country
   *                    or "anywhere" listings, so the UI must say so;
   *  - `none`        — no country filtering at all.
   */
  geoFilter: "strict" | "indicative" | "none";
  /** `true` when the source only lists remote-friendly roles. */
  remoteOnly: boolean;
  /** Whether listings carry salary data at all. */
  salary: boolean;
  /** Publication dates are part of the response. */
  publicationDates: boolean;
  /** Max results the source will return in one request. */
  maxResults: number;
  /** Human note shown in the provider settings panel. */
  coverageNote: string;
}

/** A validated search request, as handed to an adapter. */
export interface LiveJobQuery {
  /** Folded free-text keywords (already normalised by the caller). */
  keywords: string[];
  /** Target country, when the search is geography-bound. */
  country: CountryCode | null;
  /** City or region free text ("Rabat", "Paris"). */
  location: string | null;
  /** Remote-only preference. */
  remote: boolean;
  employmentTypes: EmploymentType[];
  seniority: Seniority | null;
  /** Minimum annual salary in the query currency, when provided. */
  minSalary: number | null;
  /** Only listings published within this many days, when provided. */
  withinDays: number | null;
  /** 1-based page number. */
  page: number;
  pageSize: number;
}

/** One normalised listing from one source. */
export interface LiveJobResult {
  /** Domain job, ready to render. `id` is namespaced `live:{source}:{extId}`. */
  job: Job;
  /** Stable upstream id, kept for dedup and provenance. */
  externalId: string;
  /** Canonical upstream listing URL (validated http/https). */
  sourceUrl: string | null;
}

export interface SourceSearchOutput {
  jobs: LiveJobResult[];
  /** Total the upstream reported, or `null` when it does not publish one. */
  total: number | null;
  /** `true` when the source indicated more pages remain. */
  hasMore: boolean;
}

export type SourceRunStatus = "ok" | "error" | "timeout" | "skipped" | "disabled";

/** Per-source outcome, always reported to the UI — success or failure. */
export interface SourceRunResult {
  sourceId: string;
  sourceLabel: string;
  status: SourceRunStatus;
  /** Listings returned by this source (before cross-source dedup). */
  resultCount: number;
  total: number | null;
  /** Safe, user-facing error message. Never contains credentials. */
  message: string | null;
  /** Epoch ms when this run completed. */
  checkedAt: number;
  durationMs: number;
  /** `true` when the response was served from the in-memory cache. */
  cached: boolean;
}

export interface JobSourceAdapter {
  getSourceId(): string;
  getSourceLabel(): string;
  getCapabilities(): SourceCapabilities;
  /** `false` when required credentials are absent — the source is disabled. */
  isConfigured(): boolean;
  /** Environment variables this source needs, for the setup message. */
  requiredEnvVars(): readonly string[];
  searchJobs(query: LiveJobQuery, signal?: AbortSignal): Promise<SourceSearchOutput>;
}

/** Job provenance for live results — labelled as external, never as catalogue. */
export const LIVE_PROVENANCE_LABEL = "Source externe en direct";
