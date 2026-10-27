import { z } from "zod";

import type {
  DimensionScore,
  MatchFinding,
  MatchReport,
  SkillEvidence,
} from "@/types";
import { isoDateStringSchema } from "./common";

export const skillEvidenceSchema: z.ZodType<SkillEvidence> = z.object({
  skill: z.string(),
  evidence: z.string().nullable(),
});

export const dimensionScoreSchema: z.ZodType<DimensionScore> = z.object({
  dimension: z.enum([
    "requiredSkills",
    "preferredSkills",
    "experience",
    "alignment",
  ]),
  score: z.number().min(0).max(1).nullable(),
  weight: z.number().min(0).max(1),
  effectiveWeight: z.number().min(0).max(1),
  explanation: z.string(),
});

export const matchFindingSchema: z.ZodType<MatchFinding> = z.object({
  id: z.string().min(1),
  severity: z.enum(["positive", "neutral", "warning"]),
  title: z.string(),
  detail: z.string(),
  evidence: z.string().nullable(),
});

export const matchReportSchema: z.ZodType<MatchReport> = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  cvId: z.string().nullable(),
  mode: z.enum(["baseline", "ai"]),
  score: z.number().min(0).max(100),
  category: z.enum(["strong", "moderate", "low"]),
  breakdown: z.array(dimensionScoreSchema),
  matchedSkills: z.array(skillEvidenceSchema),
  missingRequiredSkills: z.array(z.string()),
  missingPreferredSkills: z.array(z.string()),
  findings: z.array(matchFindingSchema),
  keywordsToConsider: z.array(z.string()),
  qualificationGaps: z.array(z.string()),
  learningPriorities: z.array(z.string()),
  cvImprovements: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  aiAssessment: z.string().nullable(),
  providerId: z.string().nullable(),
  modelId: z.string().nullable(),
  createdAt: isoDateStringSchema,
});

export const matchReportArraySchema = z.array(matchReportSchema);
