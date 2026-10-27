import { z } from "zod";

import type { CandidateProfile } from "@/types";
import { isoDateStringSchema } from "./common";

export const candidateProfileSchema: z.ZodType<CandidateProfile> = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1).max(120),
  headline: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  summary: z.string().nullable(),
  updatedAt: isoDateStringSchema,
});
