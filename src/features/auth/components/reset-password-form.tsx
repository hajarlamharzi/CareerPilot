"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/features/auth/actions";
import { INITIAL_AUTH_STATE } from "@/features/auth/types";

import { AuthAlert, AuthField, AuthSubmit } from "./form-parts";

/**
 * Rendered after the visitor follows a recovery link.
 *
 * `/auth/callback` exchanges the one-time code for a session before this page
 * loads, so the action only has to call `updateUser`.
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <AuthAlert state={state} />

      <AuthField
        name="password"
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        errors={state.fieldErrors.password}
        hint="Au moins 8 caractères, dont une lettre et un chiffre."
      />
      <AuthField
        name="confirmPassword"
        label="Confirmer le nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors.confirmPassword}
      />

      <AuthSubmit pending={pending} pendingLabel="Enregistrement…">
        Enregistrer le nouveau mot de passe
      </AuthSubmit>
    </form>
  );
}
