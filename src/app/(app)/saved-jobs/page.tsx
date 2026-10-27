"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  Bookmark,
  Building2,
  Clock,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardGridSkeleton } from "@/components/shared/loading";
import {
  EMPLOYMENT_TYPE_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from "@/config/constants";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { updateJob } from "@/features/jobs/job-store";
import { createApplication } from "@/features/applications/application-store";
import { formatSalaryRange } from "@/lib/format";
import type { Job } from "@/types";

/**
 * Saved jobs — everything the user deliberately kept.
 *
 * A "saved" listing may come from the sample catalogue, the manual form, or a
 * live source imported from `/find-jobs`. The card always states where it came
 * from and, when an upstream URL exists, links to it directly; nothing here
 * pretends the listing is still open.
 */
export default function SavedJobsPage() {
  const ready = useStoreReady();
  const jobs = useWorkspaceDomain("jobs");
  const applications = useWorkspaceDomain("applications");

  const [query, setQuery] = React.useState("");

  const saved = React.useMemo(
    () =>
      (jobs ?? [])
        .filter((job) => job.status === "saved" || job.status === "shortlisted")
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [jobs],
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return saved;
    return saved.filter((job) =>
      [job.title, job.company, job.location, ...job.tags, ...job.requiredSkills]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [saved, query]);

  const applicationJobIds = React.useMemo(
    () => new Set((applications ?? []).map((app) => app.jobId).filter(Boolean)),
    [applications],
  );

  function handleArchive(job: Job) {
    updateJob(job.id, { ...job, status: "archived" });
    toast.success("Offre retirée des enregistrements", {
      description: `${job.title} — ${job.company}`,
    });
  }

  function handleApply(job: Job) {
    if (!applicationJobIds.has(job.id)) {
      createApplication({
        jobId: job.id,
        company: job.company,
        position: job.title,
        status: "interested",
        appliedAt: null,
        sourceUrl: job.sourceUrl,
        sourceName: job.sourceName,
        contact: { name: null, email: null, phone: null, role: null },
        notes: [],
        followUpAt: null,
        interviewAt: null,
        salary: job.salary,
      });
      toast.success("Ajouté aux candidatures", { description: job.title });
    } else {
      toast.info("Cette offre est déjà dans vos candidatures");
    }
  }

  if (!ready) {
    return <CardGridSkeleton count={4} className="mt-8" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres enregistrées"
        description="Vos favoris et offres importées. Ajoutez-les à vos candidatures quand vous décidez de postuler."
        actions={
          <Button asChild>
            <Link href="/find-jobs">
              <Search className="size-4" aria-hidden />
              Trouver des offres
            </Link>
          </Button>
        }
      />

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Aucune offre enregistrée"
          description="Enregistrez une offre depuis la recherche en direct ou depuis le catalogue : elle apparaîtra ici, prête à être suivie."
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/find-jobs">Rechercher des offres</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/jobs/new">
                  <Plus className="size-4" aria-hidden />
                  Ajouter manuellement
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-sm sm:flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="pl-8"
                placeholder="Filtrer par titre, entreprise, compétence…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filtrer les offres enregistrées"
              />
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filtered.length} offre(s) enregistrée(s)
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="Aucun résultat"
              description="Aucune offre enregistrée ne correspond à ce filtre."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((job) => {
                const inApplications = applicationJobIds.has(job.id);
                return (
                  <Card key={job.id} className="flex h-full flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">
                          {job.title}
                        </CardTitle>
                        <Badge variant={job.status === "shortlisted" ? "default" : "secondary"}>
                          {job.status === "shortlisted" ? "Présélectionnée" : "Enregistrée"}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-1.5">
                        <Building2 className="size-3.5 shrink-0" aria-hidden />
                        {job.company}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex grow flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden />
                          {job.location || "Localisation non précisée"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden />
                          Ajoutée le{" "}
                          {new Date(job.addedAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">{WORK_MODE_LABELS[job.workMode]}</Badge>
                        <Badge variant="outline">
                          {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                        </Badge>
                        {job.seniority ? (
                          <Badge variant="outline">{SENIORITY_LABELS[job.seniority]}</Badge>
                        ) : null}
                        {job.sourceName ? (
                          <Badge variant="secondary">{job.sourceName}</Badge>
                        ) : null}
                      </div>

                      {job.salary ? (
                        <p className="text-sm font-medium">{formatSalaryRange(job.salary)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Salaire non communiqué</p>
                      )}

                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/jobs/${job.id}`}>Voir la fiche</Link>
                        </Button>
                        {job.sourceUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={job.sourceUrl} target="_blank" rel="noreferrer noopener">
                              <ExternalLink className="size-3.5" aria-hidden />
                              Source
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={inApplications ? "ghost" : "default"}
                          onClick={() => handleApply(job)}
                          disabled={inApplications}
                        >
                          <Sparkles className="size-3.5" aria-hidden />
                          {inApplications ? "Suivie" : "Candidater"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(job)}
                          aria-label={`Retirer ${job.title} des offres enregistrées`}
                        >
                          <Archive className="size-3.5" aria-hidden />
                          Retirer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
