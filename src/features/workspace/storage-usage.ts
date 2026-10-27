import type { StorageUsage } from "@/lib/storage";

/** Human byte size. Deliberately decimal-free at the low end. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(2) : Math.round(mb)} MB`;
}

export interface UsageRow {
  key: string;
  label: string;
  bytes: number;
  /** Share of the CareerPilot total, 0–100. */
  percentage: number;
}

/** Merge domain and orphan rows into one sorted list for display. */
export function usageRows(
  usage: StorageUsage,
  labelFor: (domain: string) => string,
): UsageRow[] {
  const rows: Omit<UsageRow, "percentage">[] = [
    ...usage.items.map((item) => ({
      key: item.key,
      label: labelFor(item.domain),
      bytes: item.bytes,
    })),
    ...usage.orphans.map((orphan) => ({
      key: orphan.key,
      label: "Unrecognised key",
      bytes: orphan.bytes,
    })),
  ];
  return rows
    .map((row) => ({
      ...row,
      percentage:
        usage.totalBytes > 0
          ? Math.round((row.bytes / usage.totalBytes) * 100)
          : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/** Friendly names for the storage domains, used by the usage table. */
export const STORAGE_DOMAIN_LABELS: Record<string, string> = {
  meta: "Workspace meta",
  profile: "Profile",
  jobs: "Jobs",
  applications: "Applications",
  cv: "CV library",
  preferences: "Preferences",
  interviews: "Interview practice",
  matches: "Match reports",
  activity: "Activity feed",
};

export function storageDomainLabel(domain: string): string {
  return STORAGE_DOMAIN_LABELS[domain] ?? domain;
}

/** Rough record count for a domain value, so bytes have context. */
export function describeDomainValue(value: unknown): string {
  if (value === null || value === undefined) return "not stored";
  if (Array.isArray(value)) {
    return value.length === 1 ? "1 record" : `${value.length} records`;
  }
  if (typeof value === "object") {
    // The CV library is the one object-shaped domain with a countable collection.
    const documents = (value as { documents?: unknown }).documents;
    if (Array.isArray(documents)) {
      return documents.length === 1
        ? "1 CV document"
        : `${documents.length} CV documents`;
    }
    return "1 object";
  }
  return "—";
}
