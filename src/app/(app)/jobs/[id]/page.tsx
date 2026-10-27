"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  Scale,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/loading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { JobForm } from "@/components/jobs/job-form";
import { MatchScoreBadge } from "@/components/match/match-score-badge";
import { deleteJob, updateJob } from "@/features/jobs/job-store";
import { jobFormToJob, type JobFormValues } from "@/features/jobs/job-form-schema";
import { latestMatchPerJob } from "@/lib/matching/report";
import { formatDate, formatDayRelative, formatSalaryRange } from "@/lib/format";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from "@/config/constants";

function SkillChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const ready = useStoreReady();
  const jobs = useWorkspaceDomain("jobs");
  const matches = useWorkspaceDomain("matches");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const job = (jobs ?? []).find((entry) => entry.id === id) ?? null;
  const report = latestMatchPerJob(matches ?? []).find(
    (match) => match.jobId === id,
  );

  if (!ready) return <PageSkeleton />;

  if (!job) {
    return (
      <EmptyState
        icon={Building2}
        title="Job not found"
        description="It may have been deleted, or the link is out of date."
        action={
          <Button asChild>
            <Link href="/jobs">
              <ArrowLeft className="size-4" aria-hidden />
              Back to jobs
            </Link>
          </Button>
        }
      />
    );
  }

  function handleSave(values: JobFormValues) {
    if (!job) return;
    setBusy(true);
    const updated = updateJob(job.id, jobFormToJob(values));
    setBusy(false);
    if (updated) {
      toast.success("Job updated");
      setEditing(false);
    }
  }

  function handleDelete() {
    if (!job) return;
    deleteJob(job.id);
    toast.success("Job deleted", {
      description: `${job.title} was removed from your tracker.`,
    });
    router.push("/jobs");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => router.push("/jobs")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to jobs
        </Button>
        <PageHeader
          title={job.title}
          description={`${job.company} · ${job.location}`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                }
                title="Delete this job?"
                description={`"${job.title}" at ${job.company} will be removed. Linked applications are kept.`}
                confirmLabel="Delete job"
                onConfirm={handleDelete}
              />
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {report && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scale className="size-4 text-primary" aria-hidden />
                    Latest match report
                  </CardTitle>
                  <MatchScoreBadge score={report.score} />
                </div>
                <CardDescription>
                  Deterministic CV match, run{" "}
                  {formatDate(report.createdAt)} · confidence{" "}
                  {Math.round(report.confidence * 100)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/match?job=${job.id}&report=${report.id}`}>
                    View full report
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {job.description || "No description provided."}
              </p>
            </CardContent>
          </Card>

          {job.responsibilities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {job.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.length > 0 ? (
                    job.requiredSkills.map((skill) => (
                      <SkillChip key={skill} label={skill} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">None listed.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Preferred
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.preferredSkills.length > 0 ? (
                    job.preferredSkills.map((skill) => (
                      <SkillChip key={skill} label={skill} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">None listed.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4 shrink-0" aria-hidden />
                {job.companyWebsite ? (
                  <a
                    href={job.companyWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {job.company}
                  </a>
                ) : (
                  <span>{job.company}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden />
                {job.location}
              </div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                {formatSalaryRange(job.salary)}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{WORK_MODE_LABELS[job.workMode]}</Badge>
                <Badge variant="outline">
                  {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                </Badge>
                {job.seniority && (
                  <Badge variant="outline">
                    {SENIORITY_LABELS[job.seniority]}
                  </Badge>
                )}
                <Badge variant="secondary">{JOB_STATUS_LABELS[job.status]}</Badge>
              </div>
              <Separator />
              <div className="space-y-1.5 text-muted-foreground">
                <p className="flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                  Published {formatDate(job.publishedAt)}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                  {job.deadline
                    ? `Closes ${formatDayRelative(job.deadline)}`
                    : "No deadline"}
                </p>
                {job.experienceYears !== null && job.experienceYears !== undefined && (
                  <p className="flex items-center gap-2">
                    ~{job.experienceYears} year
                    {job.experienceYears === 1 ? "" : "s"} experience
                  </p>
                )}
              </div>
              {job.sourceUrl && (
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  View original listing
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
              {job.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((tag) => (
                      <Badge key={tag} variant="muted">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {job.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {job.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            <Button asChild>
              <Link href={`/match?job=${job.id}`}>
                <Scale className="size-4" aria-hidden />
                Run match against CV
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/applications?job=${job.id}`}>
                Track an application
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit job</DialogTitle>
            <DialogDescription>
              Update the listing details. Skills feed the match score.
            </DialogDescription>
          </DialogHeader>
          <JobForm initial={job} busy={busy} onSubmit={handleSave} />
        </DialogContent>
      </Dialog>
    </div>
  );
}