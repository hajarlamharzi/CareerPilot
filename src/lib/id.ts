/**
 * Stable, collision-resistant ids for locally created records.
 *
 * Uses `crypto.randomUUID` where available and falls back to a timestamp +
 * random suffix so the app still works in older or restricted browser contexts.
 */
export function createId(prefix?: string): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${raw}` : raw;
}
