"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApplicationForm } from "@/components/applications/application-form";
import { StatusPill } from "@/components/applications/status-pill";
import { MatchScoreBadge } from "@/components/match/match-score-badge";
import {
  createApplication,
  setApplicationStatus,
} from "@/features/applications/application-store";
import {
  applicationFormToDraft,
  type ApplicationFormValues,
} from "@/features/applications/application-form-schema";
import { latestMatchPerJob } from "@/lib/matching/report";
import { formatDateShort } from "@/lib/format";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { APPLICATION_STATUSES } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/types";

const selectClass =
  "h-7 w-full max-w-[8.5rem] rounded-md border border-input bg-transparent px-2 py-0.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function KanbanCard({
  app,
  matchScore,
  onStatusChange,
}: {
  app: Application;
  matchScore: number | null;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: app.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-opacity",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/applications/${app.id}`}
          className="text-sm font-medium leading-snug hover:text-primary"
        >
          {app.position}
        </Link>
        <button
          type="button"
          className="-mr-1 -mt-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Drag ${app.position} to another stage`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{app.company}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {matchScore !== null && <MatchScoreBadge score={matchScore} />}
        <p className="text-xs text-muted-foreground">
          {app.appliedAt ? `Applied ${formatDateShort(app.appliedAt)}` : "Not yet applied"}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          className={selectClass}
          value={app.status}
          aria-label={`Change status for ${app.position}`}
          onChange={(event) => onStatusChange(app.id, event.target.value as ApplicationStatus)}
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  applications,
  matchScoreByJob,
  onStatusChange,
}: {
  status: ApplicationStatus;
  applications: Application[];
  matchScoreByJob: Map<string, number>;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${status} column`}
      className={cn(
        "flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-muted/20",
        isOver && "border-primary/60 ring-2 ring-primary/20",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <StatusPill status={status} />
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {applications.length}
        </span>
      </header>
      <div className="max-h-[70dvh] space-y-2 overflow-y-auto p-2">
        {applications.map((app) => (
          <KanbanCard
            key={app.id}
            app={app}
            matchScore={app.jobId ? (matchScoreByJob.get(app.jobId) ?? null) : null}
            onStatusChange={onStatusChange}
          />
        ))}
        {applications.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Drop an application here
          </p>
        )}
      </div>
    </section>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApplicationsContent />
    </Suspense>
  );
}

function ApplicationsContent() {
  const searchParams = useSearchParams();
  const requestedJobId = searchParams.get("job");

  const ready = useStoreReady();
  const applications = useWorkspaceDomain("applications");
  const jobs = useWorkspaceDomain("jobs");
  const matches = useWorkspaceDomain("matches");

  const [createOpen, setCreateOpen] = useState(false);
  const [prefillJobId, setPrefillJobId] = useState<string | null>(requestedJobId);

  const appList = applications ?? [];
  const jobList = jobs ?? [];
  const matchScoreByJob = useMemo(
    () => {
      const map = new Map<string, number>();
      for (const report of latestMatchPerJob(matches ?? [])) {
        map.set(report.jobId, report.score);
      }
      return map;
    },
    [matches],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const app = appList.find((entry) => entry.id === active.id);
    if (!app) return;
    const nextStatus = over.id as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(nextStatus) || nextStatus === app.status)
      return;
    const updated = setApplicationStatus(app.id, nextStatus);
    if (updated) {
      toast.success(`Moved to ${nextStatus}`, {
        description: `${updated.position} at ${updated.company}.`,
      });
    }
  }

  function handleStatusChange(id: string, status: ApplicationStatus) {
    const updated = setApplicationStatus(id, status);
    if (updated) toast.success(`Moved to ${status}`);
  }

  function handleCreateSubmit(values: ApplicationFormValues) {
    const app = createApplication(applicationFormToDraft(values));
    setCreateOpen(false);
    toast.success("Application tracked", {
      description: `${app.position} at ${app.company}.`,
    });
  }

  if (!ready) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Track every application through your pipeline. Drag cards between stages, or use the status menu."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Track application
          </Button>
        }
      />

      {appList.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No applications yet"
          description="Track an application you've sent — optionally linked to a saved job."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Track application
            </Button>
          }
        />
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex gap-4 px-1">
            {APPLICATION_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                applications={appList.filter((app) => app.status === status)}
                matchScoreByJob={matchScoreByJob}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Track an application</DialogTitle>
            <DialogDescription>
              Record where things stand. Linking a job lets the board show the
              match score alongside the card.
            </DialogDescription>
          </DialogHeader>
          <ApplicationForm
            jobs={jobList}
            initialJobId={prefillJobId}
            onSubmit={handleCreateSubmit}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}