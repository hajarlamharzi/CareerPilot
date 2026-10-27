import type { StorageAdapter } from "@/lib/storage/adapter";
import { StorageError } from "@/lib/storage/errors";

/**
 * In-memory `StorageAdapter` for tests. Lets us simulate first-run seeding,
 * corrupt data and quota failures without touching a real browser store.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly available: boolean;
  private data = new Map<string, string>();
  private listeners = new Set<(key: string | null) => void>();
  /** When set, the next `setRaw` throws this error. */
  failNextWrite: StorageError | null = null;

  constructor(available = true) {
    this.available = available;
  }

  getRaw(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setRaw(key: string, value: string): void {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
    this.data.set(key, value);
  }

  removeRaw(key: string): void {
    this.data.delete(key);
  }

  keys(): string[] {
    return [...this.data.keys()];
  }

  subscribe(onExternalChange: (key: string | null) => void): () => void {
    this.listeners.add(onExternalChange);
    return () => this.listeners.delete(onExternalChange);
  }

  /** Simulate a write from another tab. */
  emitExternal(key: string | null, value: string | null): void {
    if (value === null) {
      this.data.delete(key ?? "");
    } else if (key !== null) {
      this.data.set(key, value);
    }
    this.listeners.forEach((listener) => listener(key));
  }

  /** Seed a raw value directly, bypassing the envelope. */
  seedRaw(key: string, raw: string): void {
    this.data.set(key, raw);
  }
}
