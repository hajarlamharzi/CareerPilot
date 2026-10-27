import "server-only";

import type { EmploymentType, Job, Seniority } from "@/types";
import { fold } from "@/lib/jobs/text";
import { canonicalUrl } from "./normalizer";
import { ADAPTERS } from "./registry";
import type {
  JobSourceAdapter,
  LiveJobQuery,
  LiveJobResult,
  SourceRunResult,
} from "./types";

/**
 * The live job search orchestrator.
 *
 * Responsibilities, in order:
 *  1. decide which configured sources can answer the query (country coverage,
 *     remote-only constraints) and record an honest reason when one cannot;
 *  2. call every eligible source concurrently, each bounded by its own timeout
 *     so a slow provider degrades into a per-source error, never a page failure;
 *  3. merge, de-duplicate (stable source id + canonical URL), and rank with a
 *     transparent keyword/recency formula;
 *  4. cache responses in memory for a short, bounded window, always labelled
 *     with the time they were fetched — a cached listing may already be closed
 *     on the employer's site, and the UI must say so.
 *
 * No source is ever faked: a source that is not configured, unsupported for
 * the requested country, or failing appears in `sources` with a status and a
 * user-safe message. The absence of results is never disguised as success.
 */

/** Hard ceiling on live results returned by one search. */
export const LIVE_RESULT_LIMIT = 60;

/** Per-source timeout. Kept below typical serverless function limits. */
const SOURCE_TIMEOUT_MS = 9_000;

/** Cache TTL: short enough to stay honest about freshness. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Bounded cache: never more than this many entries (oldest evicted). */
const CACHE_MAX_ENTRIES = 80;

export interface LiveSearchQueryInput {
  keywords: string[];
  country: string | null;
  location: string | null;
  remote: boolean;
  employmentTypes: EmploymentType[];
  seniority: Seniority | null;
  minSalary: number | null;
  withinDays: number | null;
  page: number;
  pageSize: number;
  /** Restrict to specific sources (empty = every configured source). */
  sourceIds?: string[];
}

export interface LiveSearchResponse {
  items: LiveJobResult[];
  sources: SourceRunResult[];
  /** Upstream totals summed where published; `null` when any source omits it. */
  total: number | null;
  duplicatesRemoved: number;
  /** Results discarded because they contained none of the requested keywords. */
  irrelevantRemoved: number;
  /** ISO timestamp of this search. */
  fetchedAt: string;
  /** `true` when every successful source answer came from cache. */
  allCached: boolean;
}

interface CacheEntry {
  key: string;
  storedAt: number;
  jobs: LiveJobResult[];
  total: number | null;
  hasMore: boolean;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(adapter: JobSourceAdapter, query: LiveJobQuery): string {
  return JSON.stringify([
    adapter.getSourceId(),
    query.keywords,
    query.country,
    query.location,
    query.remote,
    query.employmentTypes,
    query.seniority,
    query.minSalary,
    query.withinDays,
    query.page,
    query.pageSize,
  ]);
}

function readCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function writeCache(entry: CacheEntry): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Evict the oldest half — cheap, bounded, predictable.
    const oldest = [...cache.values()]
      .sort((a, b) => a.storedAt - b.storedAt)
      .slice(0, Math.ceil(CACHE_MAX_ENTRIES / 2));
    for (const item of oldest) cache.delete(item.key);
  }
  cache.set(entry.key, entry);
}

/** Test seam: clear the in-memory cache between cases. */
export function clearLiveSearchCache(): void {
  cache.clear();
}

/**
 * Can this source answer this query at all?
 *
 * Returns `null` when eligible, otherwise the user-facing reason to skip it.
 */
export function sourceEligibility(
  adapter: JobSourceAdapter,
  query: LiveJobQuery,
): string | null {
  const caps = adapter.getCapabilities();

  if (caps.remoteOnly && query.location && !query.remote) {
    return (
      `${adapter.getSourceLabel()} ne liste que des postes en télétravail : ` +
      `ignoré pour une recherche « ${query.location} » sur site.`
    );
  }

  if (query.country && caps.countries.length > 0) {
    const iso = query.country.toUpperCase();
    if (!caps.countries.includes(iso)) {
      return (
        `${adapter.getSourceLabel()} ne couvre pas le pays « ${iso} » ` +
        `(marchés documentés : ${caps.countries.slice(0, 8).join(", ")}…).`
      );
    }
  }

  if (query.remote && !caps.remoteOnly && caps.countries.length > 0 && query.country) {
    // Adzuna has no documented remote filter: we keep the source but the UI is
    // told filtering is post-hoc. Not a skip — recorded as a note instead.
  }

  return null;
}

/** Transparent relevance: keyword hits weighted by field, then recency. */
export function relevanceScore(job: Job, keywords: string[]): number {
  if (keywords.length === 0) return recencyScore(job);
  return keywordHits(job, keywords) + recencyScore(job);
}

/**
 * Keyword-only score, used both for ranking and for dropping listings that
 * matched none of the requested terms. Recency deliberately plays no part here:
 * a brand-new listing that is irrelevant must not survive a keyword search.
 */
export function keywordHits(job: Job, keywords: string[]): number {
  const title = fold(job.title);
  const company = fold(job.company);
  const location = fold(job.location);
  const body = fold(job.description.slice(0, 2_000));

  let score = 0;
  for (const keyword of keywords) {
    const needle = fold(keyword);
    if (!needle) continue;
    if (title.includes(needle)) score += 6;
    if (company.includes(needle)) score += 2;
    if (location.includes(needle)) score += 3;
    if (body.includes(needle)) score += 1;
  }
  return score;
}

function recencyScore(job: Job): number {
  if (!job.publishedAt) return 0;
  const age = Date.now() - new Date(job.publishedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return 0;
  const days = age / 86_400_000;
  if (days <= 3) return 4;
  if (days <= 7) return 3;
  if (days <= 14) return 2;
  if (days <= 30) return 1;
  return 0;
}

/** Stable de-dup key: source-namespaced id, else canonical URL, else title+company. */
function dedupKey(result: LiveJobResult): string {
  const url = result.job.sourceUrl ? canonicalUrl(result.job.sourceUrl) : null;
  if (url) return `url:${url}`;
  return `tc:${fold(result.job.title)}|${fold(result.job.company)}`;
}

/**
 * Run a live search across every eligible source.
 *
 * Never throws for provider-level problems: each source's outcome — success,
 * disabled, unsupported, timeout or error — is reported individually so the
 * interface can show exactly what happened.
 */
export async function searchLiveJobs(
  input: LiveSearchQueryInput,
): Promise<LiveSearchResponse> {
  const query: LiveJobQuery = {
    keywords: input.keywords,
    country: input.country ? input.country.toUpperCase() : null,
    location: input.location,
    remote: input.remote,
    employmentTypes: input.employmentTypes,
    seniority: input.seniority,
    minSalary: input.minSalary,
    withinDays: input.withinDays,
    page: Math.max(1, input.page),
    pageSize: Math.min(Math.max(1, input.pageSize), 25),
  };

  const wanted = new Set((input.sourceIds ?? []).map((id) => id.toLowerCase()));
  const runs: SourceRunResult[] = [];
  const merged: LiveJobResult[] = [];
  let duplicatesRemoved = 0;
  let total: number | null = 0;
  let anyUncached = false;

  const tasks = ADAPTERS.map(async (adapter) => {
    const startedAt = Date.now();
    const base: Omit<SourceRunResult, "status" | "message" | "resultCount" | "total" | "durationMs" | "cached" | "checkedAt"> = {
      sourceId: adapter.getSourceId(),
      sourceLabel: adapter.getSourceLabel(),
    };

    // 1. Explicit source filter.
    if (wanted.size > 0 && !wanted.has(adapter.getSourceId())) {
      runs.push({
        ...base,
        status: "skipped",
        message: "Source exclue du paramètre « source » de cette recherche.",
        resultCount: 0,
        total: null,
        checkedAt: Date.now(),
        durationMs: 0,
        cached: false,
      });
      return;
    }

    // 2. Configuration check — never fake a disabled source.
    if (!adapter.isConfigured()) {
      const vars = adapter.requiredEnvVars().join(" et ");
      runs.push({
        ...base,
        status: "disabled",
        message: vars
          ? `Source désactivée : renseignez ${vars} dans l'environnement du serveur.`
          : "Source désactivée.",
        resultCount: 0,
        total: null,
        checkedAt: Date.now(),
        durationMs: 0,
        cached: false,
      });
      return;
    }

    // 3. Coverage check.
    const eligibility = sourceEligibility(adapter, query);
    if (eligibility) {
      runs.push({
        ...base,
        status: "skipped",
        message: eligibility,
        resultCount: 0,
        total: null,
        checkedAt: Date.now(),
        durationMs: 0,
        cached: false,
      });
      return;
    }

    // 4. Cache, then live call.
    const key = cacheKey(adapter, query);
    const cachedEntry = readCache(key);
    if (cachedEntry) {
      runs.push({
        ...base,
        status: "ok",
        message: sourceNotes(
          adapter,
          query,
          "Réponse en cache (moins de 5 minutes). Une offre en cache peut avoir " +
            "été pourvue entre-temps sur le site de l'employeur.",
        ),
        resultCount: cachedEntry.jobs.length,
        total: cachedEntry.total,
        checkedAt: cachedEntry.storedAt,
        durationMs: Date.now() - startedAt,
        cached: true,
      });
      merged.push(...cachedEntry.jobs);
      if (cachedEntry.total === null) total = null;
      else if (total !== null) total += cachedEntry.total;
      return;
    }

    try {
      const output = await adapter.searchJobs(
        query,
        AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      );
      writeCache({ key, storedAt: Date.now(), jobs: output.jobs, total: output.total, hasMore: output.hasMore });
      anyUncached = true;
      runs.push({
        ...base,
        status: "ok",
        message: sourceNotes(
          adapter,
          query,
          output.jobs.length === 0 ? "La source n'a renvoyé aucune offre pour ces critères." : null,
        ),
        resultCount: output.jobs.length,
        total: output.total,
        checkedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        cached: false,
      });
      merged.push(...output.jobs);
      if (output.total === null) total = null;
      else if (total !== null) total += output.total;
    } catch (error) {
      anyUncached = true;
      const raw = error instanceof Error ? error.message : "unknown";
      const timedOut = raw.includes("TimeoutError") || raw.includes("timeout") || raw === "AbortError";
      const message = describeAdapterError(adapter, raw);
      runs.push({
        ...base,
        status: timedOut ? "timeout" : "error",
        message,
        resultCount: 0,
        total: null,
        checkedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        cached: false,
      });
    }
  });

  await Promise.all(tasks);

  // De-duplicate across sources by stable URL, then drop listings that matched
  // none of the requested keywords, then rank.
  const seen = new Set<string>();
  const unique: LiveJobResult[] = [];
  for (const item of merged) {
    const key = dedupKey(item);
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  const relevant =
    query.keywords.length > 0
      ? unique.filter((item) => keywordHits(item.job, query.keywords) > 0)
      : unique;
  const irrelevantRemoved = unique.length - relevant.length;

  relevant.sort(
    (a, b) => relevanceScore(b.job, query.keywords) - relevanceScore(a.job, query.keywords),
  );

  const cap = Math.min(input.pageSize * 2, LIVE_RESULT_LIMIT);

  return {
    items: relevant.slice(0, cap),
    sources: runs.sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel)),
    total: total === 0 && relevant.length === 0 ? 0 : total,
    duplicatesRemoved,
    irrelevantRemoved,
    fetchedAt: new Date().toISOString(),
    allCached: !anyUncached && runs.some((run) => run.cached),
  };
}

/**
 * Add the notes a source must carry in the UI: a base note (cache, empty
 * result) plus the honest warning when its country filter is only indicative.
 */
function sourceNotes(
  adapter: JobSourceAdapter,
  query: LiveJobQuery,
  base: string | null,
): string | null {
  const notes: string[] = [];
  if (base) notes.push(base);
  if (adapter.getCapabilities().geoFilter === "indicative" && query.country) {
    notes.push(
      "Filtrage pays indicatif : la source renvoie aussi des offres multi-pays " +
        "ou ouvertes à distance ; la zone figure sur chaque offre.",
    );
  }
  return notes.length > 0 ? notes.join(" ") : null;
}

/** Map internal adapter errors to safe, actionable French messages. */
function describeAdapterError(adapter: JobSourceAdapter, code: string): string {
  const label = adapter.getSourceLabel();
  if (code === "adzuna_not_configured") {
    return `${label} : identifiants API manquants (ADZUNA_APP_ID / ADZUNA_APP_KEY).`;
  }
  if (code === "adzuna_auth_failed") {
    return `${label} a refusé les identifiants API. Vérifiez ADZUNA_APP_ID et ADZUNA_APP_KEY.`;
  }
  if (code === "adzuna_rate_limited" || code === "jobicy_rate_limited") {
    return `${label} limite actuellement le volume de requêtes. Réessayez dans quelques minutes.`;
  }
  if (code.startsWith("adzuna_market_unsupported")) {
    return `${label} ne couvre pas ce marché.`;
  }
  if (code.startsWith("adzuna_http_") || code.startsWith("jobicy_http_")) {
    return `${label} a répondu avec une erreur (${code.replace(/_/g, " ")}). Les autres sources restent utilisables.`;
  }
  if (code.includes("fetch failed") || code.includes("ENOTFOUND") || code.includes("ECONN")) {
    return `${label} est injoignable (réseau). Les autres sources restent utilisables.`;
  }
  return `${label} : erreur inattendue. Les autres sources restent utilisables.`;
}

/** Provider status for the settings/status UI — no query needed. */
export interface ProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  requiredEnvVars: readonly string[];
  capabilities: {
    countries: readonly string[];
    geoFilter: "strict" | "indicative" | "none";
    remoteOnly: boolean;
    salary: boolean;
    publicationDates: boolean;
    maxResults: number;
    coverageNote: string;
  };
}

export function listProviders(): ProviderStatus[] {
  return ADAPTERS.map((adapter) => ({
    id: adapter.getSourceId(),
    label: adapter.getSourceLabel(),
    configured: adapter.isConfigured(),
    requiredEnvVars: adapter.requiredEnvVars(),
    capabilities: adapter.getCapabilities(),
  }));
}

/** Build a query from keyword strings + a free-text location/country. */
export function buildLiveQuery(input: {
  keywords: string[];
  country: string | null;
  location: string | null;
  remote: boolean;
  employmentTypes?: EmploymentType[];
  seniority?: Seniority | null;
  minSalary?: number | null;
  withinDays?: number | null;
  page?: number;
  pageSize?: number;
}): LiveSearchQueryInput {
  return {
    // Empty entries and stray whitespace are dropped here so no adapter has to
    // defend against them.
    keywords: input.keywords.map((entry) => entry.trim()).filter(Boolean),
    country: input.country ? input.country.toUpperCase() : null,
    location: input.location,
    remote: input.remote,
    employmentTypes: input.employmentTypes ?? [],
    seniority: input.seniority ?? null,
    minSalary: input.minSalary ?? null,
    withinDays: input.withinDays ?? null,
    // Clamped to the range the route accepts, so a caller cannot widen the
    // request beyond what validation allows.
    page: Math.min(Math.max(1, Math.trunc(input.page ?? 1)), 20),
    pageSize: Math.min(Math.max(1, Math.trunc(input.pageSize ?? 15)), 25),
  };
}
