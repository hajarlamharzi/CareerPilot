"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardGridSkeleton } from "@/components/shared/loading";
import { JobCard } from "@/components/jobs/job-card";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SENIORITIES,
  WORK_MODES,
} from "@/config/constants";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import type {
  EmploymentType,
  JobSortKey,
  JobStatus,
  MatchReport,
  Seniority,
  WorkMode,
} from "@/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const sortOptions: { value: JobSortKey; label: string }[] = [
  { value: "addedAt", label: "Recently added" },
  { value: "publishedAt", label: "Published" },
  { value: "deadline", label: "Deadline" },
  { value: "matchScore", label: "Match score" },
  { value: "title", label: "Title (A–Z)" },
  { value: "company", label: "Company (A–Z)" },
];

function latestMatchPerJob(matches: MatchReport[]): Map<string, number> {
  const lookup = new Map<string, { score: number; at: string }>();
  for (const match of matches) {
    const existing = lookup.get(match.jobId);
    if (!existing || match.createdAt > existing.at) {
      lookup.set(match.jobId, { score: match.score, at: match.createdAt });
    }
  }
  const byJob = new Map<string, number>();
  for (const [jobId, value] of lookup) byJob.set(jobId, value.score);
  return byJob;
}

export default function JobsPage() {
  return (
    <Suspense fallback={<CardGridSkeleton count={6} className="mt-8" />}>
      <JobsPageContent />
    </Suspense>
  );
}

function JobsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The global search box navigates to /jobs?q=…; the URL is the source of truth.
  const query = searchParams.get("q") ?? "";

  const ready = useStoreReady();
  const jobs = useWorkspaceDomain("jobs");
  const matches = useWorkspaceDomain("matches");

  const [workMode, setWorkMode] = useState<WorkMode | "all">("all");
  const [seniority, setSeniority] = useState<Seniority | "all">("all");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "all">("all");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [sort, setSort] = useState<JobSortKey>("addedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const jobList = useMemo(() => jobs ?? [], [jobs]);
  const matchScoreByJob = useMemo(
    () => latestMatchPerJob(matches ?? []),
    [matches],
  );

  function setQuery(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    const qs = next.toString();
    router.replace(qs ? `/jobs?${qs}` : "/jobs");
  }

  function clearFilters() {
    setWorkMode("all");
    setSeniority("all");
    setEmploymentType("all");
    setStatus("all");
    router.replace("/jobs");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = jobList.filter((job) => {
      if (workMode !== "all" && job.workMode !== workMode) return false;
      if (seniority !== "all" && job.seniority !== seniority) return false;
      if (employmentType !== "all" && job.employmentType !== employmentType)
        return false;
      if (status !== "all" && job.status !== status) return false;
      if (q) {
        const haystack = [
          job.title,
          job.company,
          job.location,
          ...job.tags,
          ...job.requiredSkills,
          ...job.preferredSkills,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const getSortValue = (job: (typeof jobList)[number]) => {
      switch (sort) {
        case "addedAt":
          return job.addedAt;
        case "publishedAt":
          return job.publishedAt ?? "\uffff";
        case "deadline":
          return job.deadline ?? "\uffff";
        case "matchScore":
          return (matchScoreByJob.get(job.id) ?? -1).toString().padStart(4, "0");
        case "title":
          return job.title.toLowerCase();
        case "company":
          return job.company.toLowerCase();
      }
    };

    return [...list].sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return direction === "asc" ? cmp : -cmp;
    });
  }, [
    jobList,
    query,
    workMode,
    seniority,
    employmentType,
    status,
    sort,
    direction,
    matchScoreByJob,
  ]);

  if (!ready) {
    return <CardGridSkeleton count={6} className="mt-8" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Discover, save and organise opportunities."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus className="size-4" aria-hidden />
              Add job
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, company, skills…"
            className="pl-8"
            aria-label="Search jobs"
          />
        </div>
        <select
          value={workMode}
          onChange={(e) => setWorkMode(e.target.value as WorkMode | "all")}
          className={selectClass}
          aria-label="Filter by work mode"
        >
          <option value="all">Any work mode</option>
          {WORK_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value as Seniority | "all")}
          className={selectClass}
          aria-label="Filter by seniority"
        >
          <option value="all">Any seniority</option>
          {SENIORITIES.map((level) => (
            <option key={level} value={level}>
              {level[0].toUpperCase() + level.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={employmentType}
          onChange={(e) =>
            setEmploymentType(e.target.value as EmploymentType | "all")
          }
          className={selectClass}
          aria-label="Filter by employment type"
        >
          <option value="all">Any type</option>
          {EMPLOYMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type[0].toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as JobStatus | "all")}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          {JOB_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value[0].toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as JobSortKey)}
            className={selectClass}
            aria-label="Sort jobs"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={direction === "asc" ? "Ascending order" : "Descending order"}
            title={direction === "asc" ? "Ascending" : "Descending"}
          >
            {direction === "asc" ? "↑" : "↓"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} of {jobList.length} jobs
      </p>

      {jobList.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Add your first job, or explore the demo dataset from Settings."
          action={
            <Button asChild>
              <Link href="/jobs/new">
                <Plus className="size-4" aria-hidden />
                Add job
              </Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results"
          description="Try widening your filters or search terms."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              matchScore={matchScoreByJob.get(job.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}