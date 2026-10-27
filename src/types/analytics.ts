import type { ApplicationStatus } from "./application";
import type { InterviewCategory, InterviewDifficulty } from "./interview";

export type ThemePreference = "light" | "dark" | "system";
export type Locale = "en" | "fr";
export type AiProviderId = "gemini" | "openrouter";

export interface AppPreferences {
  theme: ThemePreference;
  locale: Locale;
  aiProvider: AiProviderId | null;
  aiModel: string;
  /** Whether the user opted in to persisting the API key in localStorage. */
  storeApiKey: boolean;
  /** Ask for confirmation before the first AI transmission of personal data. */
  confirmBeforeAiSend: boolean;
}

export interface WorkspaceMeta {
  /** Schema version for migration handling. */
  schemaVersion: number;
  /** "demo" until the user resets to an empty personal workspace. */
  workspaceMode: "demo" | "personal";
  seededAt: string | null;
  lastModified: string | null;
  /** The user has completed onboarding / chosen a workspace mode. */
  onboarded: boolean;
  /** The user has acknowledged the AI data-sharing notice. */
  aiNoticeAcknowledged: boolean;
}

export interface StatusCount {
  status: ApplicationStatus;
  count: number;
}

export interface TimeSeriesPoint {
  /** ISO date (day or month bucket start). */
  date: string;
  label: string;
  value: number;
}

export interface AnalyticsSummary {
  totalJobs: number;
  analyzedJobs: number;
  totalApplications: number;
  activeApplications: number;
  interviews: number;
  offers: number;
  rejected: number;
  /** offers / applications, as a percentage. Denominator documented in UI. */
  offerRate: number;
  /** applications that received any employer response / applications. */
  responseRate: number;
  averageMatchScore: number | null;
  applicationsByStatus: StatusCount[];
  applicationsOverTime: TimeSeriesPoint[];
  topRequestedSkills: { skill: string; count: number }[];
  topMissingSkills: { skill: string; count: number }[];
  matchScoreDistribution: { bucket: string; count: number }[];
}

/** One step in the applications funnel, counted by furthest stage reached. */
export interface FunnelStep {
  stage: ApplicationStatus;
  label: string;
  /** Applications that reached this stage or any later stage. */
  reached: number;
  /** reached / first step reached × 100. */
  percentage: number;
  /** Applications lost between the previous step and this one. */
  lost: number;
  /** lost / previous step reached × 100. */
  dropOff: number;
}

export interface FunnelInsight {
  steps: FunnelStep[];
  /** Applications that have not been submitted yet (interested / saved). */
  notApplied: number;
  /** Applications that were submitted and then rejected or withdrawn. */
  closed: number;
  /** offers / applied × 100, or 0 when nothing has been applied to. */
  appliedToOfferRate: number;
}

export interface ApplicationVelocity {
  /** Applications with a usable `appliedAt` date and a recorded response. */
  sampleSize: number;
  /** Average days from `appliedAt` to the first recorded employer response. */
  meanDaysToResponse: number | null;
  /** Median of the same measurements — resistant to one very slow employer. */
  medianDaysToResponse: number | null;
  /** Fastest and slowest observed response times. */
  fastestResponseDays: number | null;
  slowestResponseDays: number | null;
  /** Average days from `appliedAt` to the first recorded offer. */
  meanDaysToOffer: number | null;
  /** Submitted applications that have never moved past "applied". */
  awaitingResponse: number;
}

export interface InterviewPrepStats {
  total: number;
  practiced: number;
  answered: number;
  /** practiced / total × 100. */
  practicedRate: number;
  byCategory: {
    category: InterviewCategory;
    label: string;
    total: number;
    practiced: number;
    answered: number;
  }[];
  byDifficulty: {
    difficulty: InterviewDifficulty;
    label: string;
    total: number;
    practiced: number;
  }[];
}
