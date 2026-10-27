"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

import { profileUpdateSchema } from "./schemas";
import type { ProfileFormState } from "./types";

/**
 * Save the signed-in user's profile.
 *
 * A Server Action so the write happens next to the session and next to the
 * database — the browser never holds a token it could replay, and the form keeps
 * working with JavaScript disabled.
 *
 * Ownership is asserted twice on purpose: the `.eq("id", …)` predicate narrows
 * the update to one row, and the row-level-security policy independently refuses
 * any row where `auth.uid() <> id`. Either one alone would be sufficient; the
 * point is that a mistake in one does not become a cross-account write.
 */
export async function updateProfileAction(
  previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  void previousState;

  const session = await getSession();

  if (session.mode !== "cloud") {
    return {
      status: "error",
      message:
        "Enregistrer un profil nécessite un compte : Supabase n'est pas configuré sur ce déploiement.",
      fieldErrors: {},
    };
  }

  if (!session.user) {
    return {
      status: "error",
      message: "Votre session a expiré. Reconnectez-vous pour enregistrer vos modifications.",
      fieldErrors: {},
    };
  }

  const parsed = profileUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return {
      status: "error",
      message: "La base de données n'est pas joignable pour le moment.",
      fieldErrors: {},
    };
  }

  const values = parsed.data;

  // Empty inputs are stored as NULL, not as "": otherwise "no website" and "a
  // website that happens to be empty" become indistinguishable.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: values.fullName,
      headline: values.headline || null,
      location: values.location || null,
      phone: values.phone || null,
      website_url: values.websiteUrl || null,
      linkedin_url: values.linkedinUrl || null,
      github_url: values.githubUrl || null,
      bio: values.bio || null,
    })
    .eq("id", session.user.id);

  if (error) {
    return {
      status: "error",
      message: "Le profil n'a pas pu être enregistré. Réessayez dans un instant.",
      fieldErrors: {},
    };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { status: "success", message: "Profil enregistré.", fieldErrors: {} };
}
