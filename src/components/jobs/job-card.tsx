"use client";

import Link from "next/link";
import { Building2, CalendarClock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from "@/config/constants";
import { formatDayRelative, formatSalaryRange } from "@/lib/format";
import type { Job } from "@/types";

import { MatchScoreBadge } from "@/components/match/match-score-badge";

interface JobCardProps {
  job: Job;
  matchScore?: number | null;
}

export function JobCard({ job, matchScore }: JobCardProps) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block h-full rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Card className="flex h-full flex-col transition-shadow group-hover:border-primary/40 group-hover:shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug group-hover:text-primary">
              {job.title}
            </CardTitle>
            {matchScore !== undefined && matchScore !== null && (
              <MatchScoreBadge score={matchScore} />
            )}
          </div>
          <CardDescription className="flex items-center gap-1.5 text-sm">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            {job.company}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex grow flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {job.location}
            </span>
            {job.deadline && (
              <span
                className={
                  "inline-flex items-center gap-1 " +
                  (formatDayRelative(job.deadline) === "Today" ||
                  formatDayRelative(job.deadline).startsWith("in") &&
                  parseInt(formatDayRelative(job.deadline).slice(3), 10) <= 7
                    ? "text-destructive"
                    : "")
                }
              >
                <CalendarClock className="size-3.5" aria-hidden />
                Closes {formatDayRelative(job.deadline)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{WORK_MODE_LABELS[job.workMode]}</Badge>
            <Badge variant="outline">
              {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
            </Badge>
            {job.seniority && (
              <Badge variant="outline">{SENIORITY_LABELS[job.seniority]}</Badge>
            )}
            <Badge variant="secondary">{JOB_STATUS_LABELS[job.status]}</Badge>
          </div>

          <p className="mt-auto text-sm font-medium text-foreground">
            {formatSalaryRange(job.salary)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}