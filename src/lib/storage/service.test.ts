import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOMAIN_KEYS } from "./keys";
import { encodeEnvelope } from "./envelope";
import { StorageError } from "./errors";
import { WorkspaceStore } from "./service";
import { MemoryStorageAdapter } from "@/test/memory-adapter";

/** Mark the adapter as an already-initialised workspace so init() will not seed. */
function seedExistingWorkspace(adapter: MemoryStorageAdapter): void {
  adapter.seedRaw(
    DOMAIN_KEYS.meta,
    encodeEnvelope({
      schemaVersion: 1,
      workspaceMode: "personal",
      seededAt: null,
      lastModified: null,
      onboarded: true,
      aiNoticeAcknowledged: false,
    }),
  );
}

describe("WorkspaceStore", () => {
  let adapter: MemoryStorageAdapter;
  let store: WorkspaceStore;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
    store = new WorkspaceStore(adapter);
  });

  it("seeds the demo workspace on first run", () => {
    store.init();
    expect(store.ready).toBe(true);
    expect(store.meta?.workspaceMode).toBe("demo");
    expect(store.read("jobs")?.length).toBeGreaterThanOrEqual(20);
    expect(store.read("applications")?.length).toBeGreaterThanOrEqual(8);
  });

  it("persists writes through the versioned envelope", () => {
    store.init();
    const jobs = store.read("jobs") ?? [];
    store.set("jobs", jobs.slice(0, 3));

    const raw = adapter.getRaw(DOMAIN_KEYS.jobs);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).v).toBe(1);
    expect(store.read("jobs")).toHaveLength(3);
  });

  it("loads existing data instead of re-seeding", () => {
    adapter.seedRaw(
      DOMAIN_KEYS.meta,
      encodeEnvelope({
        schemaVersion: 1,
        workspaceMode: "personal",
        seededAt: null,
        lastModified: null,
        onboarded: true,
        aiNoticeAcknowledged: false,
      }),
    );
    adapter.seedRaw(DOMAIN_KEYS.jobs, encodeEnvelope([]));

    store.init();
    expect(store.meta?.workspaceMode).toBe("personal");
    expect(store.read("jobs")).toEqual([]);
  });

  it("quarantines corrupt data and records an issue", () => {
    seedExistingWorkspace(adapter);
    adapter.seedRaw(DOMAIN_KEYS.jobs, "{ this is not valid json");
    store.init();

    expect(store.read("jobs")).toBeNull();
    const issue = store.currentIssues.find((i) => i.domain === "jobs");
    expect(issue?.code).toBe("corrupt");
  });

  it("rejects data written by an incompatible newer version", () => {
    seedExistingWorkspace(adapter);
    adapter.seedRaw(DOMAIN_KEYS.jobs, JSON.stringify({ v: 99, data: [] }));
    store.init();
    expect(store.read("jobs")).toBeNull();
    expect(store.currentIssues.some((i) => i.domain === "jobs")).toBe(true);
  });

  it("surfaces quota failures without losing the previous value", () => {
    store.init();
    const original = store.read("jobs");
    adapter.failNextWrite = new StorageError("quota", "quota exceeded");

    expect(() => store.set("jobs", [])).toThrowError(StorageError);
    expect(store.currentIssues.some((i) => i.code === "quota")).toBe(true);
    // In-memory cache is unchanged because the write failed before commit.
    expect(store.read("jobs")).toBe(original);
  });

  it("notifies subscribers when a domain changes", () => {
    store.init();
    const listener = vi.fn();
    const unsubscribe = store.subscribe("jobs", listener);
    store.set("jobs", []);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set("jobs", []);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reacts to cross-tab storage events", () => {
    store.init();
    adapter.emitExternal(DOMAIN_KEYS.jobs, encodeEnvelope([]));
    expect(store.read("jobs")).toEqual([]);
    adapter.emitExternal(DOMAIN_KEYS.jobs, null);
    expect(store.read("jobs")).toBeNull();
  });

  it("resets to demo and to an empty personal workspace", () => {
    store.init();
    store.set("jobs", []);
    store.resetToDemo();
    expect(store.read("jobs")?.length).toBeGreaterThanOrEqual(20);

    store.resetToEmpty();
    expect(store.meta?.workspaceMode).toBe("personal");
    expect(store.read("jobs")).toEqual([]);
  });

  it("works in memory when storage is unavailable", () => {
    const unavailable = new MemoryStorageAdapter(false);
    const memoryStore = new WorkspaceStore(unavailable);
    memoryStore.init();
    expect(memoryStore.available).toBe(false);
    expect(memoryStore.read("jobs")?.length).toBeGreaterThanOrEqual(20);
    expect(unavailable.keys()).toHaveLength(0);
  });
});
