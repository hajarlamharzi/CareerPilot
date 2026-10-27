import { describe, expect, it } from "vitest";

import { normalizeAdzunaResult } from "./adzuna";

/**
 * Adzuna's normaliser is tested without credentials and without network: the
 * mapping from a documented API payload to a domain job is pure, and the
 * honesty rules (no invented currency, estimated salaries flagged, Morocco not
 * covered) live here.
 */

const RAW = {
  id: "4012345",
  title: "Développeur Front-End (React)",
  description: "<p>Rejoignez l'équipe <b>produit</b>.</p>",
  redirect_url: "https://www.adzuna.fr/land/ad/4012345?utm_source=api",
  created: "2026-10-18T08:30:00Z",
  salary_min: 45_000,
  salary_max: 60_000,
  salary_is_predicted: 0,
  contract_time: "full_time",
  contract_type: "permanent",
  category: { label: "IT Jobs" },
  company: { display_name: "Acme", url: "https://acme.example", logo: "https://acme.example/logo.png" },
  location: { display_name: "Paris, Ile-de-France" },
};

describe("normalizeAdzunaResult", () => {
  it("maps published fields, using the market's local currency", () => {
    const result = normalizeAdzunaResult(RAW, "FR", "2026-10-20T00:00:00.000Z");
    const job = result!.job;
    expect(job.id).toBe("live:adzuna:4012345");
    expect(job.title).toBe("Développeur Front-End (React)");
    expect(job.company).toBe("Acme");
    expect(job.location).toBe("Paris, Ile-de-France");
    expect(job.workMode).toBe("onsite");
    expect(job.employmentType).toBe("full-time");
    expect(job.salary).toEqual({
      min: 45_000,
      max: 60_000,
      currency: "EUR",
      period: "year",
    });
    expect(job.description).toBe("Rejoignez l'équipe produit .");
    expect(job.tags).toContain("source:adzuna");
    expect(job.tags).toContain("pays:fr");
  });

  it("keeps the salary in the market's local currency and flags a predicted one", () => {
    const result = normalizeAdzunaResult({ ...RAW, salary_is_predicted: 1 }, "FR", "t");
    expect(result!.job.salary).toMatchObject({ currency: "EUR" });
    expect(result!.job.tags).toContain("salaire:estimé");
  });

  it("rejects a result with no usable link", () => {
    const result = normalizeAdzunaResult({ ...RAW, redirect_url: "javascript:alert(1)" }, "FR", "t");
    expect(result!.job.sourceUrl).toBeNull();
    expect(result!.sourceUrl).toBeNull();
  });

  it("drops records without an id or title", () => {
    expect(normalizeAdzunaResult({ ...RAW, id: undefined }, "FR", "t")).toBeNull();
    expect(normalizeAdzunaResult({ ...RAW, title: "   " }, "FR", "t")).toBeNull();
  });

  it("keeps the location and work mode unstated when the source is silent", () => {
    const result = normalizeAdzunaResult(
      { id: "1", title: "Analyst", redirect_url: "https://example.com/j/1" },
      "FR",
      "t",
    );
    expect(result!.job.location).toBe("");
    // The domain enum has no "unknown"; `onsite` is the neutral default and the
    // UI reads provenance rather than claiming a mode the source never stated.
    expect(result!.job.workMode).toBe("onsite");
  });
});
