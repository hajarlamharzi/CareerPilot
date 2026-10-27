import { afterEach, describe, expect, it, vi } from "vitest";

import { JobicyAdapter, JOBICY_ATTRIBUTION_URL, normalizeJobicyJob } from "./jobicy";

/**
 * The Jobicy adapter is exercised with a stubbed `fetch`: the suite never
 * touches the network, so it stays free and deterministic. What matters here is
 * the contract — no fabricated fields, real URLs only, credit preserved.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RAW_JOB = {
  id: 155950,
  url: "https://jobicy.com/jobs/155950-full-stack-engineer-7",
  jobTitle: "Full Stack Engineer",
  companyName: "infisical",
  companyLogo: "https://jobicy.com/data/logo.png",
  jobIndustry: ["Engineering"],
  jobType: ["Full-Time"],
  jobGeo: "Europe",
  jobLevel: "Senior",
  jobDescription: "<p>Build the platform. We&nbsp;ship weekly.</p>",
  pubDate: "2026-10-15T10:00:00Z",
  salaryMin: 90_000,
  salaryMax: 120_000,
  salaryCurrency: "USD",
  salaryPeriod: "yearly",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("normalizeJobicyJob", () => {
  it("maps published fields and namespaces the id", () => {
    const result = normalizeJobicyJob(RAW_JOB, "2026-10-20T00:00:00.000Z");
    expect(result).not.toBeNull();
    const job = result!.job;
    expect(job.id).toBe("live:jobicy:155950");
    expect(job.title).toBe("Full Stack Engineer");
    expect(job.company).toBe("infisical");
    expect(job.workMode).toBe("remote");
    expect(job.employmentType).toBe("full-time");
    expect(job.seniority).toBe("senior");
    expect(job.description).toBe("Build the platform. We ship weekly.");
    expect(job.salary).toEqual({
      min: 90_000,
      max: 120_000,
      currency: "USD",
      period: "year",
    });
    expect(job.sourceName).toBe("Jobicy");
    expect(job.sourceUrl).toBe(RAW_JOB.url);
    expect(result!.sourceUrl).toBe(RAW_JOB.url);
  });

  it("never invents fields the source omitted", () => {
    const result = normalizeJobicyJob(
      { id: 1, url: "https://jobicy.com/jobs/1-x", jobTitle: "Designer" },
      "2026-10-20T00:00:00.000Z",
    );
    const job = result!.job;
    expect(job.seniority).toBeNull();
    expect(job.salary).toBeNull();
    expect(job.publishedAt).toBeNull();
    expect(job.companyLogo).toBeNull();
    // Company is the only exception: the feed hides it behind a neutral label
    // rather than leaving the card blank, and it is not passed off as a name.
    expect(job.company).toBe("Entreprise non précisée");
  });

  it("drops records without a usable title, id or link", () => {
    const fetchedAt = "2026-10-20T00:00:00.000Z";
    expect(normalizeJobicyJob({ ...RAW_JOB, url: "javascript:alert(1)" }, fetchedAt)).toBeNull();
    expect(normalizeJobicyJob({ ...RAW_JOB, jobTitle: "  " }, fetchedAt)).toBeNull();
    expect(normalizeJobicyJob({ ...RAW_JOB, id: undefined }, fetchedAt)).toBeNull();
  });
});

describe("JobicyAdapter.searchJobs", () => {
  it("declares an indicative geo filter and remote-only coverage", () => {
    const caps = new JobicyAdapter().getCapabilities();
    expect(caps.remoteOnly).toBe(true);
    expect(caps.geoFilter).toBe("indicative");
    expect(caps.countries).toContain("FR");
    // Morocco is absent on purpose: the source does not document it.
    expect(caps.countries).not.toContain("MA");
  });

  it("is configured without credentials", () => {
    const adapter = new JobicyAdapter();
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.requiredEnvVars()).toEqual([]);
  });

  it("sends tag and geo, and normalises what came back", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return jsonResponse({ jobs: [RAW_JOB], hasMore: false });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = await new JobicyAdapter().searchJobs({
      keywords: ["full", "stack"],
      country: "FR",
      location: null,
      remote: true,
      employmentTypes: [],
      seniority: null,
      minSalary: null,
      withinDays: null,
      page: 1,
      pageSize: 10,
    });

    const called = new URL(String(fetchMock.mock.calls[0][0]));
    expect(called.origin + called.pathname).toBe("https://jobicy.com/api/v2/remote-jobs");
    expect(called.searchParams.get("tag")).toBe("full stack");
    expect(called.searchParams.get("geo")).toBe("france");
    expect(output.jobs).toHaveLength(1);
    // Jobicy does not publish a global total: null, not a guess.
    expect(output.total).toBeNull();
  });

  it("omits the geo filter for a market the source does not document", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return jsonResponse({ jobs: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await new JobicyAdapter().searchJobs({
      keywords: [],
      country: "MA",
      location: null,
      remote: true,
      employmentTypes: [],
      seniority: null,
      minSalary: null,
      withinDays: null,
      page: 1,
      pageSize: 5,
    });

    const called = new URL(String(fetchMock.mock.calls[0][0]));
    expect(called.searchParams.has("geo")).toBe(false);
  });

  it("surfaces HTTP failures as typed errors so the service can report them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 429)));
    await expect(
      new JobicyAdapter().searchJobs({
        keywords: [],
        country: null,
        location: null,
        remote: false,
        employmentTypes: [],
        seniority: null,
        minSalary: null,
        withinDays: null,
        page: 1,
        pageSize: 5,
      }),
    ).rejects.toThrow("jobicy_rate_limited");
  });

  it("ignores a malformed payload instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ jobs: "nope" })));
    const output = await new JobicyAdapter().searchJobs({
      keywords: [],
      country: null,
      location: null,
      remote: false,
      employmentTypes: [],
      seniority: null,
      minSalary: null,
      withinDays: null,
      page: 1,
      pageSize: 5,
    });
    expect(output.jobs).toEqual([]);
  });

  it("exposes the canonical attribution link required by the source", () => {
    expect(JOBICY_ATTRIBUTION_URL).toBe("https://jobicy.com/remote-jobs");
  });
});
