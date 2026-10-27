import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

import { APP_REPO_URL } from "@/config/app";
import { isSupabaseConfigured } from "@/lib/env";
import { GithubIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppPreview } from "./app-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 surface-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-16 lg:px-6 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <Badge variant="outline" className="gap-1.5 py-1">
              <Sparkles className="size-3.5 text-primary" />
              {isSupabaseConfigured
                ? "Comptes, rôles et assistant IA inclus"
                : "Mode démo local · aucun compte requis"}
            </Badge>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
              Organisez votre recherche d&apos;emploi. Faites correspondre votre CV.
              Décrochez l&apos;entretien.
            </h1>

            <p className="max-w-xl text-pretty text-lg text-muted-foreground">
              CareerPilot est un espace de travail complet pour les chercheurs
              d&apos;emploi : collectez des offres, mesurez l&apos;adéquation de votre CV,
              générez un CV adapté aux ATS et suivez chaque candidature — le tout
              en gardant la main sur vos données.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Créer un compte
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/dashboard">
                  Essayer sans compte
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href={APP_REPO_URL} target="_blank" rel="noreferrer noopener">
                  <GithubIcon className="size-4" />
                  Code source
                </a>
              </Button>
            </div>

            {isSupabaseConfigured ? null : (
              <p className="max-w-xl text-sm text-muted-foreground">
                Ce déploiement tourne en <strong>mode démo local</strong> : les
                pages de connexion et d&apos;inscription sont visibles, mais la
                création de compte s&apos;activera dès que{" "}
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
                seront renseignés (voir <code className="text-xs">.env.example</code>).
              </p>
            )}

            <dl className="grid max-w-lg grid-cols-2 gap-4 pt-2 sm:grid-cols-3">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Local by default
                </dt>
                <dd className="mt-1 text-sm">
                  Data lives in your browser storage.
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  No API key needed
                </dt>
                <dd className="mt-1 text-sm">
                  Core features work entirely offline.
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Bring your own model
                </dt>
                <dd className="mt-1 text-sm">
                  Optional Gemini or OpenRouter.
                </dd>
              </div>
            </dl>
          </div>

          <AppPreview />
        </div>
      </div>
    </section>
  );
}
