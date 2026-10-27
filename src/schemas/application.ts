import { z } from "zod";

import type { Application, ApplicationNote } from "@/types";
import {
  isoDateStringSchema,
  originSchema,
  recruiterContactSchema,
  salaryRangeSchema,
  statusHistoryEntrySchema,
} from "./common";

export const applicationNoteSchema: z.ZodType<ApplicationNote> = z.object({
  id: z.string().min(1),
  at: isoDateStringSchema,
  body: z.string(),
});

export const APPLICATION_STATUS_VALUES = [
  "interested",
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const applicationStatusSchema = z.enum(APPLICATION_STATUS_VALUES);

export const applicationSchema: z.ZodType<Application> = z.object({
  id: z.string().min(1),
  jobId: z.string().nullable(),
  company: z.string().min(1),
  position: z.string().min(1),
  status: applicationStatusSchema,
  appliedAt: isoDateStringSchema.nullable(),
  sourceUrl: z.string().nullable(),
  sourceName: z.string().nullable(),
  contact: recruiterContactSchema,
  notes: z.array(applicationNoteSchema),
  followUpAt: isoDateStringSchema.nullable(),
  interviewAt: isoDateStringSchema.nullable(),
  salary: salaryRangeSchema.nullable(),
  history: z.array(statusHistoryEntrySchema),
  origin: originSchema,
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
});

export const applicationArraySchema = z.array(applicationSchema);
