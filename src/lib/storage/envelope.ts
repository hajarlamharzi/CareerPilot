import { STORAGE_VERSION } from "@/config/app";
import { StorageError } from "./errors";

/**
 * Every persisted value is wrapped in a versioned envelope:
 *
 *   { "v": 1, "data": <domain value> }
 *
 * The envelope lets us migrate stored data shape over time without guessing,
 * and lets us reject data written by a *newer* app version rather than
 * mis-reading it.
 */
export interface Envelope<T = unknown> {
  v: number;
  data: T;
}

export function encodeEnvelope<T>(data: T, version = STORAGE_VERSION): string {
  const envelope: Envelope<T> = { v: version, data };
  return JSON.stringify(envelope);
}

export interface DecodedEnvelope {
  v: number;
  data: unknown;
}

export function decodeEnvelope(raw: string): DecodedEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new StorageError("corrupt", "Stored value is not valid JSON.", {
      cause,
    });
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("v" in parsed) ||
    !("data" in parsed)
  ) {
    throw new StorageError(
      "corrupt",
      "Stored value is missing its version envelope.",
    );
  }

  const { v, data } = parsed as { v: unknown; data: unknown };
  if (typeof v !== "number") {
    throw new StorageError("corrupt", "Stored value has an invalid version.");
  }

  return { v, data };
}

/**
 * Forward migrations keyed by the *from* version. Each migration upgrades the
 * data one step. Version 1 is the initial schema, so the map starts empty.
 */
export const MIGRATIONS: Record<number, (data: unknown) => unknown> = {};

export function migrate(data: unknown, fromVersion: number): unknown {
  let current = data;
  let version = fromVersion;
  while (version < STORAGE_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new StorageError(
        "corrupt",
        `No migration path from storage version ${version}.`,
      );
    }
    current = migration(current);
    version += 1;
  }
  return current;
}
