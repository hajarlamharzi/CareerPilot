import { createId } from "@/lib/id";
import { workspaceStore } from "@/lib/storage";
import type { ActivityEvent, ActivityType, Origin } from "@/types";

/**
 * Append an event to the workspace activity feed.
 *
 * Activity logging is best-effort: if storage is unavailable we do not want a
 * failed audit line to break the user's action, so failures are swallowed here
 * and surfaced through the store's issue list instead.
 */
export function logActivity(input: {
  type: ActivityType;
  message: string;
  entityId?: string | null;
  origin?: Origin;
}): ActivityEvent | null {
  const event: ActivityEvent = {
    id: createId("act"),
    at: new Date().toISOString(),
    type: input.type,
    message: input.message,
    entityId: input.entityId ?? null,
    origin: input.origin ?? "user",
  };

  try {
    const current = workspaceStore.read("activity") ?? [];
    // Cap the feed so localStorage cannot grow without bound.
    const next = [event, ...current].slice(0, 500);
    workspaceStore.set("activity", next);
    return event;
  } catch {
    return null;
  }
}

/** Read the activity feed, newest first. */
export function readActivity(): ActivityEvent[] {
  return workspaceStore.read("activity") ?? [];
}
