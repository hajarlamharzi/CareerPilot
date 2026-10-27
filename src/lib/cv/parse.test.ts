import { describe, expect, it } from "vitest";

import { cvDocumentFromExtraction, pdfTextItemsToLines, structureCvText } from "./parse";

const SAMPLE = [
  "Alex Moreau",
  "Frontend Engineer",
  "alex.moreau@example.com",
  "",
  "Summary",
  "Frontend engineer with six years of experience building web apps.",
  "",
  "Skills",
  "TypeScript, React, GraphQL",
  "",
  "Experience",
  "Frontend Engineer — Acme Corp",
  "2020 - Present",
  "Led the design system.",
  "",
  "Certifications",
  "AWS Certified Developer",
  "",
  "Languages",
  "English, French",
  "",
  "Achievements",
  "Won the internal hackathon",
].join("\n");

describe("pdfTextItemsToLines", () => {
  it("splits on pdf.js hasEOL markers instead of flattening a page into one line", () => {
    const text = pdfTextItemsToLines([
      { str: "Alex Moreau", hasEOL: false, x: 51, y: 780 },
      { str: "", hasEOL: true, x: 51, y: 757 },
      { str: "Frontend Developer", hasEOL: true, x: 51, y: 757 },
    ]);

    expect(text).toBe("Alex Moreau\nFrontend Developer");
  });

  it("falls back to baseline grouping when the PDF carries no EOL flags", () => {
    const text = pdfTextItemsToLines([
      { str: "Mar 2024 – Present", x: 459, y: 587 },
      { str: "Junior Frontend Developer", x: 51, y: 587 },
      { str: "Harborview Digital", x: 51, y: 570 },
    ]);

    expect(text).toBe(
      "Junior Frontend Developer Mar 2024 – Present\nHarborview Digital",
    );
  });
});

/**
 * A French CV in the shape real PDF extraction produces: accented ALL-CAPS
 * headings, decorative separators, and headings followed by content on the
 * same line. This is the regression case reported by a user whose imported CV
 * showed only the contact block.
 */
const FRENCH_SAMPLE = [
  "Hajar Lamharzi",
  "Développeuse Frontend",
  "hajarlamharzi@gmail.com · +212691249304 · Salé, Maroc",
  "",
  "PROFIL",
  "Développeuse frontend passionnée par les interfaces accessibles.",
  "",
  "EXPÉRIENCE PROFESSIONNELLE",
  "Développeuse Frontend — Acme Maroc",
  "Jan 2022 – Présent",
  "Développement d'une application React utilisée par 10 000 utilisateurs.",
  "",
  "COMPÉTENCES",
  "React, TypeScript, Next.js, Tailwind CSS",
  "",
  "FORMATION",
  "Licence Informatique — Université Mohammed V",
  "2018 - 2021",
  "",
  "LANGUES",
  "Arabe, Français, Anglais",
  "",
  "CENTRES D'INTÉRÊT",
  "Photographie, Randonnée",
].join("\n");

describe("structureCvText — French and noisy headings", () => {
  it("detects accented French section headings", () => {
    const result = structureCvText(FRENCH_SAMPLE);

    expect(result.contact.fullName).toBe("Hajar Lamharzi");
    expect(result.contact.email).toBe("hajarlamharzi@gmail.com");
    expect(result.summary).toContain("interfaces accessibles");
    expect(result.experience.length).toBeGreaterThan(0);
    expect(result.skills.length).toBeGreaterThan(0);
    expect(result.education.length).toBeGreaterThan(0);
    expect(result.languages.length).toBeGreaterThan(0);
    expect(result.achievements.length).toBeGreaterThan(0);
  });

  it("keeps skills out of the summary bucket", () => {
    const result = structureCvText(FRENCH_SAMPLE);

    expect(result.summary).not.toContain("TypeScript");
    // Skills are canonicalized to lowercase for matching; see skill-alias.ts.
    expect(result.skills).toContain("react");
  });

  it("accepts case-insensitive and decorated English headings", () => {
    const result = structureCvText(
      [
        "Alex Moreau",
        "alex@example.com",
        "",
        "WORK EXPERIENCE",
        "Engineer — Acme",
        "2020 - Present",
        "",
        "TECHNICAL SKILLS:",
        "Go, Rust",
      ].join("\n"),
    );

    expect(result.experience.length).toBeGreaterThan(0);
    expect(result.skills).toContain("go");
  });
});

describe("cvDocumentFromExtraction", () => {
  it("promotes extracted records into id-bearing document entries", () => {
    const doc = cvDocumentFromExtraction(structureCvText(SAMPLE));

    expect(doc.sections.certifications.length).toBeGreaterThan(0);
    for (const cert of doc.sections.certifications) {
      expect(typeof cert.id).toBe("string");
      expect(cert.id.length).toBeGreaterThan(0);
    }

    expect(doc.sections.languages.length).toBeGreaterThan(0);
    for (const lang of doc.sections.languages) {
      expect(typeof lang.id).toBe("string");
      expect(lang.id.length).toBeGreaterThan(0);
    }

    expect(doc.sections.achievements.length).toBeGreaterThan(0);
    for (const item of doc.sections.achievements) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.text).toBe("string");
      expect(item.text.length).toBeGreaterThan(0);
    }
  });
});
