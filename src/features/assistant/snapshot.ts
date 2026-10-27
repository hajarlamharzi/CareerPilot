"use client";

import { workspaceStore } from "@/lib/storage";

import type { WorkspaceSnapshotPayload } from "./types";

/**
 * Assemble the local workspace into the payload the assistant accepts.
 *
 * Only the local demo path needs this: a signed-in caller's data is read
 * server-side through their RLS-bound client, and a browser-supplied snapshot is
 * ignored. The result is therefore best-effort — if storage is unavailable the
 * turn still goes through, just without the user's own data for context.
 *
 * `saved_jobs` has no local table; the "saved" and "shortlisted" job statuses
 * are its closest equivalent.
 */
export function buildWorkspaceSnapshot(): WorkspaceSnapshotPayload | null {
  try {
    const profile = workspaceStore.read("profile");
    const library = workspaceStore.read("cv");
    const jobs = workspaceStore.read("jobs") ?? [];
    const applications = workspaceStore.read("applications") ?? [];

    const activeCv =
      library?.documents.find((document) => document.id === library.activeId) ?? null;

    const skills = activeCv
      ? Array.from(
          new Set(
            activeCv.sections.skillGroups.flatMap((group) => group.skills),
          ),
        )
      : [];

    return {
      profile: {
        fullName: profile?.fullName ?? "",
        headline: profile?.headline ?? null,
        location: profile?.location ?? null,
        summary: profile?.summary ?? null,
      },
      skills,
      // Every preference field has a server-side default; an empty object means
      // "no explicit job-search preferences", which is the honest answer.
      preferences: {},
      jobs,
      applications,
      savedJobIds: jobs
        .filter((job) => job.status === "saved" || job.status === "shortlisted")
        .map((job) => job.id),
      cv: activeCv,
    };
  } catch {
    return null;
  }
}
