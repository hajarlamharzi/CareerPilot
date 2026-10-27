import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalModePanel } from "@/features/auth/components/local-mode-panel";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  if (!isSupabaseConfigured) {
    return (
      <LocalModePanel
        title="Le changement de mot de passe"
        description="Aucun compte n'existe sur ce déploiement, il n'y a donc pas de mot de passe à modifier."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choisir un nouveau mot de passe</CardTitle>
        <CardDescription>
          Le lien de réinitialisation ouvre une session temporaire : vous pouvez
          définir un nouveau mot de passe sans ressaisir l&apos;ancien.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Lien expiré ?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Demander un nouveau lien
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
