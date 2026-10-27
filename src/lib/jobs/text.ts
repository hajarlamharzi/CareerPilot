import { createHash } from "node:crypto";

/**
 * Text normalisation shared by search, deduplication and ranking.
 *
 * Everything here is pure and deterministic so it can be unit-tested and so the
 * same input always produces the same score.
 */

/** Lowercase and strip diacritics: "Développeur" → "developpeur". */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    // Combining diacritical marks.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux", "et", "ou",
  "en", "à", "a", "dans", "sur", "pour", "par", "avec", "sans", "chez", "je",
  "tu", "il", "elle", "nous", "vous", "ils", "elles", "cherche", "trouve",
  "trouver", "poste", "postes", "offre", "offres", "emploi", "emplois",
  "the", "a", "an", "and", "or", "of", "for", "with", "in", "on", "at", "to",
  "job", "jobs", "role", "roles", "position", "looking", "want", "need",
]);

/** Tokenise free text into meaningful, folded terms. */
export function tokenize(value: string): string[] {
  return fold(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Deterministic content fingerprint for a listing.
 *
 * Mirrors the stored `jobs.fingerprint` generated column exactly
 * (`md5(lower(btrim(title)) | lower(btrim(company)) | lower(btrim(location)))`),
 * so an import can detect a duplicate *before* attempting an insert and report a
 * helpful "already in the catalogue" message instead of a raw constraint error.
 *
 * Implemented with Web Crypto-free `node:crypto` so it works in tests and in
 * Node route handlers. The client never needs it.
 */
export function jobFingerprint(input: {
  title: string;
  company: string;
  location: string | null;
}): string {
  const canonical = [
    input.title.trim().toLowerCase(),
    input.company.trim().toLowerCase(),
    (input.location ?? "").trim().toLowerCase(),
  ].join("|");
  return createHash("md5").update(canonical, "utf8").digest("hex");
}

/**
 * Folds the way PostgreSQL's `lower(btrim(...))` does for the ASCII range our
 * column values use. Postgres' `lower()` is locale-aware; for the languages
 * CareerPilot targets the two agree, and the database remains the authority —
 * this is only used to *predict* a duplicate.
 */
export function previewFingerprintInput(input: {
  title: string;
  company: string;
  location: string | null;
}): string {
  return [
    input.title.trim().toLowerCase(),
    input.company.trim().toLowerCase(),
    (input.location ?? "").trim().toLowerCase(),
  ].join(" | ");
}

/** How many `expected` tokens appear in `haystack`, as a 0–1 ratio. */
export function tokenOverlap(haystack: string, expected: readonly string[]): number {
  const useful = expected.map(fold).filter((token) => token.length > 1);
  if (useful.length === 0) return 0;
  const haystackTokens = new Set(tokenize(haystack));
  let hits = 0;
  for (const token of useful) {
    if (haystackTokens.has(token)) hits += 1;
  }
  return hits / useful.length;
}

/** Split a comma/semicolon/pipe separated list into trimmed values. */
export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;|]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Collapse whitespace and clamp a long description to a bounded excerpt. */
export function excerpt(value: string, maxLength = 480): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}
