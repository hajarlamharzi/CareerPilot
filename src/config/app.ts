/**
 * Global application configuration.
 *
 * These values are intentionally centralised so behaviour (upload limits,
 * matching weights, thresholds) can be tuned in one place and documented.
 */

export const APP_NAME = "CareerPilot";
export const APP_TAGLINE = "Your AI-assisted job search copilot";
export const APP_DESCRIPTION =
  "Organise job opportunities, analyse CV–job fit, tailor ATS-friendly CVs, and track applications — privately, in your browser.";

/** Repository / author metadata used on the landing page footer. */
export const APP_REPO_URL = "https://github.com/your-username/careerpilot";

/** Namespace + version for all local storage keys. */
export const STORAGE_NAMESPACE = "careerpilot";
export const STORAGE_VERSION = 1;

export function storageKey(name: string): string {
  return `${STORAGE_NAMESPACE}:v${STORAGE_VERSION}:${name}`;
}

/** IndexedDB database used for binary CV documents. */
export const IDB_NAME = `${STORAGE_NAMESPACE}-files`;
export const IDB_VERSION = 1;
export const IDB_STORE_CV_FILES = "cv-files";

/** Maximum accepted CV upload size (5 MB). Enforced client-side. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const ACCEPTED_CV_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

/** Limits for AI prompt payloads (approximate characters). */
export const MAX_AI_INPUT_CHARS = 24_000;

/**
 * Deterministic matching weights. Must sum to 1.
 * See `src/lib/matching/README` (methodology documented in docs/MATCHING.md).
 */
export const MATCH_WEIGHTS = {
  requiredSkills: 0.5,
  preferredSkills: 0.2,
  experience: 0.2,
  alignment: 0.1,
} as const;

export type MatchWeights = typeof MATCH_WEIGHTS;

/** Match categories by score (0–100). */
export const MATCH_THRESHOLDS = {
  strong: 75,
  moderate: 50,
} as const;

/** Default preferences for a new workspace. */
export const DEFAULT_PREFERENCES = {
  theme: "system",
  locale: "en",
  aiProvider: null,
  aiModel: "",
  storeApiKey: false,
  confirmBeforeAiSend: true,
} as const;

/** Search result page size. */
export const JOBS_PAGE_SIZE = 9;
