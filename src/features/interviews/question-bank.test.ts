import { describe, expect, it } from "vitest";

import {
  availableSources,
  generateInterviewQuestions,
} from "./question-bank";
import { makeCv, makeJob, makeMatchReport, makeQuestion } from "@/test/fixtures";

const job = makeJob();
const cv = makeCv();
const matchReport = makeMatchReport();

describe("generateInterviewQuestions", () => {
  it("builds job questions only from the advert's own skills and responsibilities", () => {
    const drafts = generateInterviewQuestions({
      job,
      sources: ["job"],
      limitPerSource: 50,
    });

    const text = drafts.map((draft) => draft.question).join("\n");
    for (const skill of [...job.requiredSkills, ...job.preferredSkills]) {
      expect(text).toContain(skill);
    }
    expect(text).toContain("Own the design system");
    expect(drafts.every((draft) => draft.jobId === job.id)).toBe(true);
    expect(drafts.every((draft) => draft.userAnswer === "")).toBe(true);
    expect(drafts.every((draft) => draft.practiced === false)).toBe(true);
  });

  it("only asks about gaps the match report actually found", () => {
    const drafts = generateInterviewQuestions({
      job,
      matchReport,
      sources: ["skill-gap"],
      limitPerSource: 50,
    });

    expect(drafts.map((draft) => draft.question).join(" ")).toContain("GraphQL");
    expect(drafts.map((draft) => draft.question).join(" ")).toContain("Recharts");
    expect(drafts.every((draft) => draft.category === "skill-gap")).toBe(true);
  });

  it("produces no skill-gap questions when the report found no gaps", () => {
    const drafts = generateInterviewQuestions({
      job,
      matchReport: makeMatchReport({
        missingRequiredSkills: [],
        missingPreferredSkills: [],
      }),
      sources: ["skill-gap"],
    });
    expect(drafts).toHaveLength(0);
  });

  it("draws CV questions from the stored roles and projects", () => {
    const drafts = generateInterviewQuestions({
      cv,
      sources: ["cv"],
      limitPerSource: 50,
    });
    const text = drafts.map((draft) => draft.question).join("\n");
    expect(text).toContain("Junior Frontend Developer");
    expect(text).toContain("Harborview Digital");
    expect(text).toContain("Portal rewrite");
    expect(drafts.every((draft) => draft.category === "cv-based")).toBe(true);
  });

  it("never invents achievements in the guidance", () => {
    const drafts = generateInterviewQuestions({
      job,
      cv,
      matchReport,
      sources: ["job", "skill-gap", "cv", "questions-to-ask"],
      limitPerSource: 50,
    });
    const guidance = drafts.map((draft) => draft.guidance ?? "").join("\n");
    expect(guidance).not.toMatch(/you (?:built|led|delivered|achieved|increased)/i);
    expect(guidance.length).toBeGreaterThan(0);
  });

  it("skips questions already stored in the workspace", () => {
    const first = generateInterviewQuestions({ job, sources: ["job"] });
    expect(first.length).toBeGreaterThan(0);

    const stored = first.map((draft, index) =>
      makeQuestion({ id: `q-${index}`, question: draft.question }),
    );
    const second = generateInterviewQuestions({
      job,
      sources: ["job"],
      existing: stored,
    });
    expect(second).toHaveLength(0);
  });

  it("is deterministic for the same input", () => {
    const a = generateInterviewQuestions({ job, cv, matchReport, sources: ["job", "cv"] });
    const b = generateInterviewQuestions({ job, cv, matchReport, sources: ["job", "cv"] });
    expect(a.map((draft) => draft.question)).toEqual(
      b.map((draft) => draft.question),
    );
  });

  it("honours the per-source limit", () => {
    const drafts = generateInterviewQuestions({
      job,
      sources: ["job", "questions-to-ask"],
      limitPerSource: 2,
    });
    const fromJob = drafts.filter((draft) => draft.category !== "questions-to-ask");
    const toAsk = drafts.filter((draft) => draft.category === "questions-to-ask");
    expect(fromJob).toHaveLength(2);
    expect(toAsk).toHaveLength(2);
  });

  it("ignores sources with no data to work from", () => {
    const drafts = generateInterviewQuestions({
      sources: ["job", "cv", "skill-gap", "questions-to-ask"],
    });
    expect(drafts).toHaveLength(0);
  });
});

describe("availableSources", () => {
  it("lists only the sources the workspace can support", () => {
    expect(availableSources({})).toEqual([]);
    expect(availableSources({ job })).toEqual(["job", "questions-to-ask"]);
    expect(availableSources({ job, cv })).toEqual([
      "job",
      "questions-to-ask",
      "cv",
    ]);
    expect(availableSources({ job, matchReport })).toEqual([
      "job",
      "questions-to-ask",
      "skill-gap",
    ]);
  });
});
