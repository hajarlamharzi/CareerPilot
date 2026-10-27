import { z } from "zod";

import type { ActivityEvent } from "@/types";
import { isoDateStringSchema, originSchema } from "./common";

export const activityEventSchema: z.ZodType<ActivityEvent> = z.object({
  id: z.string().min(1),
  at: isoDateStringSchema,
  type: z.enum([
    "job-added",
    "job-imported",
    "job-updated",
    "job-deleted",
    "cv-uploaded",
    "cv-updated",
    "cv-generated",
    "match-run",
    "application-added",
    "application-status",
    "application-note",
    "interview-saved",
    "data-imported",
    "data-exported",
    "workspace-reset",
  ]),
  message: z.string(),
  entityId: z.string().nullable(),
  origin: originSchema,
});

export const activityEventArraySchema = z.array(activityEventSchema);
