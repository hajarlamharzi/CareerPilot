"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUpAction } from "@/features/auth/actions";
import { INITIAL_AUTH_STATE } from "@/features/auth/types";

import { AuthAlert, AuthField, AuthSubmit } from "./form-parts";

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <AuthAlert state={state} />

      <AuthField
        name="fullName"
        label="Nom complet"
        autoComplete="name"
        placeholder="Amine El Idrissi"
        required
        minLength={2}
        errors={state.fieldErrors.fullName}
      />
      <AuthField
        name="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        required
        errors={state.fieldErrors.email}
      />
      <AuthField
        name="password"
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        errors={state.fieldErrors.password}
        hint="Au moins 8 caractères, dont une lettre et un chiffre."
      />
      <AuthField
        name="confirmPassword"
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors.confirmPassword}
      />

      <AuthSubmit pending={pending} pendingLabel="Création…">
        Créer mon compte
      </AuthSubmit>

      <p className="text-center text-xs text-muted-foreground">
        En créant un compte, vous acceptez que vos données soient stockées sur
        votre projet Supabase. Voir{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          la confidentialité
        </Link>
        .
      </p>
    </form>
  );
}
