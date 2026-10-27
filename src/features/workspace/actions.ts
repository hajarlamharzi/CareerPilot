import { logActivity } from "@/features/activity/logger";
import { cvFileStore, workspaceStore } from "@/lib/storage";
import {
  buildTransferBundle,
  downloadTransferBundle,
} from "@/features/workspace/transfer";

/** Mark onboarding complete without touching the seeded data. */
export function completeOnboarding(): void {
  const meta = workspaceStore.meta;
  if (!meta) return;
  workspaceStore.set("meta", { ...meta, onboarded: true });
}

/** First-run choice: wipe the demo and begin with an empty personal workspace. */
export function startEmptyWorkspace(): void {
  workspaceStore.resetToEmpty();
  logActivity({
    type: "workspace-reset",
    message: "Started a fresh, empty personal workspace.",
  });
}

/** Settings action: restore the demo dataset. */
export function resetToDemoWorkspace(): void {
  workspaceStore.resetToDemo();
  logActivity({
    type: "workspace-reset",
    message: "Reset the workspace to the demo dataset.",
  });
}

/** Settings action: clear everything and start empty. */
export function resetToEmptyWorkspace(): void {
  workspaceStore.resetToEmpty();
  logActivity({
    type: "workspace-reset",
    message: "Reset to an empty personal workspace.",
  });
}

/**
 * Settings action: start empty *and* drop everything else this app left in the
 * browser — leftover keys and the uploaded CV files held in IndexedDB. Used when
 * the user wants their data gone rather than merely replaced.
 */
export async function eraseToEmptyWorkspace(): Promise<void> {
  workspaceStore.clearAll();
  workspaceStore.resetToEmpty();
  if (cvFileStore.available()) {
    try {
      await cvFileStore.clear();
    } catch {
      // The workspace reset already succeeded; a locked IndexedDB should not
      // present the whole action as failed.
    }
  }
  logActivity({
    type: "workspace-reset",
    message: "Erased all workspace data and started empty.",
  });
}

/** Settings action: download a portable backup of everything stored locally. */
export function exportWorkspaceBackup(): { jobs: number; applications: number } {
  const bundle = buildTransferBundle();
  downloadTransferBundle(bundle);
  const summary = {
    jobs: bundle.data.jobs.length,
    applications: bundle.data.applications.length,
  };
  logActivity({
    type: "data-exported",
    message: `Exported a workspace backup (${summary.jobs} jobs, ${summary.applications} applications).`,
  });
  return summary;
}
