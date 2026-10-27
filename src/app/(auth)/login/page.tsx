import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalModePanel } from "@/features/auth/components/local-mode-panel";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Connexion" };

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const linkFailed = params.error === "link";

  // Someone already signed in has nothing to do on this page.
  const session = await getSession();
  if (session.isAuthenticated) {
    redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }

  // Without a Supabase project a login form can never succeed, so show the
  // explanation and the demo entry point instead of a dead-end form.
  if (!isSupabaseConfigured) {
    return (
      <LocalModePanel
        title="La connexion"
        description="Vous pouvez utiliser tout l'espace de travail en mode démo local, sans compte."
      />
    );
  }

  return (
    <>
      {linkFailed ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          Ce lien de confirmation ou de réinitialisation a expiré ou a déjà été
          utilisé. Reconnectez-vous, ou demandez un nouveau lien.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>
            Accédez à votre espace de recherche d&apos;emploi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <a
              href="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Créer un compte
            </a>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
