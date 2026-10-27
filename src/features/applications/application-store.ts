import { logActivity } from "@/features/activity/logger";
import { createId } from "@/lib/id";
import { workspaceStore } from "@/lib/storage";
import type {
  Application,
  ApplicationDraft,
  ApplicationNote,
  ApplicationStatus,
  StatusHistoryEntry,
} from "@/types";

function read(): Application[] {
  return workspaceStore.read("applications") ?? [];
}

/** Create an application and append the initial status-history entry. */
export function createApplication(draft: ApplicationDraft): Application {
  const now = new Date().toISOString();
  const history: StatusHistoryEntry = {
    id: createId("hist"),
    from: null,
    to: draft.status,
    at: now,
    note: null,
  };
  const app: Application = {
    ...draft,
    notes: draft.notes ?? [],
    id: createId("app"),
    history: [history],
    origin: "user",
    createdAt: now,
    updatedAt: now,
  };

  workspaceStore.set("applications", [...read(), app]);
  logActivity({
    type: "application-added",
    message: `Added an application for ${app.position} at ${app.company}.`,
    entityId: app.id,
  });
  return app;
}

export function updateApplication(
  id: string,
  patch: Partial<Application>,
): Application | null {
  // Copy before mutating: `read()` returns the cached array by reference, and
  // `useSyncExternalStore` only re-renders when the snapshot identity changes.
  const list = [...read()];
  const index = list.findIndex((app) => app.id === id);
  if (index === -1) return null;
  const previous = list[index];
  const updated = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  list[index] = updated;
  workspaceStore.set("applications", list);

  if (patch.status && patch.status !== previous.status) {
    logActivity({
      type: "application-status",
      message: `Moved ${updated.position} at ${updated.company} from ${previous.status} to ${patch.status}.`,
      entityId: id,
    });
  } else {
    logActivity({
      type: "application-note",
      message: `Updated details for ${updated.position} at ${updated.company}.`,
      entityId: id,
    });
  }
  return updated;
}

/**
 * Move an application to another stage, recording the transition in its
 * status timeline.
 */
export function setApplicationStatus(
  id: string,
  to: ApplicationStatus,
  note: string | null = null,
): Application | null {
  const list = [...read()];
  const index = list.findIndex((app) => app.id === id);
  if (index === -1) return null;
  const previous = list[index];
  if (previous.status === to) return previous;

  const history: StatusHistoryEntry = {
    id: createId("hist"),
    from: previous.status,
    to,
    at: new Date().toISOString(),
    note,
  };
  const updated: Application = {
    ...previous,
    status: to,
    history: [history, ...previous.history],
    updatedAt: new Date().toISOString(),
  };
  list[index] = updated;
  workspaceStore.set("applications", list);
  logActivity({
    type: "application-status",
    message: `Moved ${previous.position} at ${previous.company} from ${previous.status} to ${to}.`,
    entityId: id,
  });
  return updated;
}

/** Prepend a note to an application's note thread. */
export function addApplicationNote(id: string, body: string): Application | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const list = [...read()];
  const index = list.findIndex((app) => app.id === id);
  if (index === -1) return null;

  const note: ApplicationNote = {
    id: createId("note"),
    at: new Date().toISOString(),
    body: trimmed,
  };
  const updated: Application = {
    ...list[index],
    notes: [note, ...list[index].notes],
    updatedAt: new Date().toISOString(),
  };
  list[index] = updated;
  workspaceStore.set("applications", list);
  logActivity({
    type: "application-note",
    message: `Added a note to the ${updated.position} application.`,
    entityId: id,
  });
  return updated;
}

export function deleteApplication(id: string): void {
  const list = read();
  const target = list.find((app) => app.id === id);
  workspaceStore.set(
    "applications",
    list.filter((app) => app.id !== id),
  );
  if (target) {
    logActivity({
      type: "application-note",
      message: `Deleted the ${target.position} application at ${target.company}.`,
      entityId: null,
    });
  }
}