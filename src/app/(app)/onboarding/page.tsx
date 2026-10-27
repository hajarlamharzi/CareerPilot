"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Circle,
  FileText,
  Globe2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

/**
 * Guided first-run page (the workspace dialog covers demo vs. blank; this page
 * covers "what do I do next").
 *
 * It states plainly which data is account-synced and which stays in this
 * browser, because that distinction surprises people later if it is buried in
 * the docs. A step is "done" only when the corresponding local state actually
 * exists — nothing is ticked on the user's behalf.
 */

interface Step {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ElementType;
  done: boolean;
}

export default function OnboardingPage() {
  const ready = useStoreReady();
  const profile = useWorkspaceDomain("profile");
  const cv = useWorkspaceDomain("cv");
  const jobs = useWorkspaceDomain("jobs");
  const applications = useWorkspaceDomain("applications");

  const steps: Step[] = React.useMemo(
    () => [
      {
        id: "profile",
        title: "Renseigner votre profil",
        description:
          "Nom, intitulé recherché, localisation. Cela personnalise les suggestions et le calcul d'adéquation.",
        href: "/profile",
        cta: "Ouvrir le profil",
        icon: UserRound,
        done: Boolean(profile?.headline || profile?.location),
      },
      {
        id: "cv",
        title: "Ajouter un CV",
        description:
          "Importez un PDF ou DOCX, ou partez de l'éditeur. Le CV reste dans votre navigateur et n'est jamais envoyé à un fournisseur d'offres.",
        href: "/cv",
        cta: "Gérer mes CV",
        icon: FileText,
        done: (cv?.documents.length ?? 0) > 0,
      },
      {
        id: "search",
        title: "Chercher de vraies offres",
        description:
          "Interrogez les sources publiques configurées (Adzuna, Jobicy). Chaque offre renvoie vers sa page d'origine.",
        href: "/find-jobs",
        cta: "Trouver des offres",
        icon: Globe2,
        done: (jobs?.length ?? 0) > 0,
      },
      {
        id: "save",
        title: "Enregistrer et suivre une candidature",
        description:
          "Enregistrez une offre, puis ajoutez-la à vos candidatures pour suivre les étapes jusqu'à l'entretien.",
        href: "/saved-jobs",
        cta: "Voir mes offres enregistrées",
        icon: Bookmark,
        done: (applications?.length ?? 0) > 0,
      },
      {
        id: "assistant",
        title: "Essayer l'assistant",
        description:
          "Décrivez le poste recherché : l'assistant interroge les mêmes sources que vous et cite la provenance de chaque offre, sans jamais en inventer.",
        href: "/assistant",
        cta: "Ouvrir l'assistant",
        icon: Sparkles,
        done: false,
      },
    ],
    [profile, cv, jobs, applications],
  );

  const completed = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bienvenue sur CareerPilot"
        description="Quelques étapes pour tirer le meilleur de votre espace. Vous pouvez revenir sur cette page à tout moment."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard">
              Aller au tableau de bord
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>Votre progression</span>
            <Badge variant={completed === steps.length ? "default" : "secondary"}>
              {ready ? `${completed}/${steps.length}` : "…"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Les étapes se cochent automatiquement dès que les données existent
            dans votre espace de travail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={completed}
            aria-label="Progression de l'onboarding"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card
              key={step.id}
              className={cn(
                "transition-colors",
                step.done ? "border-emerald-600/30 bg-emerald-500/[0.03]" : undefined,
              )}
            >
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      step.done
                        ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2 className="size-5" aria-hidden />
                    ) : (
                      <Icon className="size-5" aria-hidden />
                    )}
                  </span>
                  <div className="space-y-0.5">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="text-xs text-muted-foreground">
                        Étape {index + 1}
                      </span>
                      {step.title}
                      {step.done ? (
                        <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-700 dark:text-emerald-400">
                          <Circle className="size-2 fill-current" aria-hidden />
                          fait
                        </span>
                      ) : null}
                    </p>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant={step.done ? "ghost" : "outline"}
                  className="shrink-0"
                >
                  <Link href={step.href}>
                    {step.cta}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Ce qui est synchronisé, et ce qui ne l&apos;est pas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Compte :</span> adresse
            e-mail, mot de passe et rôle sont gérés par Supabase Auth. Ne partagez
            jamais votre mot de passe.
          </p>
          <p>
            <span className="font-medium text-foreground">Espace de travail :</span>{" "}
            CV, offres importées, candidatures, entretiens et rapports d&apos;adéquation
            sont stockés dans ce navigateur (IndexedDB). Ils ne sont pas encore
            synchronisés entre appareils — c&apos;est une limite documentée, pas un
            oubli.
          </p>
          <p>
            Les recherches d&apos;offres en direct interrogent des API publiques ;
            aucune donnée de votre CV ne leur est transmise.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
