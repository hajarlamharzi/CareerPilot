import { beforeEach, describe, expect, it, vi } from "vitest";

// Swap the singleton store for one backed by an in-memory adapter so the store
// functions (which read the singleton) can be exercised in isolation.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  const { MemoryStorageAdapter } = await import("@/test/memory-adapter");
  const workspaceStore = new actual.WorkspaceStore(new MemoryStorageAdapter());
  workspaceStore.init();
  return { ...actual, workspaceStore };
});

import { workspaceStore } from "@/lib/storage";

import { setApplicationStatus } from "./application-store";

describe("setApplicationStatus", () => {
  beforeEach(() => {
    workspaceStore.resetToDemo();
  });

  it("publishes a new applications array so subscribers re-render", () => {
    const before = workspaceStore.read("applications")!;
    const target = before.find((app) => app.status !== "saved") ?? before[0];

    setApplicationStatus(target.id, "saved");

    const after = workspaceStore.read("applications")!;
    // useSyncExternalStore only re-renders when the snapshot identity changes,
    // so the write must swap in a fresh array rather than mutate the cache.
    expect(after).not.toBe(before);
    expect(after.find((app) => app.id === target.id)?.status).toBe("saved");
  });

  it("does not mutate the previously returned array in place", () => {
    const before = workspaceStore.read("applications")!;
    const target = before.find((app) => app.status !== "saved") ?? before[0];
    const originalStatus = target.status;

    setApplicationStatus(target.id, "saved");

    expect(target.status).toBe(originalStatus);
  });
});
