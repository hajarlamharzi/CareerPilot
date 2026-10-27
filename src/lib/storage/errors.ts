/**
 * Typed storage errors. The UI maps these to honest, actionable messages rather
 * than silently swallowing failures.
 */

export type StorageErrorCode =
  | "unavailable"
  | "quota"
  | "corrupt"
  | "write-failed"
  | "read-failed";

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
    this.code = code;
  }

  /** A short, user-facing remediation hint. */
  get hint(): string {
    switch (this.code) {
      case "unavailable":
        return "Your browser is blocking local storage (private mode or a privacy setting). CareerPilot will run, but changes cannot be saved.";
      case "quota":
        return "Local storage is full. Remove some records or export your data, then try again.";
      case "corrupt":
        return "Stored data could not be read and was left untouched. You can reset this data from Settings.";
      case "write-failed":
        return "The change could not be saved to this browser.";
      case "read-failed":
        return "Stored data could not be read.";
    }
  }
}

export function isStorageError(value: unknown): value is StorageError {
  return value instanceof StorageError;
}
