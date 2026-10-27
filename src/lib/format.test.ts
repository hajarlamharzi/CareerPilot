import { describe, expect, it } from "vitest";

import { formatMoney, formatSalaryPeriod, formatSalaryRange } from "./format";

describe("formatMoney", () => {
  it("renders Moroccan dirhams with the local DH symbol, not the ISO code", () => {
    const formatted = formatMoney(7000, "MAD");

    expect(formatted).toContain("DH");
    expect(formatted).not.toContain("MAD");
    // fr-FR uses a narrow no-break space as the thousands separator.
    expect(formatted.replace(/\u202f|\u00a0/g, " ")).toBe("7 000 DH");
  });

  it("keeps locale digit grouping for larger amounts", () => {
    const formatted = formatMoney(13500, "MAD").replace(/\u202f|\u00a0/g, " ");
    expect(formatted).toBe("13 500 DH");
  });

  it("leaves other currencies to Intl", () => {
    expect(formatMoney(45000, "EUR")).toContain("€");
  });

  it("never throws on missing values", () => {
    expect(formatMoney(null, "MAD")).toBe("—");
    expect(formatMoney(undefined, "MAD")).toBe("—");
  });
});

describe("formatSalaryRange", () => {
  it("labels a MAD monthly range in French, with DH", () => {
    const label = formatSalaryRange({
      min: 13000,
      max: 22000,
      currency: "MAD",
      period: "month",
    });

    expect(label).toContain("DH");
    expect(label).toContain("/ mois");
    expect(label).not.toContain("Not specified");
  });

  it("translates the salary period", () => {
    expect(
      formatSalaryRange({ min: 1800, max: 2500, currency: "MAD", period: "day" }),
    ).toContain("/ jour");
  });

  it("uses French wording for single-ended ranges", () => {
    expect(
      formatSalaryRange({ min: 8000, max: null, currency: "MAD", period: "month" }),
    ).toContain("À partir de");
    expect(
      formatSalaryRange({ min: null, max: 9000, currency: "MAD", period: "month" }),
    ).toContain("Jusqu'à");
  });

  it("says 'Non précisé' when there is no salary", () => {
    expect(formatSalaryRange(null)).toBe("Non précisé");
  });
});

describe("formatSalaryPeriod", () => {
  it("maps stored English periods to French labels", () => {
    expect(formatSalaryPeriod("year")).toBe("an");
    expect(formatSalaryPeriod("month")).toBe("mois");
    expect(formatSalaryPeriod("day")).toBe("jour");
  });

  it("passes through unknown values rather than hiding them", () => {
    expect(formatSalaryPeriod("fortnight")).toBe("fortnight");
    expect(formatSalaryPeriod(null)).toBe("");
  });
});
