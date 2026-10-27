import { z } from "zod";

import type { InterviewQuestion } from "@/types";
import { isoDateStringSchema, originSchema } from "./common";

export const interviewQuestionSchema: z.ZodType<InterviewQuestion> = z.object({
  id: z.string().min(1),
  jobId: z.string().nullable(),
  applicationId: z.string().nullable(),
  category: z.enum([
    "technical",
    "behavioral",
    "role-specific",
    "cv-based",
    "skill-gap",
    "questions-to-ask",
  ]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  type: z.enum([
    "phone-screen",
    "technical",
    "behavioral",
    "system-design",
    "take-home",
    "final",
  ]),
  question: z.string().min(1),
  guidance: z.string().nullable(),
  userAnswer: z.string(),
  practiced: z.boolean(),
  origin: originSchema,
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});

export const interviewQuestionArraySchema = z.array(interviewQuestionSchema);
