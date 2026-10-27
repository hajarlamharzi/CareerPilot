import type { EmploymentType, Job, Seniority, WorkMode } from "@/types";

/**
 * Provenance of a listing.
 *
 * The product must never blur the line between "a real vacancy we retrieved
 * from a configured source" and "a row somebody typed in". Every result carries
 * this object so the interface can label it honestly.
 */
export type JobProvenanceKind =
  | "platform"
  | "import"
  | "api"
  | "user-submitted"
  | "sample";

export interface JobProvenance {
  kind: JobProvenanceKind;
  /** French badge label, ready to render. */
  label: string;
  /** The source name recorded on the row, when there is one. */
  sourceName: string | null;
  /** The original listing URL, when there is one. */
  sourceUrl: string | null;
  /** Sample/demo rows are always flagged, never presented as live vacancies. */
  isSample: boolean;
  /**
   * `true` only for listings that came from an administrator-managed source
   * with an upstream URL. Everything else is explicitly not "verified".
   */
  isVerified: boolean;
}

export const JOB_PROVENANCE_LABELS: Record<JobProvenanceKind, string> = {
  platform: "Catalogue CareerPilot",
  import: "Import de fichier",
  api: "Source externe",
  "user-submitted": "Proposée par un utilisateur",
  sample: "Donnée d'exemple",
};

export const JOB_PROVENANCE_DESCRIPTIONS: Record<JobProvenanceKind, string> = {
  platform:
    "Offre enregistrée directement dans le catalogue CareerPilot par un administrateur.",
  import:
    "Offre importée depuis un fichier CSV ou JSON fourni par un administrateur.",
  api: "Offre récupérée via une source externe configurée, avec son lien d'origine.",
  "user-submitted":
    "Offre ajoutée par un utilisateur à partir d'une annonce externe. Sa validité n'est pas garantie.",
  sample:
    "Donnée de démonstration. Ce n'est pas une offre d'emploi réelle et actuelle.",
};

export type JobSortMode = "relevance" | "recent" | "salary" | "company";

/** Validated search filters. Every field is optional; absent means "no filter". */
export interface JobSearchFilters {
  /** Free-text query matched against title, company and description. */
  query: string;
  /** Explicit job-title filters (OR-ed together). */
  titles: string[];
  locations: string[];
  companies: string[];
  employmentTypes: EmploymentType[];
  workModes: WorkMode[];
  seniorities: Seniority[];
  minSalary: number | null;
  currency: string | null;
  /** ISO date; only listings published on or after this day. */
  publishedAfter: string | null;
  /** Include listings whose `expires_at` has passed. */
  includeExpired: boolean;
  /** Include explicitly-labelled sample rows. */
  includeSamples: boolean;
  sort: JobSortMode;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export const DEFAULT_JOB_SEARCH_FILTERS: JobSearchFilters = {
  query: "",
  titles: [],
  locations: [],
  companies: [],
  employmentTypes: [],
  workModes: [],
  seniorities: [],
  minSalary: null,
  currency: null,
  publishedAfter: null,
  includeExpired: false,
  includeSamples: true,
  sort: "relevance",
  page: 1,
  pageSize: 9,
};

/** One ranked search result. */
export interface JobSearchHit {
  job: Job;
  provenance: JobProvenance;
  /** Present when the search ran with a candidate context. */
  rank: JobRank | null;
}

export interface JobSearchResult {
  items: JobSearchHit[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Which backend answered. `catalogue` is CareerPilot's own database. */
  source: "catalogue";
  /** Filters actually applied, echoed back so the UI can show them verbatim. */
  appliedFilters: JobSearchFilters;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export type RankDimension =
  | "title"
  | "requiredSkills"
  | "preferredSkills"
  | "experience"
  | "location"
  | "workMode"
  | "employmentType"
  | "salary";

export interface RankBreakdownEntry {
  dimension: RankDimension;
  label: string;
  /** Contribution to the final score, 0–1. */
  score: number;
  /** Relative weight used, so the maths is reproducible from the UI. */
  weight: number;
  /** Human sentence explaining the number. */
  evidence: string;
}

export interface JobRank {
  /** 0–100. An estimate of *fit*, never a probability of being hired. */
  score: number;
  category: "strong" | "moderate" | "low";
  breakdown: RankBreakdownEntry[];
  matchedSkills: string[];
  missingRequired: string[];
  missingPreferred: string[];
  /** Honest limits of the estimate, shown next to the score. */
  caveats: string[];
}

/** The candidate context used for ranking. Derived from real stored data. */
export interface CandidateContext {
  /** Job titles the candidate is targeting. */
  targetTitles: string[];
  /** Canonical + free-form skills the candidate has evidenced. */
  skills: string[];
  locations: string[];
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
  seniorities: Seniority[];
  minimumSalary: number | null;
  currency: string | null;
  /** Keywords extracted from the natural-language request, if any. */
  keywords: string[];
}
