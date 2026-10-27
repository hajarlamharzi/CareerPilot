"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Briefcase,
  CalendarClock,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  MessagesSquare,
  Pencil,
  RotateCcw,
  Scale,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeAnalyticsSummary } from "@/features/analytics/summary";
import { formatDate, formatDayRelative } from "@/lib/format";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import {
  APPLICATION_STATUS_LABELS,
} from "@/config/constants";
import type { ActivityType } from "@/types";

const ACTIVITY_ICONS: Record<ActivityType, typeof Briefcase> = {
  "job-added": Briefcase,
  "job-imported": Briefcase,
  "job-updated": Pencil,
  "job-deleted": Trash2,
  "cv-uploaded": FileText,
  "cv-updated": FileText,
  "cv-generated": Sparkles,
  "match-run": Scale,
  "application-added": Send,
  "application-status": Send,
  "application-note": StickyNote,
  "interview-saved": MessagesSquare,
  "data-imported": Download,
  "data-exported": Download,
  "workspace-reset": RotateCcw,
};

export default function DashboardPage() {
  const ready = useStoreReady();
  const jobs = useWorkspaceDomain("jobs");
  const applications = useWorkspaceDomain("applications");
  const matches = useWorkspaceDomain("matches");
  const cv = useWorkspaceDomain("cv");
  const activity = useWorkspaceDomain("activity");
  const meta = useWorkspaceDomain("meta");

  const summary = useMemo(
    () =>
      computeAnalyticsSummary({
        jobs: jobs ?? [],
        applications: applications ?? [],
        matches: matches ?? [],
        interviews: [],
        cv,
      }),
    [jobs, applications, matches, cv],
  );

  const upcomingDeadlines = useMemo(
    () =>
      (jobs ?? [])
        .filter(
          (job) =>
            job.deadline &&
            job.deadline >= new Date().toISOString().slice(0, 10),
        )
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
        .slice(0, 3),
    [jobs],
  );

  const upcomingFollowUps = useMemo(
    () =>
      (applications ?? [])
        .filter((app) => app.followUpAt)
        .sort((a, b) => (a.followUpAt ?? "").localeCompare(b.followUpAt ?? ""))
        .slice(0, 3),
    [applications],
  );

  if (!ready) return <PageSkeleton />;

  const hasContent =
    (jobs?.length ?? 0) > 0 || (applications?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description={
          meta?.workspaceMode === "demo"
            ? "Vous explorez l'espace de démonstration. Réinitialisez-le ou créez le vôtre depuis les Paramètres."
            : "Votre recherche d'emploi en un coup d'œil — candidatures, adéquations, entretiens et échéances."
        }
      />

      {!hasContent && (
        <EmptyState
          icon={LayoutDashboard}
          title="Bienvenue dans votre espace de travail"
          description="Suivez des offres, comparez-les à votre CV et gérez vos candidatures — le tout stocké en privé dans votre navigateur."
          action={
            <Button asChild>
              <Link href="/jobs/new">
                <Briefcase className="size-4" aria-hidden />
                Ajouter votre première offre
              </Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Offres suivies"
          value={summary.totalJobs}
          hint={`${summary.analyzedJobs} comparées à votre CV`}
          icon={Briefcase}
        />
        <StatCard
          label="Candidatures actives"
          value={summary.activeApplications}
          hint={`${summary.totalApplications} au total · ${summary.responseRate} % de taux de réponse`}
          icon={Send}
        />
        <StatCard
          label="Entretiens"
          value={summary.interviews}
          hint={`${summary.offerRate} % de taux d'offres`}
          icon={MessagesSquare}
        />
        <StatCard
          label="Adéquation moyenne"
          value={
            summary.averageMatchScore === null
              ? "—"
              : `${summary.averageMatchScore} %`
          }
          hint="Dernier score déterministe par offre"
          icon={Gauge}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline</CardTitle>
            <CardDescription>
              Candidatures par étape, dans l&apos;ordre du pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.totalApplications === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune candidature pour l&apos;instant — suivez-en une depuis la page d&apos;une offre.
              </p>
            ) : (
              <ul className="space-y-2">
                {summary.applicationsByStatus
                  .filter((row) => row.count > 0)
                  .map((row) => (
                    <li key={row.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{APPLICATION_STATUS_LABELS[row.status]}</span>
                        <span className="font-medium tabular-nums">
                          {row.count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={"h-full rounded-full " + (row.count === summary.totalApplications ? "bg-primary" : "bg-primary/70")}
                          style={{
                            width: `${Math.round(
                              (row.count / summary.totalApplications) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            )}

            {summary.topRequestedSkills.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-sm font-medium">
                  Compétences les plus demandées par vos offres suivies
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.topRequestedSkills.slice(0, 6).map((skill) => (
                    <Badge key={skill.skill} variant="outline">
                      {skill.skill} · {skill.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-primary" aria-hidden />
                Échéances
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune échéance à venir.
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcomingDeadlines.map((job) => (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="group flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate font-medium group-hover:text-primary">
                          {job.title}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDayRelative(job.deadline)}
                        </span>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {job.company}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="size-4 text-primary" aria-hidden />
                Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingFollowUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No scheduled follow-ups.
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcomingFollowUps.map((app) => (
                    <li key={app.id} className="text-sm">
                      <p className="font-medium">
                        {app.position}{" "}
                        <span className="font-normal text-muted-foreground">
                          at {app.company}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Follow up {formatDayRelative(app.followUpAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {(activity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Actions you take across the app will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {(activity ?? []).slice(0, 8).map((event) => {
                  const Icon =
                    ACTIVITY_ICONS[event.type] ?? StickyNote;
                  return (
                    <li key={event.id} className="flex gap-3 text-sm">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="leading-snug text-foreground">
                          {event.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(event.at, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/jobs/new">
                <Briefcase className="size-4" aria-hidden />
                Add a job
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/match">
                <Scale className="size-4" aria-hidden />
                Score a match
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/cv/builder">
                <FileText className="size-4" aria-hidden />
                Open CV builder
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/applications">
                <Send className="size-4" aria-hidden />
                View applications
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}