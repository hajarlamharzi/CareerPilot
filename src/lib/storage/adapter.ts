import { StorageError } from "./errors";

/**
 * Thin, defensive wrapper around `window.localStorage`.
 *
 * All other storage code goes through this adapter so availability, quota and
 * privacy-mode failures are handled in exactly one place.
 */
export interface StorageAdapter {
  readonly available: boolean;
  getRaw(key: string): string | null;
  setRaw(key: string, value: string): void;
  removeRaw(key: string): void;
  keys(): string[];
  subscribe(onExternalChange: (key: string | null) => void): () => void;
}

const PROBE_KEY = "careerpilot:__probe__";

function detectAvailability(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storage = window.localStorage;
    storage.setItem(PROBE_KEY, "1");
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

class BrowserStorageAdapter implements StorageAdapter {
  private readonly availableFlag: boolean;

  constructor() {
    this.availableFlag = detectAvailability();
  }

  get available(): boolean {
    return this.availableFlag;
  }

  getRaw(key: string): string | null {
    if (!this.availableFlag) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (cause) {
      throw new StorageError("read-failed", `Could not read "${key}".`, {
        cause,
      });
    }
  }

  setRaw(key: string, value: string): void {
    if (!this.availableFlag) {
      throw new StorageError(
        "unavailable",
        "Local storage is not available in this browser context.",
      );
    }
    try {
      window.localStorage.setItem(key, value);
    } catch (cause) {
      if (isQuotaError(cause)) {
        throw new StorageError("quota", "Local storage quota exceeded.", {
          cause,
        });
      }
      throw new StorageError("write-failed", `Could not write "${key}".`, {
        cause,
      });
    }
  }

  removeRaw(key: string): void {
    if (!this.availableFlag) return;
    try {
      window.localStorage.removeItem(key);
    } catch (cause) {
      throw new StorageError("write-failed", `Could not remove "${key}".`, {
        cause,
      });
    }
  }

  keys(): string[] {
    if (!this.availableFlag) return [];
    try {
      return Object.keys(window.localStorage);
    } catch {
      return [];
    }
  }

  subscribe(onExternalChange: (key: string | null) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (event: StorageEvent) => {
      onExternalChange(event.key);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }
}

/** A no-op adapter used during SSR and in tests where storage is unavailable. */
class NullStorageAdapter implements StorageAdapter {
  readonly available = false;
  getRaw(): string | null {
    return null;
  }
  setRaw(): void {
    throw new StorageError("unavailable", "Storage is unavailable.");
  }
  removeRaw(): void {}
  keys(): string[] {
    return [];
  }
  subscribe(): () => void {
    return () => {};
  }
}

export function createStorageAdapter(): StorageAdapter {
  if (typeof window === "undefined") return new NullStorageAdapter();
  return new BrowserStorageAdapter();
}
