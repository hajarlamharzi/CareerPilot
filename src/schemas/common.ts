import { z } from "zod";

import type {
  ISODateString,
  Origin,
  RecruiterContact,
  SalaryRange,
  StatusHistoryEntry,
  Tag,
} from "@/types";

export const originSchema: z.ZodType<Origin> = z.enum(["demo", "user"]);

export const isoDateStringSchema: z.ZodType<ISODateString> = z.string().min(1);

export const tagSchema: z.ZodType<Tag> = z.string().min(1).max(48);

export const salaryRangeSchema: z.ZodType<SalaryRange> = z.object({
  min: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
  currency: z.string().min(1).max(8),
  period: z.enum(["year", "month", "day", "hour"]).nullable(),
});

export const recruiterContactSchema: z.ZodType<RecruiterContact> = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
});

export const statusHistoryEntrySchema: z.ZodType<StatusHistoryEntry> =
  z.object({
    id: z.string().min(1),
    from: z.string().nullable(),
    to: z.string().min(1),
    at: isoDateStringSchema,
    note: z.string().nullable(),
  });
