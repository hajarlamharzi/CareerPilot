import { DEFAULT_PREFERENCES, STORAGE_VERSION } from "@/config/app";
import {
  activityEventArraySchema,
  applicationArraySchema,
  candidateProfileSchema,
  companyArraySchema,
  cvLibrarySchema,
  interviewQuestionArraySchema,
  jobArraySchema,
  matchReportArraySchema,
} from "@/schemas";
import type {
  ActivityEvent,
  AppPreferences,
  Application,
  CandidateProfile,
  Company,
  CvLibrary,
  InterviewQuestion,
  Job,
  MatchReport,
  WorkspaceMeta,
} from "@/types";

import activityJson from "./activity.json";
import applicationsJson from "./applications.json";
import companiesJson from "./companies.json";
import cvJson from "./cv.json";
import interviewQuestionsJson from "./interview-questions.json";
import jobsJson from "./jobs.json";
import matchesJson from "./matches.json";
import profileJson from "./profile.json";

/**
 * The full set of persisted domains for a workspace. Both the demo dataset and
 * a personal workspace are described by this shape.
 */
export interface WorkspaceSnapshot {
  meta: WorkspaceMeta;
  profile: CandidateProfile;
  jobs: Job[];
  applications: Application[];
  cv: CvLibrary;
  matches: MatchReport[];
  interviews: InterviewQuestion[];
  activity: ActivityEvent[];
  preferences: AppPreferences;
}

export interface DemoDataset {
  companies: Company[];
  jobs: Job[];
  applications: Application[];
  cv: CvLibrary;
  matches: MatchReport[];
  interviews: InterviewQuestion[];
  activity: ActivityEvent[];
  profile: CandidateProfile;
}

/**
 * Parsed demo dataset. Validation happens here so a malformed JSON asset fails
 * loudly in tests and development rather than silently corrupting the app.
 */
export function loadDemoDataset(): DemoDataset {
  return {
    companies: companyArraySchema.parse(companiesJson),
    jobs: jobArraySchema.parse(jobsJson),
    applications: applicationArraySchema.parse(applicationsJson),
    cv: cvLibrarySchema.parse(cvJson),
    matches: matchReportArraySchema.parse(matchesJson),
    interviews: interviewQuestionArraySchema.parse(interviewQuestionsJson),
    activity: activityEventArraySchema.parse(activityJson),
    profile: candidateProfileSchema.parse(profileJson),
  };
}

export function buildDemoMeta(now: string): WorkspaceMeta {
  return {
    schemaVersion: STORAGE_VERSION,
    workspaceMode: "demo",
    seededAt: now,
    lastModified: now,
    onboarded: true,
    aiNoticeAcknowledged: false,
  };
}

export function buildDefaultPreferences(): AppPreferences {
  return { ...DEFAULT_PREFERENCES };
}

/** The demo workspace, ready to be written to storage on first run. */
export function buildDemoWorkspace(
  now = new Date().toISOString(),
  options: { onboarded?: boolean } = {},
): WorkspaceSnapshot {
  const dataset = loadDemoDataset();
  const meta = buildDemoMeta(now);
  return {
    meta: {
      ...meta,
      // First-run seeding leaves onboarding open so the user can choose a
      // workspace mode; explicit resets mark it complete.
      onboarded: options.onboarded ?? false,
    },
    profile: dataset.profile,
    jobs: dataset.jobs,
    applications: dataset.applications,
    cv: dataset.cv,
    matches: dataset.matches,
    interviews: dataset.interviews,
    activity: dataset.activity,
    preferences: buildDefaultPreferences(),
  };
}

/**
 * An empty personal workspace. It keeps the demo's curated interview questions
 * out of the user's data and starts from a clean slate, but still ships a
 * default profile so the CV builder has somewhere to start.
 */
export function buildEmptyWorkspace(
  now = new Date().toISOString(),
): WorkspaceSnapshot {
  return {
    meta: {
      schemaVersion: STORAGE_VERSION,
      workspaceMode: "personal",
      seededAt: null,
      lastModified: now,
      onboarded: true,
      aiNoticeAcknowledged: false,
    },
    profile: {
      id: "profile-local",
      fullName: "",
      headline: null,
      email: null,
      phone: null,
      location: null,
      website: null,
      linkedin: null,
      github: null,
      summary: null,
      updatedAt: now,
    },
    jobs: [],
    applications: [],
    cv: { documents: [], activeId: null },
    matches: [],
    interviews: [],
    activity: [],
    preferences: buildDefaultPreferences(),
  };
}
