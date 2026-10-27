import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { LocalModePanel } from "@/features/auth/components/local-mode-panel";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured) {
    return (
      <LocalModePanel
        title="La réinitialisation de mot de passe"
        description="Sans compte à réinitialiser, un formulaire d'envoi de lien n'aurait aucun effet."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Indiquez l&apos;adresse de votre compte : nous vous enverrons un lien
          pour choisir un nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
