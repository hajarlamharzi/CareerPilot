import {
  APPLICATION_STATUSES,
  RESPONSE_APPLICATION_STATUSES,
} from "@/config/constants";
import { monthLabel, monthKey } from "@/lib/format";
import { latestMatchPerJob } from "@/lib/matching/report";
import type {
  AnalyticsSummary,
  Application,
  ApplicationStatus,
  CvLibrary,
  InterviewQuestion,
  Job,
  MatchReport,
  StatusCount,
  TimeSeriesPoint,
} from "@/types";

export interface AnalyticsInput {
  jobs: Job[];
  applications: Application[];
  matches: MatchReport[];
  interviews: InterviewQuestion[];
  cv: CvLibrary | null;
  now?: Date;
}

/** Statuses where the candidate is actively in the pipeline. */
const ACTIVE_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "applied",
  "screening",
  "interview",
  "assessment",
];

const MATCH_BUCKETS = [
  { bucket: "0–24", min: 0, max: 24 },
  { bucket: "25–49", min: 25, max: 49 },
  { bucket: "50–74", min: 50, max: 74 },
  { bucket: "75–100", min: 75, max: 100 },
] as const;

function round(value: number): number {
  return Math.round(value);
}

/**
 * Deterministic, dependency-free analytics derivation. All numbers come from
 * the workspace domains passed in; nothing is network-dependent.
 */
export function computeAnalyticsSummary(input: AnalyticsInput): AnalyticsSummary {
  const now = input.now ?? new Date();
  const { jobs, applications, matches } = input;

  const totalApplications = applications.length;
  const activeApplications = applications.filter((app) =>
    ACTIVE_APPLICATION_STATUSES.includes(app.status),
  ).length;
  const interviews = applications.filter(
    (app) => app.status === "interview",
  ).length;
  const offers = applications.filter((app) => app.status === "offer").length;
  const rejected = applications.filter(
    (app) => app.status === "rejected",
  ).length;
  const responded = applications.filter((app) =>
    RESPONSE_APPLICATION_STATUSES.includes(app.status),
  ).length;

  const latestReports = latestMatchPerJob(matches);
  const averageMatchScore =
    latestReports.length > 0
      ? round(
          latestReports.reduce((sum, report) => sum + report.score, 0) /
            latestReports.length,
        )
      : null;

  const applicationsByStatus: StatusCount[] = APPLICATION_STATUSES.map(
    (status) => ({
      status,
      count: applications.filter((app) => app.status === status).length,
    }),
  );

  // ---- Applications over the last 8 months -------------------------------
  const counts = new Map<string, number>();
  for (const app of applications) {
    const key = monthKey(app.appliedAt ?? app.createdAt);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const applicationsOverTime: TimeSeriesPoint[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    applicationsOverTime.push({
      date: key,
      label: monthLabel(key),
      value: counts.get(key) ?? 0,
    });
  }

  // ---- Skills --------------------------------------------------------------
  const requestedSkillCounts = new Map<string, number>();
  for (const job of jobs) {
    for (const skill of [...job.requiredSkills, ...job.preferredSkills]) {
      const key = skill.trim().toLowerCase();
      if (key) requestedSkillCounts.set(key, (requestedSkillCounts.get(key) ?? 0) + 1);
    }
  }

  const missingSkillCounts = new Map<string, number>();
  for (const report of latestReports) {
    for (const skill of [
      ...report.missingRequiredSkills,
      ...report.missingPreferredSkills,
    ]) {
      const key = skill.trim().toLowerCase();
      if (key) missingSkillCounts.set(key, (missingSkillCounts.get(key) ?? 0) + 1);
    }
  }

  const topRequestedSkills = [...requestedSkillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill, count]) => ({ skill, count }));

  const topMissingSkills = [...missingSkillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill, count]) => ({ skill, count }));

  const matchScoreDistribution = MATCH_BUCKETS.map((bucket) => ({
    bucket: bucket.bucket,
    count: latestReports.filter(
      (report) =>
        report.score >= bucket.min && report.score <= bucket.max,
    ).length,
  }));

  const analyzedJobs = new Set(latestReports.map((report) => report.jobId)).size;

  return {
    totalJobs: jobs.length,
    analyzedJobs,
    totalApplications,
    activeApplications,
    interviews,
    offers,
    rejected,
    offerRate: totalApplications > 0 ? round((offers / totalApplications) * 100) : 0,
    responseRate:
      totalApplications > 0 ? round((responded / totalApplications) * 100) : 0,
    averageMatchScore,
    applicationsByStatus,
    applicationsOverTime,
    topRequestedSkills,
    topMissingSkills,
    matchScoreDistribution,
  };
}