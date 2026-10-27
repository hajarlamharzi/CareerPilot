import { describe, expect, it } from "vitest";

import { excerpt, fold, jobFingerprint, splitList, tokenOverlap, tokenize } from "./text";

/**
 * Text normalisation is shared by search, deduplication and ranking. Keeping the
 * behaviour pinned here means a change to `fold` cannot quietly break search.
 */

describe("fold", () => {
  it("lower-cases and strips diacritics", () => {
    expect(fold("Développeur")).toBe("developpeur");
    expect(fold("TÉLÉTRAVAIL")).toBe("teletravail");
  });

  it("collapses whitespace and trims", () => {
    expect(fold("  Front  End  ")).toBe("front end");
  });

  it("keeps technical characters and drops punctuation", () => {
    expect(fold("C++ / C# & .NET")).toBe("c++ / c# .net");
  });

  it("turns apostrophes into separators", () => {
    expect(fold("d'emploi")).toBe("d emploi");
  });
});

describe("tokenize", () => {
  it("drops stop words and single characters", () => {
    expect(tokenize("Je cherche un poste de développeur React")).toEqual([
      "developpeur",
      "react",
    ]);
  });
});

describe("jobFingerprint", () => {
  it("is stable across case and surrounding whitespace", () => {
    const first = jobFingerprint({ title: "Frontend Developer", company: " Acme ", location: "Lyon" });
    const second = jobFingerprint({
      title: "  frontend developer ",
      company: "ACME",
      location: "lyon",
    });
    expect(first).toBe(second);
  });

  it("treats a null location and an empty one identically", () => {
    expect(
      jobFingerprint({ title: "Dev", company: "Acme", location: null }),
    ).toBe(jobFingerprint({ title: "Dev", company: "Acme", location: "" }));
  });

  it("distinguishes listings that differ anywhere", () => {
    const base = jobFingerprint({ title: "Dev", company: "Acme", location: "Lyon" });
    expect(jobFingerprint({ title: "Dev", company: "Acme", location: "Paris" })).not.toBe(base);
    expect(jobFingerprint({ title: "Dev", company: "Globex", location: "Lyon" })).not.toBe(base);
  });

  it("returns a hex digest", () => {
    expect(jobFingerprint({ title: "Dev", company: "Acme", location: "Lyon" })).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });
});

describe("tokenOverlap", () => {
  it("reports the share of expected tokens that are present", () => {
    expect(tokenOverlap("React and TypeScript developer", ["react", "typescript", "go"])).toBeCloseTo(
      2 / 3,
    );
  });

  it("is zero when there is nothing to look for", () => {
    expect(tokenOverlap("React and TypeScript", [])).toBe(0);
  });

  it("ignores expected tokens that are too short to be meaningful", () => {
    expect(tokenOverlap("React developer", ["a"])).toBe(0);
  });
});

describe("splitList", () => {
  it("splits on commas, semicolons and pipes and trims", () => {
    expect(splitList("React; TypeScript | Node, Go")).toEqual([
      "React",
      "TypeScript",
      "Node",
      "Go",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(splitList("")).toEqual([]);
    expect(splitList(null)).toEqual([]);
    expect(splitList(undefined)).toEqual([]);
  });
});

describe("excerpt", () => {
  it("returns short text unchanged", () => {
    expect(excerpt("Short description", 40)).toBe("Short description");
  });

  it("truncates on a word boundary and marks the cut", () => {
    const result = excerpt("hello world again", 11);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(12);
    expect(result.startsWith("hello")).toBe(true);
  });
});
