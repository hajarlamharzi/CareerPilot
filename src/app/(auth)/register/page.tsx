import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalModePanel } from "@/features/auth/components/local-mode-panel";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Créer un compte" };

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  const session = await getSession();
  if (session.isAuthenticated) redirect("/dashboard");

  // A sign-up form that cannot possibly succeed is worse than no form: the user
  // fills it in and only then discovers there is no backend. Explain first.
  if (!isSupabaseConfigured) {
    return (
      <LocalModePanel
        title="La création de compte"
        description="Vous pouvez utiliser tout l'espace de travail en mode démo local, sans créer de compte."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte candidat</CardTitle>
        <CardDescription>
          Votre espace est privé : profil, CV, candidatures et conversations ne
          sont visibles que par vous.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm next={next} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Vous avez déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
