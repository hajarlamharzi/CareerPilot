"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Play, Scale } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CenteredSpinner } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MatchScoreBadge } from "@/components/match/match-score-badge";
import { MatchReportView } from "@/components/match/match-report-view";
import { computeMatch } from "@/lib/matching/engine";
import { saveMatchReport } from "@/lib/matching/report";
import { formatDate } from "@/lib/format";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function MatchPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading match…" />}>
      <MatchPageContent />
    </Suspense>
  );
}

function MatchPageContent() {
  const searchParams = useSearchParams();
  const urlJobId = searchParams.get("job");
  const urlReportId = searchParams.get("report");

  const ready = useStoreReady();
  const jobs = useWorkspaceDomain("jobs");
  const cvLibrary = useWorkspaceDomain("cv");
  const matches = useWorkspaceDomain("matches");

  const [chosenJobId, setChosenJobId] = useState<string | null>(null);
  const [chosenCvId, setChosenCvId] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(urlReportId);
  const [running, setRunning] = useState(false);

  const jobList = jobs ?? [];
  const docList = cvLibrary?.documents ?? [];

  const selectedJobId = chosenJobId ?? urlJobId ?? jobList[0]?.id ?? null;
  const selectedCvId =
    chosenCvId ?? cvLibrary?.activeId ?? docList[0]?.id ?? null;

  const job = jobList.find((entry) => entry.id === selectedJobId) ?? null;
  const cv = docList.find((doc) => doc.id === selectedCvId) ?? null;

  const jobReports = useMemo(
    () => (matches ?? []).filter((match) => match.jobId === selectedJobId),
    [matches, selectedJobId],
  );

  const activeReport = activeReportId
    ? jobReports.find((report) => report.id === activeReportId) ?? null
    : null;
  const displayReport = activeReport ?? jobReports[0] ?? null;

  if (!ready) return <CenteredSpinner label="Loading workspace…" />;

  if (jobList.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No jobs to match yet"
        description="Add a job listing first, then compare it against your CV."
        action={
          <Button asChild>
            <Link href="/jobs/new">Add a job</Link>
          </Button>
        }
      />
    );
  }

  if (docList.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No CV in your library yet"
        description="Upload or create a CV so matching has something to compare against."
        action={
          <Button asChild>
            <Link href="/cv">Add your CV</Link>
          </Button>
        }
      />
    );
  }

  function handleRun() {
    if (!job || !cv) return;
    setRunning(true);
    try {
      const report = saveMatchReport(computeMatch({ job, cv }));
      setActiveReportId(null);
      setChosenCvId(cv.id);
      toast.success("Match complete", {
        description: `${report.score}% — ${report.category} match`,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match"
        description="Score a job against your CV with a transparent, deterministic engine."
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-primary" aria-hidden />
            Run a match
          </CardTitle>
          <CardDescription>
            Pick a job and the CV to compare. Required skills count 50%, preferred
            skills 20%, experience 20% and role alignment 10%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <label htmlFor="match-job" className="text-sm font-medium">
                Job
              </label>
              <select
                id="match-job"
                className={selectClass}
                value={selectedJobId ?? ""}
                onChange={(event) => setChosenJobId(event.target.value)}
              >
                {jobList.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} — {entry.company}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="match-cv" className="text-sm font-medium">
                CV
              </label>
              <select
                id="match-cv"
                className={selectClass}
                value={selectedCvId ?? ""}
                onChange={(event) => setChosenCvId(event.target.value)}
              >
                {docList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRun} disabled={running || !job || !cv}>
                <Play className="size-4" aria-hidden />
                {running ? "Matching…" : "Run match"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {jobReports.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Previous runs for this job</p>
          <ul className="flex flex-wrap gap-2">
            {jobReports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => setActiveReportId(report.id)}
                  className={
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (displayReport?.id === report.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-card hover:bg-muted")
                  }
                  aria-pressed={displayReport?.id === report.id}
                >
                  <MatchScoreBadge score={report.score} />
                  {formatDate(report.createdAt)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {displayReport ? (
        <MatchReportView
          report={displayReport}
          job={jobList.find((entry) => entry.id === displayReport.jobId) ?? null}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No report for the selected job yet. Run a match to see the breakdown.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}