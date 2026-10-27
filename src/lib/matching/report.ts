import { logActivity } from "@/features/activity/logger";
import { createId } from "@/lib/id";
import { workspaceStore } from "@/lib/storage";
import type { Job, MatchReport } from "@/types";

import type { ComputeMatchResult } from "./engine";

/** Persist a computed match report and log the activity. */
export function saveMatchReport(
  result: ComputeMatchResult,
): MatchReport {
  const report: MatchReport = {
    ...result,
    id: createId("match"),
    createdAt: new Date().toISOString(),
  };

  const current = workspaceStore.read("matches") ?? [];
  workspaceStore.set("matches", [report, ...current]);

  logActivity({
    type: "match-run",
    message: `Ran a ${report.mode} match scored at ${report.score}%.`,
    entityId: report.id,
  });

  return report;
}

/** Latest report per job, newest first. */
export function latestMatchPerJob(matches: MatchReport[]): MatchReport[] {
  const byJob = new Map<string, MatchReport>();
  for (const match of matches) {
    const existing = byJob.get(match.jobId);
    if (!existing || match.createdAt > existing.createdAt) {
      byJob.set(match.jobId, match);
    }
  }
  return [...byJob.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/** Resolve a report against its job for display. */
export function resolveMatchJob(
  report: MatchReport,
  jobs: Job[],
): Job | null {
  return jobs.find((job) => job.id === report.jobId) ?? null;
}