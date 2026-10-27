"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";

import { getSiteUrl } from "@/lib/auth/site-url";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "./schemas";
import type { AuthFormState } from "./types";

/**
 * Account actions.
 *
 * Every action runs on the server and re-validates its own input: a form's
 * client-side attributes are a convenience, never a control. Supabase errors
 * are translated into French here so the UI never renders a raw provider string
 * (which is also the only place account existence could leak).
 */

const NETWORK_ERROR =
  "Le service d'authentification n'a pas répondu. Vérifiez votre connexion et réessayez.";

const GENERIC_ERROR = "L'opération a échoué. Réessayez dans un instant.";

const NOT_CONFIGURED: AuthFormState = {
  status: "error",
  message:
    "L'authentification n'est pas configurée sur ce déploiement. Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  fieldErrors: {},
};

function invalid(error: ZodError): AuthFormState {
  return {
    status: "error",
    message: "Vérifiez les champs signalés.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

function failure(message: string): AuthFormState {
  return { status: "error", message, fieldErrors: {} };
}

/**
 * Only same-origin relative paths are accepted as a post-login destination.
 * `//evil.example` is a protocol-relative URL and would be an open redirect.
 */
function safeNext(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/** Map a Supabase message onto something a candidate can act on. */
function translateAuthError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirmez d'abord votre adresse e-mail : ouvrez le lien reçu dans votre boîte de réception.";
  }
  if (
    text.includes("already registered") ||
    text.includes("already been registered")
  ) {
    return "Un compte existe déjà avec cette adresse e-mail.";
  }
  if (text.includes("security purposes") || text.includes("rate limit")) {
    return "Trop de tentatives en peu de temps. Patientez quelques instants avant de réessayer.";
  }
  if (text.includes("unable to validate email address")) {
    return "Le fournisseur d'authentification refuse cette adresse e-mail.";
  }
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "Les inscriptions sont désactivées sur ce projet Supabase.";
  }
  if (
    text.includes("password") &&
    (text.includes("least") || text.includes("weak"))
  ) {
    return "Ce mot de passe est refusé : choisissez-en un plus long.";
  }
  if (
    text.includes("token") &&
    (text.includes("expired") || text.includes("invalid"))
  ) {
    return "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.";
  }
  if (text.includes("same password")) {
    return "Choisissez un mot de passe différent de l'ancien.";
  }

  return GENERIC_ERROR;
}

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return failure(translateAuthError(error.message));
  } catch {
    return failure(NETWORK_ERROR);
  }

  redirect(safeNext(parsed.data.next, "/dashboard"));
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const destination = safeNext(parsed.data.next, "/dashboard");
  const siteUrl = await getSiteUrl();

  let hasSession = false;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        // The database trigger `on_auth_user_created` reads this to seed the
        // profile row, so the candidate never retypes their name.
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(destination)}`,
      },
    });
    if (error) return failure(translateAuthError(error.message));
    hasSession = Boolean(data.session);
  } catch {
    return failure(NETWORK_ERROR);
  }

  // A session comes back only when e-mail confirmation is disabled on the
  // project. Otherwise the account exists but cannot be used yet — say so
  // instead of bouncing the user to a page that would reject them.
  if (!hasSession) {
    return {
      status: "success",
      message: `Compte créé. Un e-mail de confirmation a été envoyé à ${parsed.data.email}. Ouvrez le lien qu'il contient pour activer votre compte.`,
      fieldErrors: {},
    };
  }

  redirect(destination);
}

export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = requestPasswordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;

  const siteUrl = await getSiteUrl();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      },
    );
    if (error) return failure(translateAuthError(error.message));
  } catch {
    return failure(NETWORK_ERROR);
  }

  // Identical answer whether or not the address exists: reporting "no such
  // account" here would turn the form into an account-existence oracle.
  return {
    status: "success",
    message:
      "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient de lui être envoyé. Pensez à vérifier vos courriers indésirables.",
    fieldErrors: {},
  };
}

export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createServerSupabase();
  if (!supabase) return NOT_CONFIGURED;

  try {
    // The recovery link put a temporary session in place, so `updateUser`
    // applies to the account that owns it. Without that session there is
    // nothing to update and the visitor must request a fresh link.
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return failure(
        "Ce lien de réinitialisation a expiré ou a déjà servi. Demandez-en un nouveau depuis « Mot de passe oublié ».",
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) return failure(translateAuthError(error.message));
  } catch {
    return failure(NETWORK_ERROR);
  }

  redirect("/dashboard?passwordUpdated=1");
}

/**
 * Sign out. Used directly as a `<form action>` so it works without JavaScript.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  try {
    await supabase?.auth.signOut();
  } catch {
    // A failed revocation must not trap the user in a signed-in shell; the
    // session cookies are cleared client-side by Supabase regardless.
  }
  redirect("/login");
}
