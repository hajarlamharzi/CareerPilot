import { describe, expect, it } from "vitest";

import { computeAnalyticsSummary } from "./summary";
import { historyEntry, makeApplication, makeJob, makeMatchReport } from "@/test/fixtures";

const now = new Date("2026-10-14T09:00:00.000Z");

describe("computeAnalyticsSummary", () => {
  it("computes response and offer rates against the applications denominator", () => {
    const applications = [
      makeApplication({ id: "a1", status: "applied" }),
      makeApplication({ id: "a2", status: "screening" }),
      makeApplication({ id: "a3", status: "interview" }),
      makeApplication({ id: "a4", status: "offer" }),
      makeApplication({ id: "a5", status: "rejected" }),
    ];

    const summary = computeAnalyticsSummary({
      jobs: [],
      applications,
      matches: [],
      interviews: [],
      cv: null,
      now,
    });

    // offers 1 / 5 applications
    expect(summary.offerRate).toBe(20);
    // responses (screening, interview, offer) 3 / 5
    expect(summary.responseRate).toBe(60);
    expect(summary.activeApplications).toBe(3); // applied + screening + interview
    expect(summary.interviews).toBe(1);
    expect(summary.offers).toBe(1);
    expect(summary.rejected).toBe(1);
  });

  it("counts zero rates rather than dividing by zero when there are no applications", () => {
    const summary = computeAnalyticsSummary({
      jobs: [],
      applications: [],
      matches: [],
      interviews: [],
      cv: null,
      now,
    });
    expect(summary.offerRate).toBe(0);
    expect(summary.responseRate).toBe(0);
    expect(summary.averageMatchScore).toBeNull();
  });

  it("averages match scores using only the latest report per job", () => {
    const matches = [
      makeMatchReport({
        id: "m1",
        jobId: "job-1",
        score: 40,
        createdAt: "2026-09-01T00:00:00.000Z",
      }),
      makeMatchReport({
        id: "m2",
        jobId: "job-1",
        score: 80,
        createdAt: "2026-09-15T00:00:00.000Z",
      }),
      makeMatchReport({
        id: "m3",
        jobId: "job-2",
        score: 60,
        createdAt: "2026-09-10T00:00:00.000Z",
      }),
    ];

    const summary = computeAnalyticsSummary({
      jobs: [],
      applications: [],
      matches,
      interviews: [],
      cv: null,
      now,
    });

    // latest per job: job-1 = 80, job-2 = 60 → mean 70
    expect(summary.analyzedJobs).toBe(2);
    expect(summary.averageMatchScore).toBe(70);
  });

  it("buckets match scores by the documented ranges", () => {
    const matches = [
      makeMatchReport({ id: "m1", jobId: "job-1", score: 10 }),
      makeMatchReport({ id: "m2", jobId: "job-2", score: 30 }),
      makeMatchReport({ id: "m3", jobId: "job-3", score: 70 }),
      makeMatchReport({ id: "m4", jobId: "job-4", score: 90 }),
      makeMatchReport({ id: "m5", jobId: "job-5", score: 100 }),
    ];

    const summary = computeAnalyticsSummary({
      jobs: [],
      applications: [],
      matches,
      interviews: [],
      cv: null,
      now,
    });

    expect(summary.matchScoreDistribution).toEqual([
      { bucket: "0–24", count: 1 },
      { bucket: "25–49", count: 1 },
      { bucket: "50–74", count: 1 },
      { bucket: "75–100", count: 2 },
    ]);
  });

  it("always returns eight monthly buckets ending with the current month", () => {
    const summary = computeAnalyticsSummary({
      jobs: [],
      applications: [
        makeApplication({
          id: "a1",
          status: "applied",
          appliedAt: "2026-10-01T00:00:00.000Z",
        }),
      ],
      matches: [],
      interviews: [],
      cv: null,
      now,
    });

    expect(summary.applicationsOverTime).toHaveLength(8);
    expect(summary.applicationsOverTime[7].value).toBe(1);
    expect(summary.applicationsOverTime[7].date).toBe("2026-10");
  });

  it("ranks requested and missing skills by frequency", () => {
    const jobs = [
      makeJob({ id: "job-1", requiredSkills: ["React"], preferredSkills: [] }),
      makeJob({ id: "job-2", requiredSkills: ["React", "CSS"], preferredSkills: [] }),
    ];
    const matches = [
      makeMatchReport({
        id: "m1",
        jobId: "job-1",
        missingRequiredSkills: ["CSS"],
        missingPreferredSkills: [],
      }),
      makeMatchReport({
        id: "m2",
        jobId: "job-2",
        missingRequiredSkills: ["CSS"],
        missingPreferredSkills: [],
      }),
    ];

    const summary = computeAnalyticsSummary({
      jobs,
      applications: [],
      matches,
      interviews: [],
      cv: null,
      now,
    });

    expect(summary.topRequestedSkills[0]).toEqual({ skill: "react", count: 2 });
    expect(summary.topMissingSkills[0]).toEqual({ skill: "css", count: 2 });
  });

  it("keeps history-based status counts independent of the funnel", () => {
    const applications = [
      makeApplication({
        id: "a1",
        status: "rejected",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("rejected", "2026-09-09T00:00:00.000Z", "applied"),
        ],
      }),
    ];

    const summary = computeAnalyticsSummary({
      jobs: [],
      applications,
      matches: [],
      interviews: [],
      cv: null,
      now,
    });

    const rejected = summary.applicationsByStatus.find(
      (row) => row.status === "rejected",
    );
    expect(rejected?.count).toBe(1);
  });
});
