import { workspaceStore } from "@/lib/storage";
import type { AppPreferences } from "@/types";

/**
 * Preferences are a storage domain like any other, but every feature reads them,
 * so they get a tiny typed accessor instead of touching the store directly.
 */

export function readPreferences(): AppPreferences {
  return workspaceStore.getPreferences();
}

/** Merge a partial update into the stored preferences and return the result. */
export function updatePreferences(
  patch: Partial<AppPreferences>,
): AppPreferences {
  const next: AppPreferences = { ...readPreferences(), ...patch };
  workspaceStore.set("preferences", next);
  return next;
}

/**
 * Record whether the user has read the AI data-sharing notice. Kept on `meta`
 * rather than `preferences` because it is a one-time acknowledgement.
 */
export function setAiNoticeAcknowledged(acknowledged: boolean): void {
  const meta = workspaceStore.meta;
  if (!meta || meta.aiNoticeAcknowledged === acknowledged) return;
  workspaceStore.set("meta", { ...meta, aiNoticeAcknowledged: acknowledged });
}

/** Convenience wrapper for the common "user just accepted" case. */
export function acknowledgeAiNotice(): void {
  setAiNoticeAcknowledged(true);
}
