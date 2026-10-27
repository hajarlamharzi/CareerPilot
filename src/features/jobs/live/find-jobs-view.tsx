"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
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
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  SENIORITIES,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from "@/config/constants";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { createJob } from "@/features/jobs/job-store";
import { createApplication } from "@/features/applications/application-store";
import { computeMatch } from "@/lib/matching/engine";
import { formatSalaryRange } from "@/lib/format";
import type { EmploymentType, Job, Seniority } from "@/types";
import type { SourceRunResult } from "@/lib/jobs/live/types";

/**
 * Find Jobs — real listings from configured public APIs.
 *
 * Honesty rules enforced here:
 *  - every card carries its source name and its *upstream* URL; the link opens
 *    the source page, never a fabricated "apply" deep link;
 *  - missing data (salary, date, work mode the source does not state) is not
 *    invented — the field is simply absent;
 *  - each provider's status (ok / disabled / skipped / error) is displayed with
 *    its real message, including missing credentials;
 *  - CV matching is opt-in, computed **in the browser**, and labelled as an
 *    estimate — the CV is never sent to a job provider or an AI model here.
 */

interface LiveResultItem {
  job: Job;
  externalId: string;
  sourceUrl: string | null;
}

interface SearchResponse {
  jobs: LiveResultItem[];
  sources: SourceRunResult[];
  total: number | null;
  duplicatesRemoved: number;
  irrelevantRemoved: number;
  fetchedAt: string;
  allCached: boolean;
  page: number;
  pageSize: number;
}

interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  requiredEnvVars: string[];
  countries: string[];
  geoFilter: "strict" | "indicative" | "none";
  remoteOnly: boolean;
  salary: boolean;
  publicationDates: boolean;
  maxResults: number;
  coverageNote: string;
}

const COUNTRIES: { code: string; label: string }[] = [
  { code: "", label: "Tous pays" },
  { code: "MA", label: "Maroc" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "NL", label: "Pays-Bas" },
  { code: "PT", label: "Portugal" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "US", label: "États-Unis" },
  { code: "EU", label: "Europe (télétravail)" },
];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function StatusIcon({ status }: { status: SourceRunResult["status"] }) {
  if (status === "ok") return <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />;
  if (status === "disabled") return <AlertTriangle className="size-3.5 text-amber-600" aria-hidden />;
  if (status === "skipped") return <Clock className="size-3.5 text-muted-foreground" aria-hidden />;
  return <XCircle className="size-3.5 text-destructive" aria-hidden />;
}

export function FindJobsView() {
  const ready = useStoreReady();
  const workspaceJobs = useWorkspaceDomain("jobs");
  const cvLibrary = useWorkspaceDomain("cv");

  const [query, setQuery] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [remote, setRemote] = React.useState(false);
  const [employmentType, setEmploymentType] = React.useState<"" | EmploymentType>("");
  const [seniority, setSeniority] = React.useState<"" | Seniority>("");
  const [minSalary, setMinSalary] = React.useState("");
  const [source, setSource] = React.useState("");
  const [sort, setSort] = React.useState<"relevance" | "date">("relevance");

  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());

  // Explicit consent before the CV participates in scoring. The computation is
  // local; nothing leaves the browser.
  const [useCv, setUseCv] = React.useState(false);

  const activeCv = React.useMemo(() => {
    if (!cvLibrary || cvLibrary.documents.length === 0) return null;
    return (
      cvLibrary.documents.find((doc) => doc.id === cvLibrary.activeId) ??
      cvLibrary.documents[0] ??
      null
    );
  }, [cvLibrary]);

  React.useEffect(() => {
    let ignore = false;
    fetch("/api/jobs/providers")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { jobs?: ProviderInfo[] } | null) => {
        if (!ignore && payload?.jobs) setProviders(payload.jobs);
      })
      .catch(() => {
        /* The status panel is informational; search errors surface separately. */
      });
    return () => {
      ignore = true;
    };
  }, []);

  const runSearch = React.useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (country) params.set("country", country);
        if (location.trim()) params.set("location", location.trim());
        if (remote) params.set("remote", "1");
        if (employmentType) params.set("types", employmentType);
        if (seniority) params.set("seniority", seniority);
        if (minSalary && Number(minSalary) > 0) params.set("minSalary", minSalary);
        if (source) params.set("source", source);
        params.set("page", String(targetPage));
        params.set("pageSize", "12");

        const response = await fetch(`/api/jobs/search?${params.toString()}`);
        const payload = (await response.json()) as SearchResponse & {
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message ?? "La recherche a échoué.");
        }
        setResults(payload);
        setPage(targetPage);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de contacter les sources d'offres.",
        );
        setResults(null);
      } finally {
        setLoading(false);
      }
    },
    [query, country, location, remote, employmentType, seniority, minSalary, source],
  );

  /** Persist a live listing into the local workspace, deduplicating by URL. */
  function importJob(job: Job): Job {
    const existing = (workspaceJobs ?? []).find(
      (candidate) => job.sourceUrl && candidate.sourceUrl === job.sourceUrl,
    );
    if (existing) return existing;

    const draft: import("@/features/jobs/job-store").NewJob = {
      ...job,
      status: "saved",
    };
    delete (draft as { id?: string }).id;
    const created = createJob(draft);
    setSavedIds((current) => new Set(current).add(job.id));
    return created;
  }

  function handleSave(job: Job) {
    importJob(job);
    toast.success("Offre enregistrée", {
      description: `${job.title} — ${job.company}`,
    });
  }

  function handleAddToApplications(job: Job) {
    const stored = importJob(job);
    createApplication({
      jobId: stored.id,
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
    toast.success("Ajouté aux candidatures", {
      description: `${job.title} — statut « Intéressé »`,
    });
  }

  const sortedJobs = React.useMemo(() => {
    const items = [...(results?.jobs ?? [])];
    if (sort === "date") {
      items.sort((a, b) => {
        const aTime = a.job.publishedAt ? Date.parse(a.job.publishedAt) : 0;
        const bTime = b.job.publishedAt ? Date.parse(b.job.publishedAt) : 0;
        return bTime - aTime;
      });
    }
    return items;
  }, [results, sort]);

  const scoreFor = React.useCallback(
    (job: Job): number | null => {
      if (!useCv || !activeCv) return null;
      try {
        return computeMatch({ job, cv: activeCv }).score;
      } catch {
        return null;
      }
    },
    [useCv, activeCv],
  );

  const hasResults = sortedJobs.length > 0;
  const providerConfigured = providers.filter((provider) => provider.configured).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trouver des offres"
        description="Recherche en direct dans les sources publiques configurées (Adzuna, Jobicy). Chaque offre renvoie vers sa page d'origine."
      />

      {/* Provider transparency */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="size-4 text-primary" aria-hidden />
            Sources d&apos;offres
          </CardTitle>
          <CardDescription>
            {providers.length === 0
              ? "Chargement de l'état des sources…"
              : `${providerConfigured}/${providers.length} source(s) configurée(s). Une source indisponible n'empêche pas les autres de répondre.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-lg border border-border/70 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{provider.label}</span>
                <Badge variant={provider.configured ? "secondary" : "outline"}>
                  {provider.configured ? "Configurée" : "Non configurée"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{provider.coverageNote}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Filtrage pays :{" "}
                {provider.geoFilter === "strict"
                  ? "strict"
                  : provider.geoFilter === "indicative"
                    ? "indicatif (offres multi-pays possibles)"
                    : "non disponible"}
              </p>
              {!provider.configured && provider.requiredEnvVars.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                  Variables requises : {provider.requiredEnvVars.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Search form */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch(1);
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="live-q">
                Mots-clés
              </label>
              <Input
                id="live-q"
                placeholder="Ex. Laravel, React, data engineer…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="sm:flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="size-4" aria-hidden />
                )}
                Rechercher
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-country">
                  Pays
                </label>
                <select
                  id="live-country"
                  className={selectClass}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  {COUNTRIES.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-location">
                  Ville / région
                </label>
                <Input
                  id="live-location"
                  placeholder="Rabat, Paris, Casablanca…"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-type">
                  Contrat
                </label>
                <select
                  id="live-type"
                  className={selectClass}
                  value={employmentType}
                  onChange={(event) =>
                    setEmploymentType(event.target.value as "" | EmploymentType)
                  }
                >
                  <option value="">Tous</option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EMPLOYMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-seniority">
                  Niveau
                </label>
                <select
                  id="live-seniority"
                  className={selectClass}
                  value={seniority}
                  onChange={(event) =>
                    setSeniority(event.target.value as "" | Seniority)
                  }
                >
                  <option value="">Tous</option>
                  {SENIORITIES.map((level) => (
                    <option key={level} value={level}>
                      {SENIORITY_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-source">
                  Source
                </label>
                <select
                  id="live-source"
                  className={selectClass}
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                >
                  <option value="">Toutes</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-salary">
                  Salaire min. (annuel)
                </label>
                <Input
                  id="live-salary"
                  type="number"
                  min={0}
                  placeholder="Ex. 30000"
                  value={minSalary}
                  onChange={(event) => setMinSalary(event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="live-sort">
                  Tri
                </label>
                <select
                  id="live-sort"
                  className={selectClass}
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as "relevance" | "date")
                  }
                >
                  <option value="relevance">Pertinence</option>
                  <option value="date">Plus récentes</option>
                </select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={remote}
                    onChange={(event) => setRemote(event.target.checked)}
                  />
                  Télétravail uniquement
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={useCv}
                    onChange={(event) => setUseCv(event.target.checked)}
                    disabled={!activeCv}
                  />
                  Calculer l&apos;adéquation CV
                </label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {activeCv
                ? "Adéquation calculée localement dans votre navigateur, avec votre CV actif — aucune donnée n'est envoyée à un fournisseur d'offres ou à une IA."
                : "Ajoutez un CV dans « Mes CV » pour activer le calcul d'adéquation (facultatif)."}
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="font-medium">La recherche a échoué</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Interrogation des sources en cours…
          </CardContent>
        </Card>
      ) : null}

      {!loading && results ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              {hasResults
                ? `${sortedJobs.length} offre(s) affichée(s)${results.total !== null ? ` sur ${results.total} annoncée(s) par les sources` : ""}`
                : "Aucune offre retournée"}
              {results.duplicatesRemoved > 0
                ? ` · ${results.duplicatesRemoved} doublon(s) supprimé(s)`
                : ""}
              {results.irrelevantRemoved > 0
                ? ` · ${results.irrelevantRemoved} hors sujet ignorée(s)`
                : ""}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {results.allCached ? "Résultats en cache — " : "Dernière recherche : "}
              {new Date(results.fetchedAt).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {results.allCached ? " (moins de 5 min)" : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {results.sources.map((run) => (
              <span
                key={run.sourceId}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                <StatusIcon status={run.status} />
                <span className="font-medium text-foreground">{run.sourceLabel}</span>
                <span>
                  {run.status === "ok"
                    ? `${run.resultCount} résultat(s)${run.cached ? " · cache" : ""}`
                    : run.status === "disabled"
                      ? "non configurée"
                      : run.status === "skipped"
                        ? "ignorée"
                        : run.status === "timeout"
                          ? "délai dépassé"
                          : "erreur"}
                </span>
              </span>
            ))}
          </div>

          {results.sources
            .filter((run) => run.message)
            .map((run) => (
              <p key={`${run.sourceId}-message`} className="text-xs text-muted-foreground">
                <span className="font-medium">{run.sourceLabel} :</span> {run.message}
              </p>
            ))}

          {!hasResults ? (
            <EmptyState
              icon={Search}
              title="Aucune offre ne correspond"
              description="Élargissez les mots-clés, changez de pays ou désactivez le filtre télétravail. Les sources disponibles ne couvrent peut-être pas cette zone — le message ci-dessus le précise."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedJobs.map((item) => {
                const job = item.job;
                const score = scoreFor(job);
                const alreadySaved = savedIds.has(job.id);
                return (
                  <Card key={job.id} className="flex h-full flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{job.title}</CardTitle>
                        {score !== null ? (
                          <Badge variant="secondary" title="Estimation calculée localement">
                            {score}% adéquation
                          </Badge>
                        ) : null}
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
                        {job.publishedAt ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden />
                            Publiée le{" "}
                            {new Date(job.publishedAt).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {job.workMode === "remote" ? (
                          <Badge variant="outline">{WORK_MODE_LABELS.remote}</Badge>
                        ) : null}
                        <Badge variant="outline">
                          {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                        </Badge>
                        {job.seniority ? (
                          <Badge variant="outline">{SENIORITY_LABELS[job.seniority]}</Badge>
                        ) : null}
                        <Badge variant="secondary">{job.sourceName ?? "Source externe"}</Badge>
                      </div>

                      {job.salary ? (
                        <p className="text-sm font-medium">
                          {formatSalaryRange(job.salary)}
                          {job.tags.includes("salaire:estimé") ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (estimation de la source)
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Salaire non communiqué</p>
                      )}

                      <div className="mt-auto flex flex-wrap gap-2">
                        {job.sourceUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              Voir l&apos;offre
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={alreadySaved ? "ghost" : "default"}
                          onClick={() => handleSave(job)}
                          disabled={alreadySaved || !ready}
                        >
                          {alreadySaved ? (
                            <CheckCircle2 className="size-3.5" aria-hidden />
                          ) : (
                            <Plus className="size-3.5" aria-hidden />
                          )}
                          {alreadySaved ? "Enregistrée" : "Enregistrer"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddToApplications(job)}
                          disabled={!ready}
                        >
                          <Sparkles className="size-3.5" aria-hidden />
                          Candidater
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runSearch(page - 1)}
              disabled={loading || page <= 1}
            >
              Précédent
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runSearch(page + 1)}
              disabled={loading || sortedJobs.length < 12}
            >
              <RefreshCw className="mr-1 size-3.5" aria-hidden />
              Suivant
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Les offres proviennent des API publiques de leurs sources respectives et
            peuvent avoir été pourvues depuis leur publication. Vérifiez toujours
            l&apos;offre sur le site d&apos;origine avant de candidater. Les sources
            de télétravail sont créditées avec un lien vers leur site, conformément
            à leurs conditions d&apos;utilisation.
          </p>
        </div>
      ) : null}

      {!results && !loading && !error ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Search className="mx-auto mb-2 size-5" aria-hidden />
          Lancez une recherche pour interroger les sources configurées. Les
          résultats sont de vraies offres, jamais des exemples générés.
          <div className="mt-3">
            <Button asChild variant="link" size="sm">
              <Link href="/jobs">Parcourir plutôt le catalogue enregistré</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
