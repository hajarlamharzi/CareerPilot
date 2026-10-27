import { logActivity } from "@/features/activity/logger";
import { createId } from "@/lib/id";
import { workspaceStore } from "@/lib/storage";
import type { Job } from "@/types";

export type NewJob = Omit<Job, "id">;

export function createJob(input: NewJob): Job {
  const job: Job = { ...input, id: createId("job") };
  const jobs = workspaceStore.read("jobs") ?? [];
  workspaceStore.set("jobs", [job, ...jobs]);
  logActivity({
    type: "job-added",
    message: `Added ${job.title} at ${job.company}.`,
    entityId: job.id,
  });
  return job;
}

export function updateJob(id: string, input: NewJob): Job | null {
  const jobs = workspaceStore.read("jobs") ?? [];
  const index = jobs.findIndex((job) => job.id === id);
  if (index === -1) return null;
  const job: Job = { ...input, id };
  const next = [...jobs];
  next[index] = job;
  workspaceStore.set("jobs", next);
  logActivity({
    type: "job-updated",
    message: `Updated ${job.title} at ${job.company}.`,
    entityId: job.id,
  });
  return job;
}

export function deleteJob(id: string): Job | null {
  const jobs = workspaceStore.read("jobs") ?? [];
  const removed = jobs.find((job) => job.id === id) ?? null;
  if (removed) {
    workspaceStore.set(
      "jobs",
      jobs.filter((job) => job.id !== id),
    );
    logActivity({
      type: "job-deleted",
      message: `Removed ${removed.title} at ${removed.company}.`,
      entityId: id,
    });
  }
  return removed;
}

export function getJob(id: string): Job | null {
  const jobs = workspaceStore.read("jobs") ?? [];
  return jobs.find((job) => job.id === id) ?? null;
}