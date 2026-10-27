import { z } from "zod";

import type { Company, Job } from "@/types";
import {
  isoDateStringSchema,
  originSchema,
  salaryRangeSchema,
  tagSchema,
} from "./common";

export const companySchema: z.ZodType<Company> = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  website: z.string().nullable(),
  logo: z.string().nullable(),
  description: z.string().nullable(),
  industry: z.string().nullable(),
});

export const jobSchema: z.ZodType<Job> = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(160),
  companyWebsite: z.string().nullable(),
  companyLogo: z.string().nullable(),
  location: z.string().min(1).max(160),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  employmentType: z.enum([
    "full-time",
    "part-time",
    "contract",
    "internship",
    "temporary",
  ]),
  seniority: z
    .enum(["intern", "junior", "mid", "senior", "lead", "principal"])
    .nullable(),
  salary: salaryRangeSchema.nullable(),
  description: z.string(),
  responsibilities: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  experienceYears: z.number().nonnegative().nullable(),
  education: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceName: z.string().nullable(),
  publishedAt: isoDateStringSchema.nullable(),
  deadline: isoDateStringSchema.nullable(),
  addedAt: isoDateStringSchema,
  status: z.enum(["saved", "shortlisted", "applied", "archived"]),
  notes: z.string().nullable(),
  tags: z.array(tagSchema),
  origin: originSchema,
});

export const jobArraySchema = z.array(jobSchema);
export const companyArraySchema = z.array(companySchema);
