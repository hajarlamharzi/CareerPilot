"use client";

import { Circle, CircleCheck, Lightbulb, Scale, TriangleAlert, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MatchScoreBadge } from "@/components/match/match-score-badge";
import { formatDate } from "@/lib/format";
import type {
  Job,
  MatchCategory,
  MatchDimension,
  MatchFinding,
  MatchReport,
} from "@/types";

const DIMENSION_LABELS: Record<MatchDimension, string> = {
  requiredSkills: "Required skills",
  preferredSkills: "Preferred skills",
  experience: "Experience",
  alignment: "Role alignment",
};

const CATEGORY_LABELS: Record<MatchCategory, string> = {
  strong: "Strong match",
  moderate: "Moderate match",
  low: "Low match",
};

const CATEGORY_BADGE: Record<MatchCategory, string> = {
  strong:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  moderate:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  low: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
};

const FINDING_ICONS: Record<MatchFinding["severity"], typeof CircleCheck> = {
  positive: CircleCheck,
  neutral: Circle,
  warning: TriangleAlert,
};

const FINDING_TONES: Record<MatchFinding["severity"], string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-400",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

interface MatchReportViewProps {
  report: MatchReport;
  job: Job | null;
}

/** Full breakdown of a match report. */
export function MatchReportView({ report, job }: MatchReportViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{job?.title ?? "Unknown role"}</CardTitle>
              <CardDescription>
                {job ? `${job.company} · ${job.location}` : "The job behind this report was deleted."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={CATEGORY_BADGE[report.category]}
              >
                {CATEGORY_LABELS[report.category]}
              </Badge>
              <MatchScoreBadge score={report.score} />
            </div>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span>
              Run {formatDate(report.createdAt)}
              {report.createdAt.includes("T") && report.createdAt.slice(11, 16) || ""}
            </span>
            <span aria-hidden>·</span>
            <span>{report.mode === "ai" ? "AI-assisted" : "Deterministic"} engine</span>
            <span aria-hidden>·</span>
            <span title="How confident the engine is that its inputs were complete">
              Confidence {Math.round(report.confidence * 100)}%
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Section title="How the score is built">
            <div className="space-y-3">
              {report.breakdown.map((row) => (
                <div key={row.dimension} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {DIMENSION_LABELS[row.dimension]}
                    </span>
                    <span className="text-muted-foreground">
                      {row.score === null ? (
                        "Not scored"
                      ) : (
                        <>
                          <span className="font-semibold text-foreground">
                            {Math.round(row.score * 100)}%
                          </span>{" "}
                          · weight {Math.round(row.effectiveWeight * 100)}%
                        </>
                      )}
                    </span>
                  </div>
                  <Progress
                    value={row.score === null ? 0 : Math.round(row.score * 100)}
                    aria-label={`${DIMENSION_LABELS[row.dimension]} score`}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {row.explanation}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Skills found in your CV
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.matchedSkills.length > 0 ? (
              <ul className="space-y-2">
                {report.matchedSkills.map((match) => (
                  <li key={match.skill} className="text-sm">
                    <span className="font-medium text-foreground">{match.skill}</span>
                    {match.evidence ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{match.evidence}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No required or preferred skills were found.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
              Skills the role asks for
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.missingRequiredSkills.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Missing required
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {report.missingRequiredSkills.map((skill) => (
                    <Chip key={skill}>{skill}</Chip>
                  ))}
                </div>
              </div>
            )}
            {report.missingPreferredSkills.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Missing preferred
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {report.missingPreferredSkills.map((skill) => (
                    <Chip key={skill}>{skill}</Chip>
                  ))}
                </div>
              </div>
            )}
            {report.missingRequiredSkills.length === 0 &&
              report.missingPreferredSkills.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Great news — no listed skills are missing from your CV.
                </p>
              )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-primary" aria-hidden />
            Findings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.findings.length > 0 ? (
            <ul className="space-y-3">
              {report.findings.map((finding) => {
                const Icon = FINDING_ICONS[finding.severity];
                return (
                  <li key={finding.id} className="flex gap-3">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${FINDING_TONES[finding.severity]}`}
                      aria-hidden
                    />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">{finding.title}</p>
                      <p className="text-muted-foreground">{finding.detail}</p>
                      {finding.evidence ? (
                        <p className="mt-1 text-xs text-muted-foreground">{finding.evidence}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No findings.</p>
          )}
        </CardContent>
      </Card>

      {(report.keywordsToConsider.length > 0 ||
        report.qualificationGaps.length > 0 ||
        report.learningPriorities.length > 0 ||
        report.cvImprovements.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-primary" aria-hidden />
              How to improve this match
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {report.keywordsToConsider.length > 0 && (
              <Section title="Keywords to weave into your CV">
                <div className="flex flex-wrap gap-1.5">
                  {report.keywordsToConsider.map((keyword) => (
                    <Chip key={keyword}>{keyword}</Chip>
                  ))}
                </div>
              </Section>
            )}
            {report.qualificationGaps.length > 0 && (
              <Section title="Qualification gaps">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {report.qualificationGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </Section>
            )}
            {report.learningPriorities.length > 0 && (
              <Section title="Learning priorities">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {report.learningPriorities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            )}
            {report.cvImprovements.length > 0 && (
              <Section title="CV improvements">
                <ul className="space-y-1.5 pl-1 text-sm text-muted-foreground">
                  {report.cvImprovements.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Wrench className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold uppercase tracking-wide">About the score</p>
        <p className="mt-1">
          The deterministic engine scores required skills (50%), preferred skills
          (20%), experience (20%) and role alignment (10%). When a dimension can&apos;t be
          computed, its weight is redistributed across the others. It never evaluates
          protected characteristics. The full methodology is in{" "}
          <code className="rounded bg-muted px-1 py-0.5">docs/MATCHING.md</code>.
        </p>
      </div>

      <Separator />
    </div>
  );
}