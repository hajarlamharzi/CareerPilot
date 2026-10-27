import { z } from "zod";

import { activityEventArraySchema } from "./activity";
import { applicationArraySchema } from "./application";
import { cvLibrarySchema } from "./cv";
import { interviewQuestionArraySchema } from "./interview";
import { jobArraySchema } from "./job";
import { matchReportArraySchema } from "./match";
import { candidateProfileSchema } from "./profile";
import { appPreferencesSchema } from "./workspace";

/**
 * The portable export bundle. It intentionally excludes workspace `meta` (a
 * local concern) and never contains API keys — those are stored separately and
 * only when the user opts in.
 */
export const transferBundleSchema = z.object({
  app: z.literal("careerpilot"),
  version: z.number().int().positive(),
  exportedAt: z.string().min(1),
  data: z.object({
    profile: candidateProfileSchema,
    jobs: jobArraySchema,
    applications: applicationArraySchema,
    cv: cvLibrarySchema,
    matches: matchReportArraySchema,
    interviews: interviewQuestionArraySchema,
    activity: activityEventArraySchema,
    preferences: appPreferencesSchema,
  }),
});

export type TransferBundle = z.infer<typeof transferBundleSchema>;

export const TRANSFER_APP_ID = "careerpilot";
