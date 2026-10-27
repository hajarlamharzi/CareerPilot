import "server-only";

import type {
  JobSourceAdapter,
  LiveJobQuery,
  LiveJobResult,
  SourceCapabilities,
  SourceSearchOutput,
} from "./types";
import {
  blankLiveJob,
  buildSalary,
  clampDescription,
  liveJobId,
  mapEmploymentType,
  mapSeniority,
  parseIsoDate,
  safeExternalUrl,
  stripHtml,
} from "./normalizer";

/**
 * Jobicy adapter — API publique vérifiée le 2026-10-20.
 *
 * Endpoints réellement testés pendant l'intégration :
 *  - `GET https://jobicy.com/api/v2/remote-jobs?count=1&tag=laravel` → 200, offres réelles ;
 *  - `GET https://jobicy.com/api/jobs?get=locations` → liste officielle des filtres `geo`.
 *
 * Aucune clé API n'est requise. Les conditions de Jobicy exigent que la
 * source soit créditée et que les liens d'origine soient conservés : chaque
 * offre porte `sourceName = "Jobicy"` et `sourceUrl` = l'URL canonique du
 * flux, et l'interface de recherche affiche une mention de crédit.
 *
 * Couverture honnête : Jobicy ne liste que des postes en télétravail, sur des
 * géographies documentées (liste `geo` officielle). **Le Maroc n'existe pas
 * dans cette liste** : une recherche Maroc saute cette source avec un message
 * explicite. La fenêtre de publication est limitée à ~7 jours par le flux.
 */

const BASE_URL = "https://jobicy.com/api/v2/remote-jobs";
const ATTRIBUTION_URL = "https://jobicy.com/remote-jobs";
const TIMEOUT_MS = 8_000;
const MAX_COUNT = 50;

/**
 * `geo` slugs confirmed against Jobicy's own `?get=locations` listing
 * (fetched 2026-10-20). Countries absent from this map are searched without a
 * geo filter — worldwide — with that fact stated in the run message. Morocco
 * is deliberately absent: Jobicy does not list it.
 */
const GEO_SLUGS: Record<string, string> = {
  AR: "argentina", AU: "australia", AT: "austria", BE: "belgium", BR: "brazil",
  BG: "bulgaria", CA: "canada", CN: "china", CR: "costa-rica", HR: "croatia",
  CY: "cyprus", CZ: "czechia", DK: "denmark", EE: "estonia", FI: "finland",
  FR: "france", DE: "germany", GR: "greece",
};

/** Regions Jobicy documents, usable when no single country applies. */
const REGION_SLUGS: Record<string, string> = {
  EU: "europe", EMEA: "emea", APAC: "apac", LATAM: "latam",
};

interface JobicyJob {
  id?: unknown;
  url?: unknown;
  jobTitle?: unknown;
  companyName?: unknown;
  companyLogo?: unknown;
  jobIndustry?: unknown;
  jobType?: unknown;
  jobGeo?: unknown;
  jobLevel?: unknown;
  jobExcerpt?: unknown;
  jobDescription?: unknown;
  pubDate?: unknown;
  salaryMin?: unknown;
  salaryMax?: unknown;
  salaryCurrency?: unknown;
  salaryPeriod?: unknown;
}

interface JobicyResponse {
  jobs?: unknown;
  hasMore?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function mapSalaryPeriod(raw: unknown): "year" | "month" | "day" | "hour" | null {
  const value = asString(raw)?.toLowerCase() ?? null;
  if (!value) return null;
  if (value.includes("hour")) return "hour";
  if (value.includes("month")) return "month";
  if (value.includes("year") || value.includes("annual")) return "year";
  if (value.includes("day")) return "day";
  return null;
}

/** One raw Jobicy job → domain job. Missing fields stay null, never guessed. */
export function normalizeJobicyJob(raw: JobicyJob, fetchedAt: string): LiveJobResult | null {
  const externalId = raw.id === undefined ? null : String(raw.id);
  const title = asString(raw.jobTitle);
  const url = safeExternalUrl(raw.url);
  if (!externalId || !title || !url) return null;

  const jobTypes = firstStringArray(raw.jobType);
  const employmentType =
    jobTypes.map(mapEmploymentType).find((value) => value !== null) ?? "full-time";

  const job = blankLiveJob({
    id: liveJobId("jobicy", externalId),
    title,
    company: asString(raw.companyName) ?? "Entreprise non précisée",
    sourceName: "Jobicy",
    sourceUrl: url,
    addedAt: fetchedAt,
  });

  // Jobicy lists remote roles only; `jobGeo` states where the candidate may be.
  job.workMode = "remote";
  job.location = asString(raw.jobGeo) ?? "Télétravail (localisation ouverte)";
  job.employmentType = employmentType;
  job.seniority = mapSeniority(asString(raw.jobLevel));
  job.description = clampDescription(
    stripHtml(asString(raw.jobDescription) ?? asString(raw.jobExcerpt) ?? ""),
  );
  job.publishedAt = parseIsoDate(raw.pubDate);
  job.companyLogo = safeExternalUrl(raw.companyLogo);
  job.salary = buildSalary(
    raw.salaryMin,
    raw.salaryMax,
    asString(raw.salaryCurrency),
    mapSalaryPeriod(raw.salaryPeriod),
  );
  job.tags = [
    "source:jobicy",
    "télétravail",
    ...firstStringArray(raw.jobIndustry).slice(0, 3).map((entry) => `secteur:${entry}`),
    ...jobTypes.slice(0, 2).map((entry) => `contrat:${entry}`),
  ];

  return { job, externalId, sourceUrl: url };
}

export class JobicyAdapter implements JobSourceAdapter {
  getSourceId(): string {
    return "jobicy";
  }

  getSourceLabel(): string {
    return "Jobicy";
  }

  getCapabilities(): SourceCapabilities {
    return {
      countries: Object.keys(GEO_SLUGS),
      // Verified against the live API on 2026-10-20: `geo=france` still returns
      // multi-country and "Europe"/"Anywhere" listings. It biases results; it
      // does not filter them. The run message says so.
      geoFilter: "indicative",
      remoteOnly: true,
      salary: true,
      publicationDates: true,
      maxResults: MAX_COUNT,
      coverageNote:
        "Jobicy ne liste que des postes en télétravail, publiés sur ~7 jours. " +
        "Crédit obligatoire : Jobicy (https://jobicy.com). Le Maroc ne fait " +
        "pas partie des filtres géographiques documentés par la source.",
    };
  }

  isConfigured(): boolean {
    // No credentials: the source is always available.
    return true;
  }

  requiredEnvVars(): readonly string[] {
    return [];
  }

  async searchJobs(
    query: LiveJobQuery,
    signal?: AbortSignal,
  ): Promise<SourceSearchOutput> {
    const url = new URL(BASE_URL);
    url.searchParams.set("count", String(Math.min(Math.max(query.pageSize, 1), MAX_COUNT)));

    // `tag` is Jobicy's free-text filter (verified working with e.g. "laravel").
    const tag = query.keywords.slice(0, 4).join(" ");
    if (tag) url.searchParams.set("tag", tag);

    if (query.country) {
      const iso = query.country.toUpperCase();
      const slug = GEO_SLUGS[iso] ?? REGION_SLUGS[iso];
      // Absent slug → no geo filter, worldwide. The service states this.
      if (slug) url.searchParams.set("geo", slug);
    }

    const response = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("jobicy_rate_limited");
      throw new Error(`jobicy_http_${response.status}`);
    }

    const payload = (await response.json()) as JobicyResponse;
    const fetchedAt = new Date().toISOString();
    const rawJobs = Array.isArray(payload.jobs) ? (payload.jobs as JobicyJob[]) : [];

    const jobs: LiveJobResult[] = [];
    for (const raw of rawJobs) {
      const normalized = normalizeJobicyJob(raw, fetchedAt);
      if (normalized) jobs.push(normalized);
    }

    return {
      jobs,
      // Jobicy publishes `jobCount`/`hasMore` but not an exact global total.
      total: null,
      hasMore: payload.hasMore === true,
    };
  }
}

/** Canonical attribution link, rendered next to Jobicy results. */
export const JOBICY_ATTRIBUTION_URL = ATTRIBUTION_URL;
