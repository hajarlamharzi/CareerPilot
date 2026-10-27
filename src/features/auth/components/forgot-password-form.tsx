"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordResetAction } from "@/features/auth/actions";
import { INITIAL_AUTH_STATE } from "@/features/auth/types";

import { AuthAlert, AuthField, AuthSubmit } from "./form-parts";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    INITIAL_AUTH_STATE,
  );

  const sent = state.status === "success";

  return (
    <form action={formAction} className="space-y-4">
      <AuthAlert state={state} />

      <AuthField
        name="email"
        label="Adresse e-mail du compte"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        required
        errors={state.fieldErrors.email}
      />

      <AuthSubmit pending={pending} pendingLabel="Envoi…">
        Envoyer le lien de réinitialisation
      </AuthSubmit>

      {sent ? (
        <p className="text-center text-xs text-muted-foreground">
          Vous n&apos;avez rien reçu ? Vérifiez les courriers indésirables, puis{" "}
          <Link href="/forgot-password" className="underline underline-offset-2">
            réessayez
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
