import { describe, expect, it } from "vitest";

import { makeJob } from "@/test/fixtures";
import type { Job, SalaryRange } from "@/types";

import {
  buildFacets,
  buildResult,
  localProvenance,
  matchesFilters,
  searchLocalCatalogue,
} from "./pipeline";
import { DEFAULT_JOB_SEARCH_FILTERS, type JobSearchFilters } from "./types";

/**
 * Filtering, sorting and pagination are pure, so the "does this job match?"
 * definition can be pinned here instead of behind a database. Both the browser
 * catalogue and the PostgreSQL catalogue run through these functions.
 */

const filters = (overrides: Partial<JobSearchFilters> = {}): JobSearchFilters => ({
  ...DEFAULT_JOB_SEARCH_FILTERS,
  ...overrides,
});

const salary = (min: number, max: number | null): SalaryRange => ({
  min,
  max,
  currency: "EUR",
  period: "year",
});

describe("localProvenance", () => {
  it("labels seeded demo rows as samples so they can never look real", () => {
    const provenance = localProvenance(makeJob({ origin: "demo" }));
    expect(provenance).toMatchObject({
      kind: "sample",
      label: "Donnée d'exemple",
      isSample: true,
      isVerified: false,
    });
  });

  it("labels a user entry carrying a link as user-submitted, not verified", () => {
    const provenance = localProvenance(
      makeJob({ origin: "user", sourceUrl: "https://example.test/job", sourceName: "Interne" }),
    );
    expect(provenance).toMatchObject({
      kind: "user-submitted",
      label: "Proposée par un utilisateur",
      isSample: false,
      isVerified: false,
    });
  });

  it("labels a first-party entry as the CareerPilot catalogue", () => {
    expect(localProvenance(makeJob({ origin: "user" }))).toMatchObject({
      kind: "platform",
      label: "Catalogue CareerPilot",
    });
  });
});

describe("matchesFilters", () => {
  it("hides sample rows only when they are explicitly excluded", () => {
    const sample = makeJob({ id: "sample", origin: "demo" });
    const provenance = localProvenance(sample);
    expect(matchesFilters(sample, provenance, filters())).toBe(true);
    expect(matchesFilters(sample, provenance, filters({ includeSamples: false }))).toBe(false);
  });

  it("hides expired listings unless they are explicitly requested", () => {
    const expired = makeJob({ deadline: "2020-01-01T00:00:00.000Z" });
    const provenance = localProvenance(expired);
    expect(matchesFilters(expired, provenance, filters())).toBe(false);
    expect(matchesFilters(expired, provenance, filters({ includeExpired: true }))).toBe(true);
  });

  it("excludes a listing with no advertised salary when a minimum is set", () => {
    const job = makeJob({ salary: null });
    expect(matchesFilters(job, localProvenance(job), filters({ minSalary: 40_000 }))).toBe(false);
  });

  it("keeps a listing whose advertised ceiling reaches the minimum", () => {
    const job = makeJob({ salary: salary(45_000, 60_000) });
    const provenance = localProvenance(job);
    expect(matchesFilters(job, provenance, filters({ minSalary: 55_000 }))).toBe(true);
    expect(matchesFilters(job, provenance, filters({ minSalary: 70_000 }))).toBe(false);
  });

  it("requires every word of the query to appear somewhere", () => {
    const job = makeJob({ title: "Développeur front-end", requiredSkills: ["React", "TypeScript"] });
    const provenance = localProvenance(job);
    expect(matchesFilters(job, provenance, filters({ query: "front react" }))).toBe(true);
    expect(matchesFilters(job, provenance, filters({ query: "front python" }))).toBe(false);
  });

  it("ignores accents and case", () => {
    const job = makeJob({ title: "Développeur Front-End" });
    const provenance = localProvenance(job);
    expect(matchesFilters(job, provenance, filters({ query: "developpeur" }))).toBe(true);
    expect(matchesFilters(job, provenance, filters({ titles: ["DEVELOPPEUR"] }))).toBe(true);
  });

  it("OR-s the values of one filter and AND-s across filters", () => {
    const job = makeJob({ location: "Lyon", company: "Acme", workMode: "hybrid" });
    const provenance = localProvenance(job);
    expect(matchesFilters(job, provenance, filters({ locations: ["Paris", "Lyon"] }))).toBe(true);
    expect(matchesFilters(job, provenance, filters({ locations: ["Paris"] }))).toBe(false);
    expect(
      matchesFilters(job, provenance, filters({ locations: ["Lyon"], workModes: ["remote"] })),
    ).toBe(false);
  });

  it("rejects a listing whose seniority is unknown when a seniority filter is set", () => {
    const job = makeJob({ seniority: null });
    const provenance = localProvenance(job);
    expect(matchesFilters(job, provenance, filters({ seniorities: ["mid"] }))).toBe(false);
    expect(matchesFilters(job, provenance, filters())).toBe(true);
  });

  it("only keeps listings published on or after the requested date", () => {
    const recent = makeJob({ publishedAt: "2026-03-01T00:00:00.000Z" });
    const old = makeJob({ publishedAt: "2026-01-01T00:00:00.000Z" });
    const undated = makeJob({ publishedAt: null });
    const cutoff = filters({ publishedAfter: "2026-02-01T00:00:00.000Z" });
    expect(matchesFilters(recent, localProvenance(recent), cutoff)).toBe(true);
    expect(matchesFilters(old, localProvenance(old), cutoff)).toBe(false);
    expect(matchesFilters(undated, localProvenance(undated), cutoff)).toBe(false);
  });
});

describe("buildResult", () => {
  const jobs: Job[] = [
    makeJob({
      id: "a",
      title: "Alpha",
      salary: salary(50_000, 50_000),
      publishedAt: "2026-01-03T00:00:00.000Z",
    }),
    makeJob({
      id: "b",
      title: "Bravo",
      salary: salary(30_000, 90_000),
      publishedAt: "2026-01-02T00:00:00.000Z",
    }),
    makeJob({ id: "c", title: "Charlie", salary: null, publishedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const candidates = jobs.map((job) => ({ job, provenance: localProvenance(job) }));

  it("paginates and clamps an out-of-range page", () => {
    const result = buildResult(candidates, filters({ pageSize: 2, page: 99 }), null);
    expect(result.total).toBe(3);
    expect(result.pageCount).toBe(2);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it("reports a single empty page when nothing matches", () => {
    const result = buildResult(candidates, filters({ query: "astrophysique" }), null);
    expect(result.total).toBe(0);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.items).toEqual([]);
  });

  it("sorts by the advertised salary ceiling, unsalaried last", () => {
    const result = buildResult(candidates, filters({ sort: "salary" }), null);
    expect(result.items.map((hit) => hit.job.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by recency when asked", () => {
    const result = buildResult(candidates, filters({ sort: "recent" }), null);
    expect(result.items.map((hit) => hit.job.id)).toEqual(["a", "b", "c"]);
  });

  it("reports no ranking without a candidate context", () => {
    const result = buildResult(candidates, filters(), null);
    expect(result.items.every((hit) => hit.rank === null)).toBe(true);
  });

  it("carries the applied filters so the UI can rebuild the query", () => {
    const applied = filters({ query: "alpha" });
    const result = buildResult(candidates, applied, null);
    expect(result.appliedFilters).toBe(applied);
    expect(result.source).toBe("catalogue");
  });
});

describe("buildFacets", () => {
  it("counts facets and orders by frequency", () => {
    const jobs = [
      makeJob({ id: "1", company: "Acme", location: "Lyon", sourceName: "Interne" }),
      makeJob({ id: "2", company: "Acme", location: "Lyon" }),
      makeJob({ id: "3", company: "Globex", location: "Paris" }),
    ];
    const facets = buildFacets(jobs);
    expect(facets.companies[0]).toEqual({ value: "Acme", count: 2 });
    expect(facets.locations.map((facet) => facet.value)).toEqual(["Lyon", "Paris"]);
    expect(facets.sources[0]).toEqual({ value: "Interne", count: 1 });
  });

  it("skips blank values", () => {
    const facets = buildFacets([makeJob({ location: "" })]);
    expect(facets.locations).toEqual([]);
  });
});

describe("searchLocalCatalogue", () => {
  it("runs the catalogue through the same pipeline as everything else", () => {
    const result = searchLocalCatalogue(
      [makeJob({ id: "a", title: "Frontend Developer" }), makeJob({ id: "b", title: "Data Engineer" })],
      filters({ query: "frontend" }),
      null,
    );
    expect(result.total).toBe(1);
    expect(result.source).toBe("catalogue");
    expect(result.items[0]?.job.id).toBe("a");
  });
});
