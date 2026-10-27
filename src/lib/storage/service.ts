import { DEFAULT_PREFERENCES, STORAGE_NAMESPACE, STORAGE_VERSION } from "@/config/app";
import { buildDemoWorkspace, buildEmptyWorkspace, type WorkspaceSnapshot } from "@/data/demo";
import type { AppPreferences, WorkspaceMeta } from "@/types";
import { createStorageAdapter, type StorageAdapter } from "./adapter";
import { decodeEnvelope, encodeEnvelope, migrate } from "./envelope";
import { StorageError } from "./errors";
import {
  DOMAIN_KEYS,
  DOMAIN_SCHEMAS,
  KEY_TO_DOMAIN,
  STORE_DOMAINS,
  type StoreDomain,
  type StoreShape,
} from "./keys";

export interface StorageIssue {
  domain: StoreDomain;
  code: string;
  message: string;
  hint: string;
}

/** Byte footprint of one persisted domain. */
export interface DomainUsage {
  domain: StoreDomain;
  key: string;
  bytes: number;
}

/** A CareerPilot-namespaced key that is not one of the known domains. */
export interface OrphanUsage {
  key: string;
  bytes: number;
}

/**
 * What CareerPilot occupies in this browser. Only this app's own keys are
 * measured — the browser does not expose the quota or the size of other
 * origins, so no percentage of "total storage" is claimed.
 */
export interface StorageUsage {
  storageAvailable: boolean;
  items: DomainUsage[];
  orphans: OrphanUsage[];
  totalBytes: number;
}

type Listener = () => void;

/**
 * The single source of truth for all persisted workspace data.
 *
 * Responsibilities:
 *  - load and validate every domain from localStorage into an in-memory cache
 *  - seed the demo workspace on first run
 *  - keep React in sync via a `useSyncExternalStore` subscription model
 *  - mirror changes across browser tabs
 *  - surface (never swallow) storage failures
 *
 * No component reads `localStorage` directly; everything flows through here.
 */
export class WorkspaceStore {
  private readonly adapter: StorageAdapter;
  private cache = new Map<StoreDomain, unknown>();
  private listeners = new Map<StoreDomain, Set<Listener>>();
  private readyListeners = new Set<Listener>();
  private externalUnsubscribe: (() => void) | null = null;
  private issues: StorageIssue[] = [];
  private initialized = false;
  private readyFlag = false;

  constructor(adapter: StorageAdapter = createStorageAdapter()) {
    this.adapter = adapter;
  }

  get ready(): boolean {
    return this.readyFlag;
  }

  get available(): boolean {
    return this.adapter.available;
  }

  get currentIssues(): StorageIssue[] {
    return this.issues;
  }

  get meta(): WorkspaceMeta | null {
    return this.read<"meta">("meta");
  }

  /** Load everything and seed on first run. Safe to call multiple times. */
  init(): void {
    if (this.initialized) return;
    if (typeof window === "undefined") return;
    this.initialized = true;

    // Snapshot any writes made before init (e.g. hydration ordering).
    this.refreshAll();

    const meta = this.read<"meta">("meta");
    if (!meta) {
      // First run: seed the interactive demo workspace.
      if (this.adapter.available) {
        this.writeSnapshot(buildDemoWorkspace());
      } else {
        // Storage unavailable: keep the demo in memory only.
        const demo = buildDemoWorkspace();
        this.loadSnapshotIntoCache(demo);
      }
    }

    this.externalUnsubscribe = this.adapter.subscribe((key) => {
      if (key === null) {
        this.refreshAll();
        this.notifyAll();
        return;
      }
      const domain = KEY_TO_DOMAIN[key];
      if (!domain) return;
      this.reloadDomain(domain);
      this.notify(domain);
    });

    this.readyFlag = true;
    this.notifyReady();
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  read<D extends StoreDomain>(domain: D): StoreShape[D] | null {
    const value = this.cache.get(domain);
    return (value ?? null) as StoreShape[D] | null;
  }

  /** Stable snapshot accessor for `useSyncExternalStore`. */
  getSnapshot = <D extends StoreDomain>(domain: D): StoreShape[D] | null =>
    this.read(domain);

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  set<D extends StoreDomain>(domain: D, value: StoreShape[D]): void {
    if (domain === "meta") {
      const meta = value as WorkspaceMeta;
      this.commit("meta", { ...meta, lastModified: new Date().toISOString() });
      return;
    }
    this.commit(domain, value);
    this.touchMeta();
  }

  update<D extends StoreDomain>(
    domain: D,
    updater: (current: StoreShape[D]) => StoreShape[D],
  ): void {
    const current = this.read(domain);
    if (current === null) return;
    this.set(domain, updater(current));
  }

  /**
   * Replace every domain at once (seed, reset, import). Writes are attempted for
   * all domains; a failure on one does not corrupt the others.
   */
  writeSnapshot(snapshot: WorkspaceSnapshot): void {
    for (const domain of STORE_DOMAINS) {
      try {
        this.commit(domain, snapshot[domain] as never, { silent: true });
      } catch (error) {
        this.recordIssue(domain, error);
      }
    }
    this.notifyAll();
  }

  remove(domain: StoreDomain): void {
    try {
      this.adapter.removeRaw(DOMAIN_KEYS[domain]);
    } catch (error) {
      this.recordIssue(domain, error);
    }
    this.cache.delete(domain);
    this.notify(domain);
  }

  /** Remove every CareerPilot key from this browser. */
  clearAll(): void {
    for (const domain of STORE_DOMAINS) {
      this.adapter.removeRaw(DOMAIN_KEYS[domain]);
    }
    this.cache.clear();
    this.notifyAll();
  }

  resetToDemo(): void {
    this.writeSnapshot(
      buildDemoWorkspace(new Date().toISOString(), { onboarded: true }),
    );
  }

  resetToEmpty(): void {
    this.writeSnapshot(buildEmptyWorkspace());
  }

  /** Ensure preferences exist and are valid, returning the effective value. */
  getPreferences(): AppPreferences {
    return this.read("preferences") ?? { ...DEFAULT_PREFERENCES };
  }

  /**
   * Measure this browser's CareerPilot footprint, straight from the adapter so
   * the number reflects what is actually persisted rather than the in-memory
   * cache. Never throws: a failing read is reported as zero bytes.
   */
  measureUsage(): StorageUsage {
    const known = new Set<string>(Object.values(DOMAIN_KEYS));

    const items: DomainUsage[] = STORE_DOMAINS.map((domain) => {
      const key = DOMAIN_KEYS[domain];
      return { domain, key, bytes: utf8Bytes(this.readRawSafely(key)) };
    });

    const orphans: OrphanUsage[] = [];
    for (const key of this.adapter.keys()) {
      if (!key.startsWith(`${STORAGE_NAMESPACE}:`) || known.has(key)) continue;
      orphans.push({ key, bytes: utf8Bytes(this.readRawSafely(key)) });
    }
    orphans.sort((a, b) => b.bytes - a.bytes);

    return {
      storageAvailable: this.adapter.available,
      items,
      orphans,
      totalBytes:
        items.reduce((sum, item) => sum + item.bytes, 0) +
        orphans.reduce((sum, orphan) => sum + orphan.bytes, 0),
    };
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  subscribe<D extends StoreDomain>(domain: D, listener: Listener): () => void {
    let set = this.listeners.get(domain);
    if (!set) {
      set = new Set();
      this.listeners.set(domain, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  subscribeReady = (listener: Listener): (() => void) => {
    this.readyListeners.add(listener);
    return () => {
      this.readyListeners.delete(listener);
    };
  };

  getReadySnapshot = (): boolean => this.readyFlag;

  getServerReadySnapshot = (): boolean => false;

  dispose(): void {
    this.externalUnsubscribe?.();
    this.externalUnsubscribe = null;
    this.listeners.clear();
    this.readyListeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private commit<D extends StoreDomain>(
    domain: D,
    value: StoreShape[D],
    options: { silent?: boolean } = {},
  ): void {
    if (this.adapter.available) {
      try {
        this.adapter.setRaw(DOMAIN_KEYS[domain], encodeEnvelope(value));
      } catch (error) {
        this.recordIssue(domain, error);
        throw error;
      }
    }
    this.cache.set(domain, value);
    if (!options.silent) this.notify(domain);
  }

  private touchMeta(): void {
    const meta = this.meta;
    if (!meta) return;
    this.commit("meta", { ...meta, lastModified: new Date().toISOString() });
  }

  private refreshAll(): void {
    for (const domain of STORE_DOMAINS) {
      this.reloadDomain(domain);
    }
  }

  private reloadDomain(domain: StoreDomain): "ok" | "empty" | "error" | "migrated" {
    if (!this.adapter.available) {
      this.cache.delete(domain);
      return "empty";
    }

    try {
      const raw = this.adapter.getRaw(DOMAIN_KEYS[domain]);
      if (raw === null) {
        this.cache.delete(domain);
        return "empty";
      }

      const decoded = decodeEnvelope(raw);
      if (decoded.v > STORAGE_VERSION) {
        throw new StorageError(
          "corrupt",
          `Stored "${domain}" data was written by a newer version of CareerPilot.`,
        );
      }
      const migrated = migrate(decoded.data, decoded.v);
      const parsed = DOMAIN_SCHEMAS[domain].safeParse(migrated);
      if (!parsed.success) {
        throw new StorageError(
          "corrupt",
          `Stored "${domain}" data failed validation.`,
          { cause: parsed.error },
        );
      }
      this.cache.set(domain, parsed.data);
      return decoded.v < STORAGE_VERSION ? "migrated" : "ok";
    } catch (error) {
      this.recordIssue(domain, error);
      return "error";
    }
  }

  private loadSnapshotIntoCache(snapshot: WorkspaceSnapshot): void {
    for (const domain of STORE_DOMAINS) {
      this.cache.set(domain, snapshot[domain]);
    }
    this.notifyAll();
  }

  private readRawSafely(key: string): string | null {
    try {
      return this.adapter.getRaw(key);
    } catch {
      return null;
    }
  }

  private recordIssue(domain: StoreDomain, error: unknown): void {
    const storageError =
      error instanceof StorageError
        ? error
        : new StorageError("read-failed", describe(error), { cause: error });
    this.issues = [
      ...this.issues.filter((issue) => issue.domain !== domain),
      {
        domain,
        code: storageError.code,
        message: storageError.message,
        hint: storageError.hint,
      },
    ];
  }

  private notify(domain: StoreDomain): void {
    this.listeners.get(domain)?.forEach((listener) => listener());
  }

  private notifyAll(): void {
    for (const domain of STORE_DOMAINS) this.notify(domain);
  }

  private notifyReady(): void {
    this.readyListeners.forEach((listener) => listener());
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown storage error.";
}

/** UTF-8 byte length, which is what a browser quota actually consumes. */
function utf8Bytes(value: string | null): number {
  if (value === null) return 0;
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

/** Application-wide singleton. */
export const workspaceStore = new WorkspaceStore();
