import { describe, expect, it } from "vitest";

import {
  buildSalary,
  canonicalUrl,
  clampDescription,
  liveJobId,
  mapEmploymentType,
  mapSeniority,
  mapWorkMode,
  parseIsoDate,
  resolveCountryCode,
  safeExternalUrl,
  stripHtml,
  MAX_LIVE_DESCRIPTION_CHARS,
} from "./normalizer";

/**
 * The normaliser is the only place upstream data becomes a domain `Job`, so the
 * rules pinned here are the app's guarantees: nothing is invented, no unsafe URL
 * becomes an anchor, and unknown geography never silently becomes a code.
 */

describe("safeExternalUrl", () => {
  it("accepts http and https URLs", () => {
    expect(safeExternalUrl("https://jobicy.com/jobs/1")).toBe(
      "https://jobicy.com/jobs/1",
    );
    expect(safeExternalUrl("http://example.org/a")).toBe("http://example.org/a");
  });

  it("rejects non-http schemes instead of rendering a dangerous link", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects credentials embedded in a URL and hostless input", () => {
    expect(safeExternalUrl("https://user:pass@evil.example/x")).toBeNull();
    expect(safeExternalUrl("https://localhost/x")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(42)).toBeNull();
  });
});

describe("stripHtml", () => {
  it("reduces markup to text rather than re-rendering it", () => {
    const out = stripHtml("<p>Hello <strong>world</strong></p><script>bad()</script>");
    expect(out).toBe("Hello world");
    expect(out).not.toContain("<");
  });

  it("decodes the entities sources actually emit", () => {
    expect(stripHtml("R&amp;D &#233;quipe &quot;core&quot;")).toBe(
      'R&D équipe "core"',
    );
  });

  it("drops U+FFFD replacement characters instead of inventing glyphs", () => {
    expect(stripHtml("We\uFFFDve shipped")).toBe("Weve shipped");
  });
});

describe("clampDescription", () => {
  it("keeps short text untouched and cuts long text on a word boundary", () => {
    expect(clampDescription("short")).toBe("short");
    const long = "mot ".repeat(4_000);
    const clamped = clampDescription(long);
    expect(clamped.length).toBeLessThanOrEqual(MAX_LIVE_DESCRIPTION_CHARS + 1);
    expect(clamped.endsWith("…")).toBe(true);
  });
});

describe("enum mapping", () => {
  it("maps employment types from free text", () => {
    expect(mapEmploymentType("Full-time")).toBe("full-time");
    expect(mapEmploymentType("Internship")).toBe("internship");
    expect(mapEmploymentType("Part-time")).toBe("part-time");
    expect(mapEmploymentType("Contract")).toBe("contract");
    expect(mapEmploymentType("Freelance")).toBe("contract");
    expect(mapEmploymentType("Temporary")).toBe("temporary");
  });

  it("returns null rather than guessing an unknown employment type", () => {
    expect(mapEmploymentType("weird-label")).toBeNull();
    expect(mapEmploymentType(null)).toBeNull();
  });

  it("maps seniority and never defaults an unstated level", () => {
    expect(mapSeniority("Senior")).toBe("senior");
    expect(mapSeniority("Staff")).toBe("principal");
    expect(mapSeniority("Junior")).toBe("junior");
    expect(mapSeniority("")).toBeNull();
    expect(mapSeniority(undefined)).toBeNull();
  });

  it("maps work mode from the first usable hint", () => {
    expect(mapWorkMode([null, "Fully remote", "onsite"])).toBe("remote");
    expect(mapWorkMode(["Hybride"])).toBe("hybrid");
    expect(mapWorkMode([""])).toBeNull();
  });
});

describe("buildSalary", () => {
  it("builds a range only from published values", () => {
    expect(buildSalary(50_000, 70_000, "eur", "year")).toEqual({
      min: 50_000,
      max: 70_000,
      currency: "EUR",
      period: "year",
    });
  });

  it("keeps a one-sided range and reports null when nothing was published", () => {
    expect(buildSalary(null, "90000", "USD", "year")).toMatchObject({
      min: null,
      max: 90_000,
    });
    expect(buildSalary(null, null, "EUR", "year")).toBeNull();
    expect(buildSalary(undefined, undefined, null, null)).toBeNull();
  });
});

describe("parseIsoDate", () => {
  it("normalises valid dates and rejects junk", () => {
    expect(parseIsoDate("2026-10-01T09:00:00Z")).toBe("2026-10-01T09:00:00.000Z");
    expect(parseIsoDate("not a date")).toBeNull();
    expect(parseIsoDate(12345)).toBeNull();
  });
});

describe("liveJobId", () => {
  it("namespaces ids so live records can never collide with the catalogue", () => {
    expect(liveJobId("jobicy", "155950")).toBe("live:jobicy:155950");
    expect(liveJobId("adzuna", "42 1")).toBe("live:adzuna:42_1");
  });
});

describe("canonicalUrl", () => {
  it("removes tracking parameters and hashes for stable dedup", () => {
    expect(
      canonicalUrl("https://Example.com/jobs/1/?utm_source=x&ref=y#frag"),
    ).toBe("example.com/jobs/1");
  });

  it("degrades to a lowercased string for unparseable input", () => {
    expect(canonicalUrl("  Nonsense  ")).toBe("nonsense");
  });
});

describe("resolveCountryCode", () => {
  it("maps priority-market names and cities to ISO codes", () => {
    expect(resolveCountryCode("France")).toBe("FR");
    expect(resolveCountryCode("Paris")).toBe("FR");
    expect(resolveCountryCode("Maroc")).toBe("MA");
    expect(resolveCountryCode("Casablanca")).toBe("MA");
    expect(resolveCountryCode("États-Unis")).toBe("US");
  });

  it("passes through two-letter codes, uppercased", () => {
    expect(resolveCountryCode("fr")).toBe("FR");
  });

  it("returns null for unknown names rather than inventing a code", () => {
    expect(resolveCountryCode("Atlantide")).toBeNull();
    expect(resolveCountryCode("")).toBeNull();
    expect(resolveCountryCode(null)).toBeNull();
  });
});
