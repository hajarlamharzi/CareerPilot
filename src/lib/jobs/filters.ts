import { z } from "zod";

import { EMPLOYMENT_TYPES, SENIORITIES, WORK_MODES } from "@/config/constants";
import { JOBS_PAGE_SIZE } from "@/config/app";
import {
  DEFAULT_JOB_SEARCH_FILTERS,
  type JobSearchFilters,
  type JobSortMode,
} from "./types";

/**
 * Search-filter validation.
 *
 * The same schema validates a URL query string (the jobs page), a JSON request
 * body (the API), and the filters the AI assistant extracts from a sentence
 * such as:
 *
 *   « Je cherche un stage PFE en intelligence artificielle ou data engineering
 *     à Rabat ou Casablanca. »
 *
 * Because it is one schema, a filter the model produces is validated exactly
 * like one typed into the form — the model gets no privileged path.
 */

const MAX_PAGE_SIZE = 50;

/** Split a repeated-or-comma-separated parameter into a trimmed string list. */
export const stringListSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value, ctx) => {
    const parts = (Array.isArray(value) ? value : [value])
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const unique = [...new Set(parts)];
    if (unique.length > 20) {
      ctx.addIssue({
        code: "custom",
        message: "Trop de valeurs dans ce filtre (20 maximum).",
      });
      return z.NEVER;
    }
    return unique;
  });

/**
 * Filter a comma/space list down to the values actually allowed by an enum tuple.
 *
 * Returns a *typed* array (a `string[]` would not satisfy `JobSearchFilters`),
 * so the output type of the whole schema matches the domain type exactly.
 */
const enumList = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((raw): T[number][] => {
      const list = (Array.isArray(raw) ? raw : [raw])
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      const allowed = new Set<string>(values);
      return [...new Set(list.filter((entry) => allowed.has(entry)))] as T[number][];
    });

const intOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed =
      typeof value === "number" ? value : Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  });

const isoDateOrNull = z
  .string()
  .trim()
  .nullish()
  .transform((value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  });

const booleanish = z
  .union([z.boolean(), z.string()])
  .nullish()
  .transform((value) => value === true || value === "true" || value === "1");

export const jobSortModes = [
  "relevance",
  "recent",
  "salary",
  "company",
] as const satisfies readonly JobSortMode[];

export const jobSearchFiltersSchema = z.object({
  query: z.string().trim().max(300).optional().default(""),
  titles: stringListSchema.optional().default([]),
  locations: stringListSchema.optional().default([]),
  companies: stringListSchema.optional().default([]),
  employmentTypes: enumList(EMPLOYMENT_TYPES)
    .optional()
    .default([]),
  workModes: enumList(WORK_MODES).optional().default([]),
  seniorities: enumList(SENIORITIES).optional().default([]),
  minSalary: intOrNull.optional().default(null),
  currency: z.string().trim().max(8).nullish().transform((v) => v || null),
  publishedAfter: isoDateOrNull.optional().default(null),
  includeExpired: booleanish.optional().default(false),
  includeSamples: z
    .union([z.boolean(), z.string()])
    .nullish()
    .transform((value) => (value === undefined || value === null ? true : value === true || value === "true" || value === "1")),
  sort: z.enum(jobSortModes).optional().default("relevance"),
  page: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value) => {
      const parsed =
        typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
      return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
    }),
  pageSize: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value) => {
      const parsed =
        typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
      if (!Number.isFinite(parsed) || parsed < 1) return JOBS_PAGE_SIZE;
      return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
    }),
});

export type JobSearchFiltersInput = z.input<typeof jobSearchFiltersSchema>;
export type JobSearchFiltersOutput = z.output<typeof jobSearchFiltersSchema>;

// Compile-time proof that the schema and the domain type stay in step. If a
// field or an enum changes on one side only, this line stops the build instead
// of letting a cast hide the mismatch at runtime.
const _filtersSchemaMatchesDomain: JobSearchFilters = {} as JobSearchFiltersOutput;
void _filtersSchemaMatchesDomain;

/** Parse (and clamp) a URL query string into validated filters. */
export function parseJobSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): JobSearchFilters {
  const get = (
    key: string,
  ): string | string[] | undefined => {
    if (params instanceof URLSearchParams) {
      const all = params.getAll(key);
      return all.length > 1 ? all : all[0];
    }
    return params[key];
  };

  const raw = {
    query: get("q") ?? get("query"),
    titles: get("title") ?? get("titles"),
    locations: get("location") ?? get("locations"),
    companies: get("company") ?? get("companies"),
    employmentTypes: get("type") ?? get("employmentTypes"),
    workModes: get("mode") ?? get("workModes"),
    seniorities: get("seniority") ?? get("seniorities"),
    minSalary: get("minSalary"),
    currency: get("currency"),
    publishedAfter: get("since") ?? get("publishedAfter"),
    includeExpired: get("includeExpired"),
    includeSamples: get("includeSamples"),
    sort: get("sort"),
    page: get("page"),
    pageSize: get("pageSize"),
  };

  const parsed = jobSearchFiltersSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_JOB_SEARCH_FILTERS };
}

/** Serialise filters back into a shareable query string (omits defaults). */
export function buildJobSearchParams(filters: JobSearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value) params.set(key, value);
  };
  const setList = (key: string, value: readonly string[]) => {
    if (value.length > 0) params.set(key, value.join(","));
  };

  set("q", filters.query);
  setList("location", filters.locations);
  setList("company", filters.companies);
  setList("type", filters.employmentTypes);
  setList("mode", filters.workModes);
  setList("seniority", filters.seniorities);
  setList("title", filters.titles);
  if (filters.minSalary !== null) set("minSalary", String(filters.minSalary));
  set("currency", filters.currency ?? "");
  set("since", filters.publishedAfter ?? "");
  if (filters.includeExpired) params.set("includeExpired", "true");
  if (!filters.includeSamples) params.set("includeSamples", "false");
  if (filters.sort !== "relevance") set("sort", filters.sort);
  if (filters.page > 1) set("page", String(filters.page));

  return params;
}

/** `true` when at least one user-visible filter is active. */
export function hasActiveFilters(filters: JobSearchFilters): boolean {
  return (
    filters.query.length > 0 ||
    filters.titles.length > 0 ||
    filters.locations.length > 0 ||
    filters.companies.length > 0 ||
    filters.employmentTypes.length > 0 ||
    filters.workModes.length > 0 ||
    filters.seniorities.length > 0 ||
    filters.minSalary !== null ||
    filters.publishedAfter !== null ||
    !filters.includeSamples
  );
}

/** Human summary used in the assistant's "here is what I searched for" block. */
export function describeFilters(filters: JobSearchFilters): string {
  const parts: string[] = [];
  if (filters.query) parts.push(`mots-clés « ${filters.query} »`);
  if (filters.titles.length) parts.push(`postes : ${filters.titles.join(", ")}`);
  if (filters.locations.length) parts.push(`lieux : ${filters.locations.join(", ")}`);
  if (filters.companies.length) parts.push(`entreprises : ${filters.companies.join(", ")}`);
  if (filters.workModes.length) parts.push(`mode : ${filters.workModes.join(", ")}`);
  if (filters.employmentTypes.length)
    parts.push(`contrat : ${filters.employmentTypes.join(", ")}`);
  if (filters.seniorities.length)
    parts.push(`niveau : ${filters.seniorities.join(", ")}`);
  if (filters.minSalary !== null)
    parts.push(
      `salaire ≥ ${filters.minSalary}${filters.currency ? ` ${filters.currency}` : ""}`,
    );
  if (filters.publishedAfter)
    parts.push(`publié après le ${filters.publishedAfter.slice(0, 10)}`);
  return parts.length ? parts.join(" · ") : "aucun filtre";
}
