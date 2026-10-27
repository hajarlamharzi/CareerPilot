"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ExternalLink,
  History,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/loading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusPill } from "@/components/applications/status-pill";
import { MatchScoreBadge } from "@/components/match/match-score-badge";
import {
  addApplicationNote,
  deleteApplication,
  setApplicationStatus,
  updateApplication,
} from "@/features/applications/application-store";
import { latestMatchPerJob } from "@/lib/matching/report";
import { formatDate } from "@/lib/format";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/config/constants";
import type { Application, ApplicationStatus } from "@/types";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const ready = useStoreReady();
  const applications = useWorkspaceDomain("applications");
  const jobs = useWorkspaceDomain("jobs");
  const matches = useWorkspaceDomain("matches");

  const [noteDraft, setNoteDraft] = useState("");

  const app = (applications ?? []).find((entry) => entry.id === id) ?? null;

  if (!ready) return <PageSkeleton />;

  if (!app) {
    return (
      <EmptyState
        icon={Send}
        title="Application not found"
        description="It may have been deleted, or the link is out of date."
        action={
          <Button asChild>
            <Link href="/applications">
              <ArrowLeft className="size-4" aria-hidden />
              Back to applications
            </Link>
          </Button>
        }
      />
    );
  }

  const linkedJob = app.jobId
    ? (jobs ?? []).find((job) => job.id === app.jobId) ?? null
    : null;
  const matchScore = app.jobId
    ? latestMatchPerJob(matches ?? []).find(
        (report) => report.jobId === app.jobId,
      )?.score ?? null
    : null;

  function handleStatusChange(status: ApplicationStatus) {
    if (!app) return;
    const updated = setApplicationStatus(app.id, status);
    if (updated) {
      toast.success(`Status updated`, {
        description: `${updated.position} is now ${APPLICATION_STATUS_LABELS[status]}.`,
      });
    }
  }

  function handleAddNote() {
    if (!app) return;
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const updated = addApplicationNote(app.id, trimmed);
    if (updated) {
      setNoteDraft("");
      toast.success("Note added");
    }
  }

  function handleDelete() {
    if (!app) return;
    deleteApplication(app.id);
    toast.success("Application deleted");
    router.push("/applications");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => router.push("/applications")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to applications
        </Button>
        <PageHeader
          title={app.position}
          description={`${app.company} · ${formatDate(app.appliedAt)}`}
          actions={
            <>
              <StatusPill status={app.status} />
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                }
                title="Delete this application?"
                description={`"${app.position}" at ${app.company} and its history will be removed.`}
                confirmLabel="Delete application"
                onConfirm={handleDelete}
              />
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" aria-hidden />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {app.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No status changes recorded yet.
                </p>
              ) : (
                <ol className="relative space-y-5 border-l pl-5">
                  {app.history.map((entry) => (
                    <li key={entry.id} className="relative text-sm">
                      <span className="absolute -left-[23px] top-1 size-2 rounded-full bg-primary ring-4 ring-background" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {entry.from
                            ? `${APPLICATION_STATUS_LABELS[entry.from as ApplicationStatus]} → ${APPLICATION_STATUS_LABELS[entry.to as ApplicationStatus]}`
                            : `Created — ${APPLICATION_STATUS_LABELS[entry.to as ApplicationStatus]}`}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.at, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {entry.note ? (
                        <p className="mt-1 text-muted-foreground">{entry.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="size-4 text-primary" aria-hidden />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note-draft" className="sr-only">
                  Add a note
                </Label>
                <Textarea
                  id="note-draft"
                  rows={3}
                  placeholder="Record a call, an outcome, next steps…"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddNote} disabled={!noteDraft.trim()}>
                    Add note
                  </Button>
                </div>
              </div>
              {app.notes.length > 0 ? (
                <ul className="space-y-3">
                  {app.notes.map((note) => (
                    <li key={note.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="whitespace-pre-line text-foreground">{note.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(note.at, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No notes yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">About this application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Current stage
                </p>
                <select
                  className={`${inputClass} mt-1`}
                  value={app.status}
                  onChange={(event) =>
                    handleStatusChange(event.target.value as ApplicationStatus)
                  }
                  aria-label="Current stage"
                >
                  {APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {APPLICATION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              {linkedJob && (
                <Link
                  href={`/jobs/${linkedJob.id}`}
                  className="flex items-center gap-2 font-medium text-primary hover:underline"
                >
                  <Building2 className="size-4 shrink-0" aria-hidden />
                  {linkedJob.title}
                  <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              )}
              {matchScore !== null && <MatchScoreBadge score={matchScore} />}

              <Separator />

              <div className="space-y-2 text-muted-foreground">
                <p className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Applied {formatDate(app.appliedAt)}
                </p>
                {app.contact.name && (
                  <p className="flex items-start gap-2">
                    <User className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {app.contact.name}
                    {app.contact.role ? ` · ${app.contact.role}` : ""}
                  </p>
                )}
                {app.contact.email && (
                  <p className="flex items-start gap-2 break-all">
                    <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {app.contact.email}
                  </p>
                )}
                {app.contact.phone && (
                  <p className="flex items-start gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {app.contact.phone}
                  </p>
                )}
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {linkedJob?.location ?? app.sourceName ?? "No source on file"}
                </p>
              </div>

              {app.sourceUrl && (
                <a
                  href={app.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  View source listing
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </CardContent>
          </Card>

          <ApplicationDatesCard key={app.id} app={app} />
        </aside>
      </div>
    </div>
  );
}

/** Editable interview/follow-up dates. Keyed by application so the draft state
 * resets when navigating between applications. */
function ApplicationDatesCard({ app }: { app: Application }) {
  const [interviewDraft, setInterviewDraft] = useState(
    () => app.interviewAt?.slice(0, 10) ?? "",
  );
  const [followUpDraft, setFollowUpDraft] = useState(
    () => app.followUpAt?.slice(0, 10) ?? "",
  );
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    const updated = updateApplication(app.id, {
      interviewAt: interviewDraft ? `${interviewDraft}T00:00:00.000Z` : null,
      followUpAt: followUpDraft ? `${followUpDraft}T00:00:00.000Z` : null,
    });
    setSaving(false);
    if (updated) toast.success("Dates saved");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dates</CardTitle>
        <CardDescription>
          Interview and follow-up reminders surface on the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="interview-date">Interview date</Label>
          <Input
            id="interview-date"
            type="date"
            value={interviewDraft}
            onChange={(event) => setInterviewDraft(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="follow-up-date">Follow up by</Label>
          <Input
            id="follow-up-date"
            type="date"
            value={followUpDraft}
            onChange={(event) => setFollowUpDraft(event.target.value)}
          />
        </div>
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          <Save className="size-4" aria-hidden />
          Save dates
        </Button>
      </CardContent>
    </Card>
  );
}