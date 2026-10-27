import "server-only";

import { ADZUNA_APP_ID, ADZUNA_APP_KEY } from "@/lib/env.server";
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
  mapWorkMode,
  parseIsoDate,
  safeExternalUrl,
  stripHtml,
} from "./normalizer";

/**
 * Adzuna adapter — https://developer.adzuna.com/docs/search
 *
 * Official, documented REST API. Credentials (`app_id` + `app_key`) are read
 * server-side only; without them the adapter reports itself disabled and the
 * search service surfaces an honest setup message instead of fake rows.
 *
 * Coverage honesty: Adzuna documents 19 markets (the ISO list in
 * `CAPABILITIES.countries`). **Morocco is not one of them** — a search for MA
 * therefore skips this adapter with an explicit message rather than silently
 * returning another country's jobs. The API is the final authority: if Adzuna
 * adds a market, the list here is the single place to update.
 *
 * Salary currency: Adzuna publishes amounts in each market's local currency
 * (their job pages show e.g. £ in GB, € in FR). `COUNTRY_CURRENCY` mirrors that
 * documented behaviour; an unmapped market drops the salary rather than
 * guessing a currency.
 */

const BASE_URL = "https://api.adzuna.com/v1/api/jobs";

/** Adzuna's documented markets, as they appear in the URL path. */
const ADZUNA_MARKETS = [
  "AT", "AU", "BE", "BR", "CA", "CH", "DE", "ES", "FR", "GB",
  "IN", "IT", "MX", "NL", "NZ", "PL", "SG", "US", "ZA",
] as const;

/** Local currency per market — documented Adzuna behaviour, not a guess. */
const COUNTRY_CURRENCY: Record<string, string> = {
  AT: "EUR", AU: "AUD", BE: "EUR", BR: "BRL", CA: "CAD", CH: "CHF",
  DE: "EUR", ES: "EUR", FR: "EUR", GB: "GBP", IN: "INR", IT: "EUR",
  MX: "MXN", NL: "EUR", NZ: "NZD", PL: "PLN", SG: "SGD", US: "USD",
  ZA: "ZAR",
};

const TIMEOUT_MS = 8_000;
const MAX_PAGE_SIZE = 50;

const CAPABILITIES: SourceCapabilities = {
  countries: ADZUNA_MARKETS,
  geoFilter: "strict",
  remoteOnly: false,
  salary: true,
  publicationDates: true,
  maxResults: MAX_PAGE_SIZE,
  coverageNote:
    "Adzuna couvre 19 marchés documentés (dont la France). Le Maroc ne figure " +
    "pas parmi eux : les recherches Maroc ne passent pas par cette source. " +
    "Les offres renvoient vers la page source d'Adzuna, jamais vers un lien " +
    "de candidature directe.",
};

/** Raw shape of one Adzuna result — only fields the API actually returns. */
interface AdzunaResult {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  redirect_url?: unknown;
  created?: unknown;
  salary_min?: unknown;
  salary_max?: unknown;
  salary_is_predicted?: unknown;
  contract_type?: unknown;
  contract_time?: unknown;
  category?: { label?: unknown };
  company?: { display_name?: unknown; url?: unknown; logo?: unknown };
  location?: { display_name?: unknown; area?: unknown[] };
}

interface AdzunaResponse {
  count?: unknown;
  results?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** One raw result → domain job. Unpublished fields stay null/empty. */
export function normalizeAdzunaResult(
  raw: AdzunaResult,
  country: string,
  fetchedAt: string,
): LiveJobResult | null {
  const externalId = asString(raw.id);
  const title = asString(raw.title);
  if (!externalId || !title) return null;

  const currency = COUNTRY_CURRENCY[country] ?? null;
  const sourceUrl = safeExternalUrl(raw.redirect_url);
  const description = clampDescription(stripHtml(asString(raw.description) ?? ""));

  const contractType = asString(raw.contract_type);
  const contractTime = asString(raw.contract_time);
  const employmentType =
    mapEmploymentType(contractTime) ?? mapEmploymentType(contractType) ?? "full-time";

  const location = asString(raw.location?.display_name) ?? "";
  const workMode =
    mapWorkMode([title, location]) ?? "onsite";

  const job = blankLiveJob({
    id: liveJobId("adzuna", externalId),
    title,
    company: asString(raw.company?.display_name) ?? "Entreprise non précisée",
    sourceName: "Adzuna",
    sourceUrl,
    addedAt: fetchedAt,
  });

  job.location = location;
  job.workMode = workMode;
  job.employmentType = employmentType;
  job.description = description;
  job.publishedAt = parseIsoDate(raw.created);
  job.companyWebsite = safeExternalUrl(raw.company?.url);
  job.companyLogo = safeExternalUrl(raw.company?.logo);
  // `salary_is_predicted` marks an estimated salary: the value is kept but the
  // UI must label it. Stored as a tag so nothing downstream presents it as
  // confirmed.
  const predicted = raw.salary_is_predicted === 1 || raw.salary_is_predicted === "1";
  job.salary = buildSalary(raw.salary_min, raw.salary_max, currency, "year");
  job.tags = [
    "source:adzuna",
    `pays:${country.toLowerCase()}`,
    ...(predicted ? ["salaire:estimé"] : []),
    ...(asString(raw.category?.label) ? [`catégorie:${asString(raw.category?.label)}`] : []),
  ];

  return { job, externalId, sourceUrl };
}

export class AdzunaAdapter implements JobSourceAdapter {
  getSourceId(): string {
    return "adzuna";
  }

  getSourceLabel(): string {
    return "Adzuna";
  }

  getCapabilities(): SourceCapabilities {
    return CAPABILITIES;
  }

  isConfigured(): boolean {
    return Boolean(ADZUNA_APP_ID && ADZUNA_APP_KEY);
  }

  requiredEnvVars(): readonly string[] {
    return ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"];
  }

  async searchJobs(
    query: LiveJobQuery,
    signal?: AbortSignal,
  ): Promise<SourceSearchOutput> {
    if (!this.isConfigured() || !ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
      throw new Error("adzuna_not_configured");
    }
    if (!query.country) {
      throw new Error("adzuna_requires_country");
    }
    const country = query.country.toLowerCase();
    if (!(ADZUNA_MARKETS as readonly string[]).includes(country.toUpperCase())) {
      throw new Error(`adzuna_market_unsupported:${country.toUpperCase()}`);
    }

    const url = new URL(`${BASE_URL}/${country}/search/${query.page}`);
    url.searchParams.set("app_id", ADZUNA_APP_ID);
    url.searchParams.set("app_key", ADZUNA_APP_KEY);
    url.searchParams.set("content-type", "application/json");
    url.searchParams.set(
      "results_per_page",
      String(Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE)),
    );

    // `what` accepts free text; keywords are joined so the API matches any of
    // them (Adzuna ORs terms in `what`).
    const what = query.keywords.slice(0, 6).join(" ");
    if (what) url.searchParams.set("what", what);
    const where = [query.location].filter(Boolean).join(", ");
    if (where) url.searchParams.set("where", where);

    if (query.minSalary !== null) url.searchParams.set("min_salary", String(query.minSalary));
    if (query.withinDays !== null && query.withinDays > 0) {
      url.searchParams.set("maximum_age", String(query.withinDays));
    }

    // Documented boolean filters. Contract-time and contract-type are separate
    // axes; internship has no documented flag, so an internship-only search is
    // deliberately widened (stated in the capabilities note) rather than
    // silently mismatched.
    const wantsPart = query.employmentTypes.includes("part-time");
    const wantsFull = query.employmentTypes.includes("full-time");
    if (wantsFull && !wantsPart) url.searchParams.set("full_time", "1");
    if (wantsPart && !wantsFull) url.searchParams.set("part_time", "1");
    const wantsContract = query.employmentTypes.includes("contract");
    const wantsPermanent = query.employmentTypes.includes("full-time");
    if (wantsContract && !wantsPermanent) url.searchParams.set("contract", "1");

    const response = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("adzuna_auth_failed");
      }
      if (response.status === 429) {
        throw new Error("adzuna_rate_limited");
      }
      throw new Error(`adzuna_http_${response.status}`);
    }

    const payload = (await response.json()) as AdzunaResponse;
    const fetchedAt = new Date().toISOString();
    const rawResults = Array.isArray(payload.results) ? (payload.results as AdzunaResult[]) : [];

    const jobs: LiveJobResult[] = [];
    for (const raw of rawResults) {
      const normalized = normalizeAdzunaResult(raw, country.toUpperCase(), fetchedAt);
      if (normalized) jobs.push(normalized);
    }

    const total = typeof payload.count === "number" ? payload.count : null;
    const perPage = Math.min(query.pageSize, MAX_PAGE_SIZE);
    const hasMore =
      total !== null ? query.page * perPage < total : jobs.length === perPage;

    return { jobs, total, hasMore };
  }
}
