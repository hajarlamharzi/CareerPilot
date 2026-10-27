import { STORAGE_VERSION } from "@/config/app";
import type { WorkspaceSnapshot } from "@/data/demo";
import { createId } from "@/lib/id";
import { workspaceStore } from "@/lib/storage";
import {
  TRANSFER_APP_ID,
  transferBundleSchema,
  type TransferBundle,
} from "@/schemas/transfer";

import { logActivity } from "@/features/activity/logger";

/**
 * Build a portable bundle of the user's data. Safe to hand to a user: it contains
 * no API keys (those are never written to the exported domains) and no storage
 * internals.
 */
export function buildTransferBundle(
  now = new Date().toISOString(),
): TransferBundle {
  const empty = {
    profile: workspaceStore.read("profile"),
    jobs: workspaceStore.read("jobs"),
    applications: workspaceStore.read("applications"),
    cv: workspaceStore.read("cv"),
    matches: workspaceStore.read("matches"),
    interviews: workspaceStore.read("interviews"),
    activity: workspaceStore.read("activity"),
    preferences: workspaceStore.read("preferences"),
  };

  return {
    app: TRANSFER_APP_ID,
    version: STORAGE_VERSION,
    exportedAt: now,
    data: {
      profile: empty.profile ?? {
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
      jobs: empty.jobs ?? [],
      applications: empty.applications ?? [],
      cv: empty.cv ?? { documents: [], activeId: null },
      matches: empty.matches ?? [],
      interviews: empty.interviews ?? [],
      activity: empty.activity ?? [],
      preferences: empty.preferences ?? {
        theme: "system",
        locale: "en",
        aiProvider: null,
        aiModel: "",
        storeApiKey: false,
        confirmBeforeAiSend: true,
      },
    },
  };
}

export function serializeTransferBundle(bundle: TransferBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** Parse and validate a bundle. Throws if it is not a CareerPilot export. */
export function parseTransferBundle(raw: string): TransferBundle {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const result = transferBundleSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      "That file is not a valid CareerPilot export, or it was made with an incompatible version.",
    );
  }
  if (result.data.version > STORAGE_VERSION) {
    throw new Error(
      "That export was created by a newer version of CareerPilot. Update the app before importing.",
    );
  }
  return result.data;
}

/**
 * Replace the workspace with an imported bundle. The imported data is treated as
 * the user's own (mode `personal`) and the previous activity feed is preserved
 * by appending an import event.
 */
export function importTransferBundle(bundle: TransferBundle): void {
  const now = new Date().toISOString();
  const snapshot: WorkspaceSnapshot = {
    meta: {
      schemaVersion: STORAGE_VERSION,
      workspaceMode: "personal",
      seededAt: null,
      lastModified: now,
      onboarded: true,
      aiNoticeAcknowledged: workspaceStore.meta?.aiNoticeAcknowledged ?? false,
    },
    profile: bundle.data.profile,
    jobs: bundle.data.jobs,
    applications: bundle.data.applications,
    cv: bundle.data.cv,
    matches: bundle.data.matches,
    interviews: bundle.data.interviews,
    activity: bundle.data.activity,
    preferences: bundle.data.preferences,
  };

  workspaceStore.writeSnapshot(snapshot);
  logActivity({
    type: "data-imported",
    message: `Imported a workspace backup (${bundle.data.jobs.length} jobs, ${bundle.data.applications.length} applications).`,
    entityId: createId("import"),
  });
}

/** Trigger a browser download of the exported bundle. */
export function downloadTransferBundle(bundle: TransferBundle): void {
  const blob = new Blob([serializeTransferBundle(bundle)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `careerpilot-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
