import type { EmploymentType, Job, SalaryRange, Seniority, WorkMode } from "@/types";
import { fold } from "@/lib/jobs/text";

/**
 * Shared normalisation for live job sources.
 *
 * Everything here is pure and defensive: upstream HTML is stripped to text,
 * URLs are validated against an http(s)-only allow-list, and every mapping is
 * explicit about what the source does *not* provide (`null`, never a guess).
 */

/** Hard cap on stored description length — sources can return megabytes of HTML. */
export const MAX_LIVE_DESCRIPTION_CHARS = 6_000;

/**
 * Validate an external URL. Only `http:` and `https:` are accepted; anything
 * else (`javascript:`, `data:`, `file:`, malformed) is rejected and returns
 * `null` so callers render "no link" instead of a dangerous anchor.
 */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Reject credentials embedded in the URL (phishing/exfiltration vector).
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Strip HTML tags and decode the handful of entities sources actually emit.
 *
 * This is intentionally *not* an HTML parser: the output is plain text for
 * display and for the matching engine, never re-rendered as HTML, so tag
 * soup degrades to text rather than to an injection.
 */
export function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const value = Number.parseInt(code, 10);
      return value >= 32 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
    })
    // Some feeds (Jobicy in particular) already contain U+FFFD replacement
    // characters for smart quotes. Dropping them keeps displayed text clean
    // without guessing what the original character was.
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clamp a description to the stored cap, cutting on a word boundary. */
export function clampDescription(text: string): string {
  if (text.length <= MAX_LIVE_DESCRIPTION_CHARS) return text;
  const cut = text.slice(0, MAX_LIVE_DESCRIPTION_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : MAX_LIVE_DESCRIPTION_CHARS).trimEnd()}…`;
}

/** Map free-text employment-type labels onto the domain enum. */
export function mapEmploymentType(raw: string | null | undefined): EmploymentType | null {
  if (!raw) return null;
  const folded = raw.toLowerCase();
  if (folded.includes("intern") || folded.includes("stagia")) return "internship";
  if (folded.includes("part")) return "part-time";
  if (folded.includes("contract") || folded.includes("freelance") || folded.includes("cdi")) {
    // "contract" is the honest bucket for freelance/contractor style roles.
    if (folded.includes("full")) return "full-time";
    return "contract";
  }
  if (folded.includes("tempor") || folded.includes("interim") || folded.includes("fixed")) {
    return "temporary";
  }
  if (folded.includes("full") || folded.includes("permanent") || folded.includes("cdi")) {
    return "full-time";
  }
  return null;
}

/** Map free-text seniority labels onto the domain enum. */
export function mapSeniority(raw: string | null | undefined): Seniority | null {
  if (!raw) return null;
  const folded = raw.toLowerCase();
  if (folded.includes("principal") || folded.includes("staff")) return "principal";
  if (folded.includes("lead") || folded.includes("manager") || folded.includes("head")) {
    return "lead";
  }
  if (folded.includes("senior") || folded.includes("sr") || folded.includes("expert")) {
    return "senior";
  }
  if (folded.includes("junior") || folded.includes("entry")) return "junior";
  if (folded.includes("intern") || folded.includes("stagia")) return "intern";
  if (folded.includes("mid") || folded.includes("intermediate") || folded.includes("confirm")) {
    return "mid";
  }
  return null;
}

/** Build a salary range only from values the source actually published. */
export function buildSalary(
  min: unknown,
  max: unknown,
  currency: string | null | undefined,
  period: SalaryRange["period"],
): SalaryRange | null {
  const lo = toPositiveNumber(min);
  const hi = toPositiveNumber(max);
  if (lo === null && hi === null) return null;
  return {
    min: lo,
    max: hi,
    currency: (currency ?? "").trim().toUpperCase() || "EUR",
    period,
  };
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return null;
}

/** Normalise a work-mode signal; `null` means "the source does not say". */
export function mapWorkMode(
  hints: readonly (string | null | undefined)[],
): WorkMode | null {
  for (const hint of hints) {
    if (!hint) continue;
    const folded = hint.toLowerCase();
    if (folded.includes("remote") || folded.includes("télétravail")) return "remote";
    if (folded.includes("hybrid") || folded.includes("hybride")) return "hybrid";
    if (folded.includes("on-site") || folded.includes("onsite") || folded.includes("site")) {
      return "onsite";
    }
  }
  return null;
}

/** Parse an ISO date defensively; `null` when unparseable. */
export function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Namespaced, stable id for a live listing.
 *
 * The prefix keeps live ids from ever colliding with catalogue ids in the
 * browser workspace, and the source segment makes duplicates across sources
 * impossible by construction.
 */
export function liveJobId(sourceId: string, externalId: string): string {
  const cleanExt = externalId.trim().replace(/\s+/g, "_").slice(0, 80);
  return `live:${sourceId}:${cleanExt}`;
}

/** Strip common tracking parameters from a URL for stable dedup keys. */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const tracking = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"];
    for (const param of tracking) url.searchParams.delete(param);
    url.hash = "";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.host.toLowerCase()}${path}${url.search ? `?${url.searchParams.toString()}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/**
 * Resolve a free-text country name (French or English) to an ISO code.
 *
 * Priority markets are mapped explicitly; anything else returns `null` so the
 * caller can decide (live sources receive no country filter rather than the
 * wrong one). Deliberately small: an unknown name must not silently become a
 * plausible-looking code.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  maroc: "MA", morocco: "MA", marrakech: "MA", casablanca: "MA", rabat: "MA",
  france: "FR", paris: "FR", lyon: "FR", marseille: "FR", toulouse: "FR",
  allemagne: "DE", germany: "DE", berlin: "DE", munich: "DE",
  royaumeuni: "GB", "royaume-uni": "GB", uk: "GB", "unitedkingdom": "GB",
  "grandebretagne": "GB", angleterre: "GB", london: "GB",
  "etatsunis": "US", "états-unis": "US", usa: "US", "unitedstates": "US",
  canada: "CA", quebec: "CA", montreal: "CA", toronto: "CA",
  espagne: "ES", spain: "ES", madrid: "ES", barcelone: "ES",
  italie: "IT", italy: "IT", rome: "IT", milan: "IT",
  belgique: "BE", belgium: "BE", bruxelles: "BE",
  "paysbas": "NL", "pays-bas": "NL", netherlands: "NL", amsterdam: "NL",
  portugal: "PT", lisbonne: "PT", lisbon: "PT",
  suisse: "CH", switzerland: "CH", zurich: "CH",
  marocais: "MA",
};

export function resolveCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = fold(raw).replace(/[^a-z]/g, "");
  if (!key) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  // Two-letter codes pass through when already uppercase-compatible.
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

/** Minimal skeleton for a live job; callers fill source-specific fields. */
export function blankLiveJob(input: {
  id: string;
  title: string;
  company: string;
  sourceName: string;
  sourceUrl: string | null;
  addedAt: string;
}): Job {
  return {
    id: input.id,
    title: input.title,
    company: input.company,
    companyWebsite: null,
    companyLogo: null,
    location: "",
    // `onsite` is the type default; the UI must not *display* a work mode the
    // source never stated, which is why `LiveJobResult` consumers read the
    // provenance, not the default.
    workMode: "onsite" satisfies WorkMode,
    employmentType: "full-time" satisfies EmploymentType,
    seniority: null,
    salary: null,
    description: "",
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    experienceYears: null,
    education: null,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    publishedAt: null,
    deadline: null,
    addedAt: input.addedAt,
    status: "saved",
    notes: null,
    tags: [],
    // `user` is the only non-demo origin in the domain union; live listings are
    // not demo data. Provenance badges come from the source name + URL, which
    // the UI labels as external.
    origin: "user",
  };
}
