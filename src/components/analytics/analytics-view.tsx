"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  FileCheck2,
  Gauge,
  MessagesSquare,
  Send,
  Target,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ApplicationsOverTimeChart,
  MatchDistributionChart,
  SkillBarChart,
  StatusDonutChart,
} from "@/components/analytics/analytics-charts";
import { InsightCard } from "@/components/analytics/method-note";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { APPLICATION_STATUS_LABELS } from "@/config/constants";
import { computeAnalyticsSummary } from "@/features/analytics/summary";
import {
  computeApplicationVelocity,
  computeFunnel,
  computeInterviewPrepStats,
} from "@/features/analytics/insights";

/**
 * Build a normalised-skill → preferred-spelling map.
 *
 * Skill counts are aggregated case-insensitively (`"REST APIs"` and `"rest apis"`
 * are one skill), so the stored aggregation key is lower-case. For display we
 * want the spelling the user actually wrote, so this scans the source records
 * and picks the most common original spelling, falling back to the key itself.
 */
function buildSkillLabels(sources: readonly string[][]): Map<string, string> {
  const spellings = new Map<string, Map<string, number>>();
  for (const group of sources) {
    for (const raw of group) {
      const spelling = raw.trim();
      const key = spelling.toLowerCase();
      if (!key) continue;
      const variants = spellings.get(key) ?? new Map<string, number>();
      variants.set(spelling, (variants.get(spelling) ?? 0) + 1);
      spellings.set(key, variants);
    }
  }

  const labels = new Map<string, string>();
  for (const [key, variants] of spellings) {
    let best = key;
    let bestCount = -1;
    for (const [spelling, count] of variants) {
      // Ties break alphabetically so the label is stable across renders.
      if (count > bestCount || (count === bestCount && spelling < best)) {
        best = spelling;
        bestCount = count;
      }
    }
    labels.set(key, best);
  }
  return labels;
}

function days(value: number | null): string {
  if (value === null) return "—";
  return `${value} ${value === 1 ? "day" : "days"}`;
}

/**
 * Analytics workspace.
 *
 * Every figure on this page comes from records the user stored, and every figure
 * can explain itself through its method note. Where the sample is too small to
 * mean much, the page says so instead of implying precision.
 */
export function AnalyticsView() {
  const ready = useStoreReady();
  const jobs = useWorkspaceDomain("jobs");
  const applications = useWorkspaceDomain("applications");
  const matches = useWorkspaceDomain("matches");
  const interviews = useWorkspaceDomain("interviews");
  const cv = useWorkspaceDomain("cv");

  const model = useMemo(() => {
    const jobList = jobs ?? [];
    const applicationList = applications ?? [];
    const matchList = matches ?? [];
    const interviewList = interviews ?? [];

    const summary = computeAnalyticsSummary({
      jobs: jobList,
      applications: applicationList,
      matches: matchList,
      interviews: interviewList,
      cv: cv ?? null,
    });

    return {
      summary,
      funnel: computeFunnel(applicationList),
      velocity: computeApplicationVelocity(applicationList),
      prep: computeInterviewPrepStats(interviewList),
      skillLabels: buildSkillLabels([
        jobList.flatMap((job) => [
          ...job.requiredSkills,
          ...job.preferredSkills,
        ]),
        matchList.flatMap((match) => [
          ...match.missingRequiredSkills,
          ...match.missingPreferredSkills,
        ]),
      ]),
    };
  }, [jobs, applications, matches, interviews, cv]);

  if (!ready) return <PageSkeleton />;

  const { summary, funnel, velocity, prep, skillLabels } = model;
  const nothingStored =
    summary.totalJobs === 0 &&
    summary.totalApplications === 0 &&
    summary.analyzedJobs === 0 &&
    prep.total === 0;

  if (nothingStored) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Insights calculated from the records you actually store — with the maths explained."
        />
        <EmptyState
          icon={BarChart3}
          title="Nothing to analyse yet"
          description="Analytics is derived entirely from your own records. Add a job, run a match, or start tracking an application and the insights will appear here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/jobs">Add a job</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/applications">Track an application</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const smallSample = summary.totalApplications > 0 && summary.totalApplications < 5;
  const activeStatuses = summary.applicationsByStatus
    .filter((row) => row.count > 0)
    .map((row) => ({
      status: row.status,
      label: APPLICATION_STATUS_LABELS[row.status],
      count: row.count,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Insights calculated from the records you actually store — with the maths explained."
      />

      {smallSample ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Percentages below are based on{" "}
          {summary.totalApplications === 1
            ? "a single application"
            : `${summary.totalApplications} applications`}
          . Treat them as illustrative until you have around ten records.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Applications tracked"
          value={summary.totalApplications}
          icon={Send}
          hint={`${summary.activeApplications} still in the pipeline`}
        />
        <StatCard
          label="Response rate"
          value={`${summary.responseRate}%`}
          icon={TrendingUp}
          hint="Reached screening or beyond"
        />
        <StatCard
          label="Offer rate"
          value={`${summary.offerRate}%`}
          icon={CheckCircle2}
          hint="Offers ÷ all applications"
        />
        <StatCard
          label="Average match score"
          value={
            summary.averageMatchScore === null
              ? "—"
              : `${summary.averageMatchScore}%`
          }
          icon={Gauge}
          hint={`${summary.analyzedJobs} of ${summary.totalJobs} jobs scored`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InsightCard
          title="Application funnel"
          description={`${funnel.steps[0]?.reached ?? 0} submitted, ${funnel.notApplied} not yet applied to`}
          note={{
            definition:
              "Each application counts at a stage if the furthest stage it reached — from its status history or its current status — is that stage or a later one.",
            formula:
              "reached(stage) = applications whose furthest stage ≥ stage\n% of applied = reached ÷ applied × 100\ndrop-off = (previous − this) ÷ previous × 100",
            caveat:
              "Rejected and withdrawn are outcomes, not stages: an application rejected after interview still counts as reaching interview.",
          }}
        >
          <ol className="space-y-3">
            {funnel.steps.map((step, index) => (
              <li key={step.stage} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {step.reached}
                    {index > 0 ? (
                      <span className="ml-2 text-xs">
                        −{step.dropOff}% vs {funnel.steps[index - 1].label}
                      </span>
                    ) : null}
                  </span>
                </div>
                <Progress value={step.percentage} />
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Applied → offer conversion:{" "}
            <span className="font-medium text-foreground">
              {funnel.appliedToOfferRate}%
            </span>
            {funnel.closed > 0 ? ` · ${funnel.closed} closed (rejected or withdrawn)` : ""}
          </p>
        </InsightCard>

        <InsightCard
          title="Where applications stand"
          description="Current status of every tracked application"
          note={{
            definition:
              "One slice per current status. This is a snapshot of right now, not a funnel — an application appears exactly once.",
            formula: "count(status) = applications whose current status = status",
          }}
          className="lg:col-span-2"
        >
          {activeStatuses.length > 0 ? (
            <StatusDonutChart data={activeStatuses} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No applications to chart yet.
            </p>
          )}
        </InsightCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InsightCard
          title="Applications over time"
          description="Counted by the date you applied, falling back to when you added the record"
          note={{
            definition:
              "Applications bucketed by calendar month, using appliedAt when present and createdAt otherwise.",
            formula:
              "If appliedAt is null, use createdAt.\nGroup by month; the last eight months are shown.",
            caveat: "Applications older than eight months are not plotted.",
          }}
        >
          <ApplicationsOverTimeChart data={summary.applicationsOverTime} />
        </InsightCard>

        <InsightCard
          title="Match score distribution"
          description="Latest score per job, bucketed"
          note={{
            definition:
              "For each job, only the most recent match report counts. Scores are grouped into four fixed bands.",
            formula: "bands: 0–24, 25–49, 50–74, 75–100",
            caveat:
              "Jobs you have not scored do not appear. Run a match to fill this in.",
          }}
        >
          {summary.analyzedJobs > 0 ? (
            <MatchDistributionChart data={summary.matchScoreDistribution} />
          ) : (
            <EmptyState
              compact
              icon={Target}
              title="No matches yet"
              description="Score a CV against a job to populate this chart."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/match">Run a match</Link>
                </Button>
              }
            />
          )}
        </InsightCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InsightCard
          title="Skills your jobs ask for"
          description="Required and preferred skills across all saved jobs"
          note={{
            definition:
              "Every skill from every saved job is counted once per job, however many times it appears in the advert.",
            formula: "count(skill) = number of jobs listing the skill",
          }}
        >
          {summary.topRequestedSkills.length > 0 ? (
            <SkillBarChart
              data={summary.topRequestedSkills.map((row) => ({
                label: skillLabels.get(row.skill) ?? row.skill,
                count: row.count,
              }))}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No skills recorded on your jobs yet.
            </p>
          )}
        </InsightCard>

        <InsightCard
          title="Skills missing from your CV"
          description="Gaps found by your latest match report per job"
          note={{
            definition:
              "Skills the matched job asked for that the match engine could not evidence in the active CV. Counted once per job.",
            formula: "count(skill) = number of jobs reporting the skill as missing",
            caveat:
              "A miss means the CV did not evidence the skill — not that you lack it. Check before you act on it.",
          }}
        >
          {summary.topMissingSkills.length > 0 ? (
            <SkillBarChart
              color="var(--chart-4)"
              data={summary.topMissingSkills.map((row) => ({
                label: skillLabels.get(row.skill) ?? row.skill,
                count: row.count,
              }))}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No gaps reported. Run a match to see where your CV falls short.
            </p>
          )}
        </InsightCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InsightCard
          title="How quickly employers respond"
          description="Measured only where you recorded both an application date and a response"
          note={{
            definition:
              "For each application with an appliedAt date, the first history entry that moved it into screening, interview, assessment or offer gives a response time.",
            formula:
              "responseDays = responseDate − appliedAt (in days)\nmean = sum ÷ count · median = middle value",
            caveat:
              "Your own logging drives this: if you did not record a date, the application cannot contribute.",
          }}
        >
          {velocity.sampleSize > 0 || velocity.awaitingResponse > 0 ? (
            <dl className="grid grid-cols-2 gap-4">
              <Metric
                label="Mean time to response"
                value={days(velocity.meanDaysToResponse)}
                hint={`${velocity.sampleSize} measured`}
              />
              <Metric
                label="Median time to response"
                value={days(velocity.medianDaysToResponse)}
                hint="Half responded faster"
              />
              <Metric
                label="Fastest response"
                value={days(velocity.fastestResponseDays)}
                hint="Best case observed"
              />
              <Metric
                label="Awaiting a response"
                value={String(velocity.awaitingResponse)}
                hint="No response recorded yet"
              />
              {velocity.meanDaysToOffer !== null ? (
                <Metric
                  label="Mean time to offer"
                  value={days(velocity.meanDaysToOffer)}
                  hint="Applied → offer"
                />
              ) : null}
            </dl>
          ) : (
            <EmptyState
              compact
              icon={Send}
              title="No response times recorded"
              description="Add an application date and move an application forward to measure this."
            />
          )}
        </InsightCard>

        <InsightCard
          title="Interview preparation"
          description="Coverage of the questions you have stored"
          note={{
            definition:
              "Answered counts questions where you wrote an answer; practised counts questions you flagged as rehearsed. They are reported separately on purpose.",
            formula:
              "practisedRate = practised ÷ total × 100",
          }}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/interviews">Open practice</Link>
            </Button>
          }
        >
          {prep.total > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">Rehearsed</span>
                  <span className="tabular-nums text-muted-foreground">
                    {prep.practiced} / {prep.total} ({prep.practicedRate}%)
                  </span>
                </div>
                <Progress value={prep.practicedRate} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {prep.answered} {prep.answered === 1 ? "answer" : "answers"} written
                </Badge>
                <Badge variant="secondary">
                  {prep.total - prep.practiced} still to rehearse
                </Badge>
              </div>
              <ul className="space-y-2 text-sm">
                {prep.byCategory
                  .filter((row) => row.total > 0)
                  .map((row) => (
                    <li
                      key={row.category}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="tabular-nums">
                        {row.practiced} / {row.total}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              compact
              icon={MessagesSquare}
              title="No practice questions yet"
              description="Generate questions for a job and they will be summarised here."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/interviews">Generate questions</Link>
                </Button>
              }
            />
          )}
        </InsightCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Jobs saved" value={summary.totalJobs} icon={Briefcase} />
        <StatCard
          label="Jobs scored"
          value={summary.analyzedJobs}
          icon={FileCheck2}
          hint="Have at least one match report"
        />
        <StatCard
          label="Interviews reached"
          value={summary.interviews}
          icon={MessagesSquare}
          hint="Current status is interview"
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

