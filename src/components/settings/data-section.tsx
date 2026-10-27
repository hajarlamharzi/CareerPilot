"use client";

import { useRef, useState } from "react";
import {
  Database,
  Download,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  eraseToEmptyWorkspace,
  exportWorkspaceBackup,
  resetToDemoWorkspace,
} from "@/features/workspace/actions";
import {
  importTransferBundle,
  parseTransferBundle,
} from "@/features/workspace/transfer";
import type { TransferBundle } from "@/schemas/transfer";

interface DataSectionProps {
  /** Called after a change so the storage section re-measures. */
  onDataChanged: () => void;
}

/**
 * Import, export and reset.
 *
 * Export produces the same portable bundle the app documents for backup; import
 * validates it before replacing anything, and shows what it is about to replace.
 */
export function DataSection({ onDataChanged }: DataSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<TransferBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const summary = exportWorkspaceBackup();
    toast.success(
      `Backup downloaded (${summary.jobs} jobs, ${summary.applications} applications).`,
    );
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const raw = await file.text();
      const bundle = parseTransferBundle(raw);
      setPending(bundle);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "That file could not be read.";
      setError(message);
      toast.error(message);
    }
  }

  function confirmImport() {
    if (!pending) return;
    importTransferBundle(pending);
    const counts = pending.data;
    setPending(null);
    onDataChanged();
    toast.success(
      `Imported ${counts.jobs.length} jobs and ${counts.applications.length} applications.`,
    );
  }

  return (
    <section id="data" className="scroll-mt-20 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Your data</h2>
        <p className="text-sm text-muted-foreground">
          Take a portable copy, restore one, or start over. Everything is local,
          so you are always the one holding it.
        </p>
      </header>

      {error ? (
        <InlineAlert variant="destructive" title="Import failed">
          {error}
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Export a backup</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            A single JSON file with your profile, jobs, applications, CV
            library, matches, interview questions, activity and preferences. API
            keys are never included, because CareerPilot never stores them.
          </p>
          <Button className="mt-4" variant="outline" onClick={handleExport}>
            <Download className="size-4" aria-hidden="true" />
            Download backup
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Import a backup</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Replaces the workspace with the contents of the file. The file is
            validated first, so a malformed export is rejected rather than
            half-applied.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose a file
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Start over</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          These actions replace or remove the data stored in this browser. Export
          a backup first if you might want it back.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ConfirmDialog
            title="Reset to the demo workspace?"
            description="Your current records will be replaced with the bundled sample jobs, applications and CV. Anything you created will be lost."
            confirmLabel="Reset to demo"
            onConfirm={() => {
              resetToDemoWorkspace();
              onDataChanged();
              toast.success("Workspace reset to the demo data.");
            }}
            trigger={
              <Button variant="outline">
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset to demo data
              </Button>
            }
          />

          <ConfirmDialog
            variant="destructive"
            title="Erase everything and start empty?"
            description="Removes all CareerPilot data from this browser — records, preferences and any uploaded CV files — and leaves you with an empty personal workspace. This cannot be undone."
            confirmLabel="Erase everything"
            onConfirm={() => {
              void eraseToEmptyWorkspace().then(() => {
                onDataChanged();
                toast.success("All data erased. Starting empty.");
              });
            }}
            trigger={
              <Button variant="destructive">
                <Trash2 className="size-4" aria-hidden="true" />
                Erase all data
              </Button>
            }
          />
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Replace this workspace with the imported backup?"
        description={
          pending
            ? `The file contains ${pending.data.jobs.length} jobs, ${pending.data.applications.length} applications, ${pending.data.matches.length} match reports and ${pending.data.interviews.length} interview questions. Your current records will be replaced.`
            : ""
        }
        confirmLabel="Import and replace"
        onConfirm={confirmImport}
      />

      <InlineAlert variant="info" icon={Database}>
        Data lives in this browser only. Clearing site data, using a different
        browser, or opening a private window will not show this workspace — that
        is why the backup exists.
      </InlineAlert>
    </section>
  );
}
