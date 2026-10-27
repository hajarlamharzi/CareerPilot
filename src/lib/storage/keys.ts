import type {
  ActivityEvent,
  AppPreferences,
  Application,
  CandidateProfile,
  CvLibrary,
  InterviewQuestion,
  Job,
  MatchReport,
  WorkspaceMeta,
} from "@/types";
import {
  activityEventArraySchema,
  appPreferencesSchema,
  applicationArraySchema,
  candidateProfileSchema,
  cvLibrarySchema,
  interviewQuestionArraySchema,
  jobArraySchema,
  matchReportArraySchema,
  workspaceMetaSchema,
} from "@/schemas";
import type { ZodType } from "zod";

/**
 * Every persisted domain maps to a fixed storage key and a Zod schema. The
 * schema is the validation gate for reads and imports, so malformed data never
 * reaches the UI.
 */
export const STORE_DOMAINS = [
  "meta",
  "profile",
  "jobs",
  "applications",
  "cv",
  "preferences",
  "interviews",
  "matches",
  "activity",
] as const;

export type StoreDomain = (typeof STORE_DOMAINS)[number];

export interface StoreShape {
  meta: WorkspaceMeta;
  profile: CandidateProfile;
  jobs: Job[];
  applications: Application[];
  cv: CvLibrary;
  preferences: AppPreferences;
  interviews: InterviewQuestion[];
  matches: MatchReport[];
  activity: ActivityEvent[];
}

export const DOMAIN_KEYS: Record<StoreDomain, string> = {
  meta: "careerpilot:v1:meta",
  profile: "careerpilot:v1:profile",
  jobs: "careerpilot:v1:jobs",
  applications: "careerpilot:v1:applications",
  cv: "careerpilot:v1:cv",
  preferences: "careerpilot:v1:preferences",
  interviews: "careerpilot:v1:interviews",
  matches: "careerpilot:v1:matches",
  activity: "careerpilot:v1:activity",
};

export const DOMAIN_SCHEMAS: {
  [D in StoreDomain]: ZodType<StoreShape[D]>;
} = {
  meta: workspaceMetaSchema,
  profile: candidateProfileSchema,
  jobs: jobArraySchema,
  applications: applicationArraySchema,
  cv: cvLibrarySchema,
  preferences: appPreferencesSchema,
  interviews: interviewQuestionArraySchema,
  matches: matchReportArraySchema,
  activity: activityEventArraySchema,
};

export const KEY_TO_DOMAIN: Record<string, StoreDomain> = Object.fromEntries(
  (Object.keys(DOMAIN_KEYS) as StoreDomain[]).map((domain) => [
    DOMAIN_KEYS[domain],
    domain,
  ]),
);
