import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { APP_REPO_URL } from "@/config/app";
import { isSupabaseConfigured } from "@/lib/env";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm lg:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 surface-grid opacity-30"
          />
          <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {isSupabaseConfigured
                  ? "Créez un compte, ou explorez la démo"
                  : "Créez un compte, ou explorez sans inscription"}
              </h2>
              <p className="text-muted-foreground">
                {isSupabaseConfigured
                  ? "Inscrivez-vous pour un espace personnel synchronisé (offres, CV, candidatures), ou ouvrez la démo avec des données d'exemple — sans compte."
                  : "Ouvrez l'espace de travail avec des offres, un CV et des candidatures d'exemple, puis personnalisez-le. Tout est conservé dans votre navigateur ; la création de compte s'active dès que Supabase est configuré."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
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
          </div>
        </div>
      </div>
    </section>
  );
}
