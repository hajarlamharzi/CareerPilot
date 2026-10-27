"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/features/auth/actions";
import { INITIAL_AUTH_STATE } from "@/features/auth/types";

import { AuthAlert, AuthField, AuthSubmit } from "./form-parts";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <AuthAlert state={state} />

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
        autoComplete="current-password"
        required
        errors={state.fieldErrors.password}
      />

      <div className="text-right">
        <Link
          href="/forgot-password"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      <AuthSubmit pending={pending} pendingLabel="Connexion…">
        Se connecter
      </AuthSubmit>
    </form>
  );
}
