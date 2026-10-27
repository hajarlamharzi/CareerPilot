import { describe, expect, it } from "vitest";

import {
  computeApplicationVelocity,
  computeFunnel,
  computeInterviewPrepStats,
} from "./insights";
import {
  historyEntry,
  makeApplication,
  makeQuestion,
} from "@/test/fixtures";

describe("computeFunnel", () => {
  it("counts an application at every stage up to its furthest recorded stage", () => {
    const applications = [
      makeApplication({
        id: "a1",
        status: "offer",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("screening", "2026-09-04T00:00:00.000Z", "applied"),
          historyEntry("interview", "2026-09-08T00:00:00.000Z", "screening"),
          historyEntry("offer", "2026-09-12T00:00:00.000Z", "interview"),
        ],
      }),
      makeApplication({
        id: "a2",
        status: "interview",
        history: [
          historyEntry("applied", "2026-09-02T00:00:00.000Z"),
          historyEntry("interview", "2026-09-09T00:00:00.000Z", "applied"),
        ],
      }),
      makeApplication({
        id: "a3",
        status: "applied",
        history: [historyEntry("applied", "2026-09-03T00:00:00.000Z")],
      }),
    ];

    const funnel = computeFunnel(applications);
    const byStage = Object.fromEntries(
      funnel.steps.map((step) => [step.stage, step.reached]),
    );

    // Monotonic by construction: an application that reached a later stage also
    // counts for every earlier stage.
    expect(byStage).toEqual({
      applied: 3,
      screening: 2,
      interview: 2,
      assessment: 1,
      offer: 1,
    });
    expect(funnel.notApplied).toBe(0);
    expect(funnel.appliedToOfferRate).toBeCloseTo(33.3, 1);
  });

  it("keeps an application rejected after interview at its furthest stage", () => {
    const funnel = computeFunnel([
      makeApplication({
        id: "a1",
        status: "rejected",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("interview", "2026-09-08T00:00:00.000Z", "applied"),
          historyEntry("rejected", "2026-09-10T00:00:00.000Z", "interview"),
        ],
      }),
    ]);

    const byStage = Object.fromEntries(
      funnel.steps.map((step) => [step.stage, step.reached]),
    );
    expect(byStage.interview).toBe(1);
    expect(funnel.closed).toBe(1);
  });

  it("excludes applications that were never submitted and reports them separately", () => {
    const funnel = computeFunnel([
      makeApplication({ id: "a1", status: "interested" }),
      makeApplication({ id: "a2", status: "saved" }),
      makeApplication({
        id: "a3",
        status: "applied",
        history: [historyEntry("applied", "2026-09-03T00:00:00.000Z")],
      }),
    ]);

    expect(funnel.notApplied).toBe(2);
    expect(funnel.steps[0].reached).toBe(1);
  });

  it("reports drop-off between consecutive stages", () => {
    const applications = [
      makeApplication({
        id: "a1",
        status: "applied",
        history: [historyEntry("applied", "2026-09-01T00:00:00.000Z")],
      }),
      makeApplication({
        id: "a2",
        status: "applied",
        history: [historyEntry("applied", "2026-09-02T00:00:00.000Z")],
      }),
    ];

    const funnel = computeFunnel(applications);
    const applied = funnel.steps[0];
    const screening = funnel.steps[1];

    expect(applied.dropOff).toBe(0);
    expect(screening.lost).toBe(2);
    expect(screening.dropOff).toBe(100);
  });

  it("returns zeroed steps when nothing has been applied to", () => {
    const funnel = computeFunnel([]);
    expect(funnel.steps.every((step) => step.reached === 0)).toBe(true);
    expect(funnel.appliedToOfferRate).toBe(0);
  });
});

describe("computeApplicationVelocity", () => {
  it("measures days from appliedAt to the first recorded response", () => {
    const application = makeApplication({
      id: "a1",
      status: "interview",
      appliedAt: "2026-09-01T00:00:00.000Z",
      history: [
        historyEntry("applied", "2026-09-01T00:00:00.000Z"),
        historyEntry("screening", "2026-09-03T00:00:00.000Z", "applied"),
        historyEntry("interview", "2026-09-10T00:00:00.000Z", "screening"),
      ],
    });

    const velocity = computeApplicationVelocity([application]);
    expect(velocity.sampleSize).toBe(1);
    expect(velocity.meanDaysToResponse).toBe(2);
    expect(velocity.medianDaysToResponse).toBe(2);
    expect(velocity.fastestResponseDays).toBe(2);
    expect(velocity.slowestResponseDays).toBe(2);
    expect(velocity.awaitingResponse).toBe(0);
  });

  it("averages and medians several response times", () => {
    const applications = [
      makeApplication({
        id: "a1",
        status: "screening",
        appliedAt: "2026-09-01T00:00:00.000Z",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("screening", "2026-09-03T00:00:00.000Z", "applied"),
        ],
      }),
      makeApplication({
        id: "a2",
        status: "screening",
        appliedAt: "2026-09-01T00:00:00.000Z",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("screening", "2026-09-03T00:00:00.000Z", "applied"),
        ],
      }),
      makeApplication({
        id: "a3",
        status: "screening",
        appliedAt: "2026-09-01T00:00:00.000Z",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("screening", "2026-09-07T00:00:00.000Z", "applied"),
        ],
      }),
    ];

    const velocity = computeApplicationVelocity(applications);
    expect(velocity.sampleSize).toBe(3);
    expect(velocity.meanDaysToResponse).toBeCloseTo(3.3, 1);
    expect(velocity.medianDaysToResponse).toBe(2);
    expect(velocity.slowestResponseDays).toBe(6);
  });

  it("counts submitted applications that never received a response", () => {
    const applications = [
      makeApplication({
        id: "a1",
        status: "applied",
        appliedAt: "2026-09-01T00:00:00.000Z",
        history: [historyEntry("applied", "2026-09-01T00:00:00.000Z")],
      }),
      makeApplication({
        id: "a2",
        status: "interested",
        appliedAt: null,
      }),
    ];

    const velocity = computeApplicationVelocity(applications);
    expect(velocity.sampleSize).toBe(0);
    expect(velocity.awaitingResponse).toBe(1);
    expect(velocity.meanDaysToResponse).toBeNull();
  });

  it("does not count a closed application as awaiting a response", () => {
    // A rejection with no response transition is a finished application, not one
    // still waiting on an employer.
    const applications = [
      makeApplication({
        id: "rejected",
        status: "rejected",
        appliedAt: "2026-09-01T00:00:00.000Z",
        history: [
          historyEntry("applied", "2026-09-01T00:00:00.000Z"),
          historyEntry("rejected", "2026-09-03T00:00:00.000Z", "applied"),
        ],
      }),
      makeApplication({
        id: "waiting",
        status: "applied",
        appliedAt: "2026-09-02T00:00:00.000Z",
        history: [historyEntry("applied", "2026-09-02T00:00:00.000Z")],
      }),
    ];

    const velocity = computeApplicationVelocity(applications);
    expect(velocity.awaitingResponse).toBe(1);
  });

  it("measures time to offer where an offer was recorded", () => {
    const application = makeApplication({
      id: "a1",
      status: "offer",
      appliedAt: "2026-09-01T00:00:00.000Z",
      history: [
        historyEntry("applied", "2026-09-01T00:00:00.000Z"),
        historyEntry("screening", "2026-09-04T00:00:00.000Z", "applied"),
        historyEntry("offer", "2026-09-21T00:00:00.000Z", "screening"),
      ],
    });

    const velocity = computeApplicationVelocity([application]);
    expect(velocity.meanDaysToOffer).toBe(20);
  });
});

describe("computeInterviewPrepStats", () => {
  it("separates answered from practised and breaks down by category", () => {
    const questions = [
      makeQuestion({ id: "q1", category: "technical", practiced: true, userAnswer: "Answer" }),
      makeQuestion({ id: "q2", category: "technical", practiced: false, userAnswer: "  " }),
      makeQuestion({ id: "q3", category: "behavioral", practiced: true, userAnswer: "" }),
    ];

    const stats = computeInterviewPrepStats(questions);
    expect(stats.total).toBe(3);
    expect(stats.practiced).toBe(2);
    expect(stats.answered).toBe(1);
    expect(stats.practicedRate).toBeCloseTo(66.7, 1);

    const technical = stats.byCategory.find((row) => row.category === "technical");
    expect(technical).toMatchObject({ total: 2, practiced: 1, answered: 1 });

    const behavioral = stats.byCategory.find((row) => row.category === "behavioral");
    expect(behavioral).toMatchObject({ total: 1, practiced: 1, answered: 0 });
  });

  it("returns a zero rate for an empty set", () => {
    const stats = computeInterviewPrepStats([]);
    expect(stats).toMatchObject({ total: 0, practiced: 0, answered: 0, practicedRate: 0 });
    expect(stats.byCategory).toHaveLength(6);
  });
});
