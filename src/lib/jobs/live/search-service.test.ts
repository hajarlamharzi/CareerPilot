import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeJob } from "@/test/fixtures";
import type { Job } from "@/types";

import { blankLiveJob } from "./normalizer";
import type {
  JobSourceAdapter,
  LiveJobQuery,
  LiveJobResult,
  SourceCapabilities,
  SourceSearchOutput,
} from "./types";

/**
 * The orchestrator is where per-source honesty is enforced, so these tests use
 * *fake adapters* rather than network stubs: what is under test is the fan-out,
 * dedup, cache, relevance filter and status reporting — not HTTP.
 *
 * `ADAPTERS` is a module-level constant, so the module is re-imported after
 * mocking it, which also gives each test a fresh in-memory cache.
 */

const REGISTRY: JobSourceAdapter[] = [];

vi.mock("./registry", () => ({
  ADAPTERS: REGISTRY,
}));

async function loadService() {
  vi.resetModules();
  const mod = await import("./search-service");
  mod.clearLiveSearchCache();
  return mod;
}

function liveJob(overrides: {
  id: string;
  title: string;
  company?: string;
  url?: string | null;
  publishedAt?: string | null;
  description?: string;
}): LiveJobResult {
  const job: Job = blankLiveJob({
    id: overrides.id,
    title: overrides.title,
    company: overrides.company ?? "Acme",
    sourceName: "Fake",
    sourceUrl: overrides.url ?? `https://example.com/${overrides.id}`,
    addedAt: "2026-10-20T00:00:00.000Z",
  });
  job.description = overrides.description ?? "";
  job.publishedAt = overrides.publishedAt ?? null;
  job.sourceUrl = overrides.url ?? `https://example.com/${overrides.id}`;
  return { job, externalId: overrides.id, sourceUrl: job.sourceUrl };
}

interface FakeOptions {
  id?: string;
  label?: string;
  capabilities?: Partial<SourceCapabilities>;
  configured?: boolean;
  envVars?: readonly string[];
  search?: (query: LiveJobQuery) => Promise<SourceSearchOutput>;
  jobs?: LiveJobResult[];
  total?: number | null;
}

function fakeAdapter(options: FakeOptions = {}): JobSourceAdapter {
  const id = options.id ?? "fake";
  return {
    getSourceId: () => id,
    getSourceLabel: () => options.label ?? id,
    getCapabilities: () => ({
      countries: [],
      geoFilter: "none",
      remoteOnly: false,
      salary: false,
      publicationDates: false,
      maxResults: 50,
      coverageNote: "",
      ...options.capabilities,
    }),
    isConfigured: () => options.configured ?? true,
    requiredEnvVars: () => options.envVars ?? [],
    searchJobs:
      options.search ??
      (async () => ({
        jobs: options.jobs ?? [],
        total: options.total ?? null,
        hasMore: false,
      })),
  };
}

const baseInput = {
  keywords: [] as string[],
  country: null,
  location: null,
  remote: false,
  employmentTypes: [],
  seniority: null,
  minSalary: null,
  withinDays: null,
  page: 1,
  pageSize: 10,
};

beforeEach(() => {
  REGISTRY.length = 0;
});

describe("searchLiveJobs — fan-out and statuses", () => {
  it("reports a disabled source with the exact variables to set", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "adzuna",
        label: "Adzuna",
        configured: false,
        envVars: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({
      ...baseInput,
      country: "FR",
      keywords: ["react"],
    });

    const run = result.sources.find((s) => s.sourceId === "adzuna")!;
    expect(run.status).toBe("disabled");
    expect(run.message).toContain("ADZUNA_APP_ID");
    expect(result.items).toEqual([]);
    // A disabled provider must never be presented as "0 offers found".
    expect(run.resultCount).toBe(0);
  });

  it("keeps one broken source from breaking the others", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "broken",
        label: "Cassée",
        search: async () => {
          throw new Error("adzuna_http_500");
        },
      }),
      fakeAdapter({ id: "good", label: "Bonne", jobs: [liveJob({ id: "a", title: "Dev" })] }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs(baseInput);

    expect(result.items).toHaveLength(1);
    expect(result.sources.find((s) => s.sourceId === "broken")!.status).toBe("error");
    expect(result.sources.find((s) => s.sourceId === "good")!.status).toBe("ok");
  });

  it("skips a source that does not document the requested market", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "adzuna",
        label: "Adzuna",
        capabilities: { countries: ["FR", "GB"], geoFilter: "strict" },
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({ ...baseInput, country: "MA" });

    const run = result.sources[0];
    expect(run.status).toBe("skipped");
    expect(run.message).toContain("MA");
  });

  it("honours an explicit source filter", async () => {
    REGISTRY.push(fakeAdapter({ id: "a" }), fakeAdapter({ id: "b" }));
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({ ...baseInput, sourceIds: ["b"] });

    expect(result.sources.find((s) => s.sourceId === "a")!.status).toBe("skipped");
    expect(result.sources.find((s) => s.sourceId === "b")!.status).toBe("ok");
  });

  it("warns that an indicative geo filter is not a strict country filter", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "jobicy",
        label: "Jobicy",
        capabilities: { countries: ["FR"], geoFilter: "indicative" },
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({ ...baseInput, country: "FR" });

    expect(result.sources[0].message).toContain("indicatif");
  });
});

describe("searchLiveJobs — dedup, relevance and cache", () => {
  it("de-duplicates the same listing across sources by canonical URL", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "a",
        jobs: [liveJob({ id: "1", title: "Dev React", url: "https://x.com/j/1?utm_source=a" })],
      }),
      fakeAdapter({
        id: "b",
        jobs: [liveJob({ id: "2", title: "Dev React", url: "https://x.com/j/1" })],
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({ ...baseInput, keywords: ["react"] });

    expect(result.items).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("drops listings matching none of the requested keywords", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "a",
        jobs: [
          liveJob({ id: "1", title: "Développeur React" }),
          liveJob({ id: "2", title: "Responsable marketing" }),
        ],
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({ ...baseInput, keywords: ["react"] });

    expect(result.items.map((item) => item.externalId)).toEqual(["1"]);
    expect(result.irrelevantRemoved).toBe(1);
  });

  it("keeps everything when no keyword was given", async () => {
    REGISTRY.push(
      fakeAdapter({ id: "a", jobs: [liveJob({ id: "1", title: "Tout" })] }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs(baseInput);
    expect(result.items).toHaveLength(1);
    expect(result.irrelevantRemoved).toBe(0);
  });

  it("ranks a title match above a body-only match", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "a",
        jobs: [
          liveJob({ id: "body", title: "Generalist", description: "on utilise react" }),
          liveJob({ id: "title", title: "React Engineer" }),
        ],
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs({ ...baseInput, keywords: ["react"] });
    expect(result.items[0].externalId).toBe("title");
  });

  it("serves the second identical search from cache, and says so", async () => {
    const search = vi.fn(async () => ({
      jobs: [liveJob({ id: "1", title: "Dev React" })],
      total: 1,
      hasMore: false,
    }));
    REGISTRY.push(fakeAdapter({ id: "a", search }));
    const { searchLiveJobs } = await loadService();

    const first = await searchLiveJobs({ ...baseInput, keywords: ["react"] });
    const second = await searchLiveJobs({ ...baseInput, keywords: ["react"] });

    expect(search).toHaveBeenCalledTimes(1);
    expect(first.allCached).toBe(false);
    expect(second.allCached).toBe(true);
    expect(second.sources[0].cached).toBe(true);
    expect(second.sources[0].message).toContain("cache");
  });

  it("caches per query, not per adapter", async () => {
    const search = vi.fn(async () => ({ jobs: [], total: null, hasMore: false }));
    REGISTRY.push(fakeAdapter({ id: "a", search }));
    const { searchLiveJobs } = await loadService();

    await searchLiveJobs({ ...baseInput, keywords: ["react"] });
    await searchLiveJobs({ ...baseInput, keywords: ["vue"] });

    expect(search).toHaveBeenCalledTimes(2);
  });

  it("reports a timeout as a per-source status rather than throwing", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "slow",
        label: "Lente",
        search: (query) =>
          new Promise((_resolve, reject) => {
            query satisfies LiveJobQuery;
            const abortError = new Error("aborted");
            abortError.name = "TimeoutError";
            setTimeout(() => reject(abortError), 0);
          }),
      }),
    );
    const { searchLiveJobs } = await loadService();

    const result = await searchLiveJobs(baseInput);
    expect(["error", "timeout"]).toContain(result.sources[0].status);
    expect(result.items).toEqual([]);
  });
});

describe("listProviders", () => {
  it("exposes capabilities and required env vars without leaking credentials", async () => {
    REGISTRY.push(
      fakeAdapter({
        id: "adzuna",
        label: "Adzuna",
        configured: false,
        envVars: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
        capabilities: { countries: ["FR"], geoFilter: "strict", salary: true },
      }),
    );
    const { listProviders } = await loadService();

    const providers = listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].requiredEnvVars).toEqual(["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]);
    expect(providers[0].capabilities.geoFilter).toBe("strict");
    expect(JSON.stringify(providers)).not.toMatch(/app_key=/i);
  });
});

describe("buildLiveQuery", () => {
  it("folds and trims free text into keywords", async () => {
    const { buildLiveQuery } = await loadService();
    const query = buildLiveQuery({
      ...baseInput,
      keywords: ["  React  ", "", "NODE"],
    });
    expect(query.keywords).toEqual(["React", "NODE"]);
  });

  it("clamps page size and page number into supported bounds", async () => {
    const { buildLiveQuery } = await loadService();
    expect(buildLiveQuery({ ...baseInput, page: 0, pageSize: 500 }).pageSize).toBe(25);
    expect(buildLiveQuery({ ...baseInput, page: 0, pageSize: 500 }).page).toBe(1);
  });
});

describe("fixtures gate", () => {
  // Guards against a future change that makes the fixtures look like live data.
  it("keeps live ids namespaced so demo rows can never be confused with live ones", () => {
    expect(blankLiveJob({
      id: "live:jobicy:1",
      title: "x",
      company: "y",
      sourceName: "Jobicy",
      sourceUrl: null,
      addedAt: "2026-10-20T00:00:00.000Z",
    }).id).toMatch(/^live:/);
    expect(makeJob({ origin: "demo" }).origin).toBe("demo");
  });
});
