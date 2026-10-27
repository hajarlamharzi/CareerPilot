"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, HardDrive, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InlineAlert } from "@/components/shared/error-state";
import {
  cvFileStore,
  DOMAIN_KEYS,
  STORE_DOMAINS,
  workspaceStore,
  type StoreDomain,
} from "@/lib/storage";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import {
  describeDomainValue,
  formatBytes,
  storageDomainLabel,
  usageRows,
} from "@/features/workspace/storage-usage";
import { formatDate } from "@/lib/format";
import type { CvFileMeta } from "@/types";

interface StorageSectionProps {
  /**
   * Bumped by the parent after a data action (import or erase). The byte figures
   * re-measure themselves because they subscribe to the store, but the uploaded
   * file list lives in IndexedDB and needs this nudge.
   */
  refreshKey: number;
}

/**
 * Storage management: what is stored, how much room it takes, and what to do
 * about anything that could not be read.
 *
 * The byte figures are measured from the actual persisted values, and the page
 * is explicit that the browser does not expose a total quota — so no
 * "percentage of your storage" claim is made.
 */
export function StorageSection({ refreshKey }: StorageSectionProps) {
  const ready = useStoreReady();

  // Subscribe to every persisted domain: reading them drives the record counts,
  // and the subscription is what makes the byte figures live.
  const stored: Record<StoreDomain, unknown> = {
    meta: useWorkspaceDomain("meta"),
    profile: useWorkspaceDomain("profile"),
    jobs: useWorkspaceDomain("jobs"),
    applications: useWorkspaceDomain("applications"),
    cv: useWorkspaceDomain("cv"),
    matches: useWorkspaceDomain("matches"),
    interviews: useWorkspaceDomain("interviews"),
    activity: useWorkspaceDomain("activity"),
    preferences: useWorkspaceDomain("preferences"),
  };

  const counts: Record<string, string> = {};
  for (const domain of STORE_DOMAINS) {
    counts[DOMAIN_KEYS[domain]] = describeDomainValue(stored[domain]);
  }

  // The uploaded files live in IndexedDB, which has no synchronous read, so they
  // are loaded into state from an async callback.
  const filesAvailable = ready && cvFileStore.available();
  const [files, setFiles] = useState<CvFileMeta[]>([]);

  useEffect(() => {
    if (!filesAvailable) return;
    let cancelled = false;
    cvFileStore
      .list()
      .then((list) => {
        if (!cancelled) setFiles(list);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [filesAvailable, refreshKey]);

  if (!ready) {
    return (
      <section
        id="storage"
        className="scroll-mt-20 rounded-xl border border-border bg-card p-5"
        aria-busy="true"
      >
        <p className="text-sm text-muted-foreground">Measuring storage…</p>
      </section>
    );
  }

  const usage = workspaceStore.measureUsage();
  const issues = workspaceStore.currentIssues;
  const rows = usageRows(usage, storageDomainLabel);
  const fileBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <section id="storage" className="scroll-mt-20 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Storage</h2>
        <p className="text-sm text-muted-foreground">
          CareerPilot keeps everything in this browser. Nothing is uploaded.
        </p>
      </header>

      {!usage.storageAvailable ? (
        <InlineAlert
          variant="warning"
          icon={AlertTriangle}
          title="Local storage is unavailable"
        >
          Your browser is blocking local storage (private mode or a privacy
          setting). CareerPilot still runs, but changes cannot be saved and will
          disappear when you close the tab.
        </InlineAlert>
      ) : null}

      {issues.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="size-4 text-destructive"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-destructive">
              Data that could not be read
            </h3>
          </div>
          {issues.map((issue) => (
            <div
              key={`${issue.domain}-${issue.code}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-background p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {storageDomainLabel(issue.domain)}
                  <Badge variant="destructive" className="ml-2">
                    {issue.code}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">{issue.message}</p>
                <p className="text-xs text-muted-foreground">{issue.hint}</p>
              </div>
              <ConfirmDialog
                variant="destructive"
                title={`Discard stored ${storageDomainLabel(issue.domain).toLowerCase()} data?`}
                description="The unreadable data will be removed from this browser. Everything else is left untouched. This cannot be undone."
                confirmLabel="Discard"
                onConfirm={() => {
                  workspaceStore.remove(issue.domain);
                  toast.success(
                    `${storageDomainLabel(issue.domain)} data discarded.`,
                  );
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    Discard
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold">
              {formatBytes(usage.totalBytes)} stored
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            across {rows.length} {rows.length === 1 ? "key" : "keys"}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Stored data by key: size and record count
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Data
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Records
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Size
                </th>
                <th scope="col" className="py-2 font-medium">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {counts[row.key] ?? "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatBytes(row.bytes)}
                  </td>
                  <td className="py-2 tabular-nums text-muted-foreground">
                    {row.percentage}%
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-muted-foreground">
                    Nothing is stored yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Sizes are the exact UTF-8 bytes of the stored values. Your browser does
          not expose a total quota, so this is a footprint rather than a
          percentage. “Unrecognised key” rows are leftovers from an older
          CareerPilot version and are removed when you erase your data below.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Uploaded CV files</h3>
            <p className="text-xs text-muted-foreground">
              {filesAvailable
                ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(fileBytes)} held in IndexedDB for the CV parser. The parsed CV itself lives in local storage above.`
                : "IndexedDB is unavailable in this browser context, so uploaded files cannot be stored."}
            </p>
          </div>
          {files.length > 0 ? (
            <ConfirmDialog
              variant="destructive"
              title="Remove all uploaded CV files?"
              description="The original files you uploaded will be deleted from this browser. Your parsed CV documents stay in the CV library."
              confirmLabel="Remove files"
              onConfirm={() => {
                void cvFileStore
                  .clear()
                  .then(() => {
                    toast.success("Uploaded CV files removed.");
                    setFiles([]);
                  })
                  .catch(() => toast.error("Those files could not be removed."));
              }}
              trigger={
                <Button size="sm" variant="outline">
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove all files
                </Button>
              }
            />
          ) : null}
        </div>

        {files.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="truncate">{file.fileName}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatBytes(file.size)} · {formatDate(file.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
