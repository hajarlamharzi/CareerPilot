import type { ISODateString } from "./common";

export type MatchMode = "baseline" | "ai";
export type MatchCategory = "strong" | "moderate" | "low";

export type MatchDimension =
  | "requiredSkills"
  | "preferredSkills"
  | "experience"
  | "alignment";

export interface SkillEvidence {
  /** Normalised skill name. */
  skill: string;
  /** How the skill was found in the CV (matched alias or evidence snippet). */
  evidence: string | null;
}

export interface DimensionScore {
  dimension: MatchDimension;
  /** 0–1 score for this dimension, or null when it cannot be computed. */
  score: number | null;
  /** Applied weight (0–1). */
  weight: number;
  /** Weight after redistributing inapplicable dimensions. */
  effectiveWeight: number;
  /** Human explanation of how the score was derived. */
  explanation: string;
}

export interface MatchFinding {
  id: string;
  severity: "positive" | "neutral" | "warning";
  title: string;
  detail: string;
  evidence: string | null;
}

export interface MatchReport {
  id: string;
  jobId: string;
  cvId: string | null;
  mode: MatchMode;
  /** Deterministic 0–100 score. Always present. */
  score: number;
  category: MatchCategory;
  breakdown: DimensionScore[];
  matchedSkills: SkillEvidence[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  findings: MatchFinding[];
  keywordsToConsider: string[];
  qualificationGaps: string[];
  learningPriorities: string[];
  cvImprovements: string[];
  /** 0–1 confidence based on how complete the available inputs were. */
  confidence: number;
  /** Present only for AI mode. */
  aiAssessment: string | null;
  providerId: string | null;
  modelId: string | null;
  createdAt: ISODateString;
}
