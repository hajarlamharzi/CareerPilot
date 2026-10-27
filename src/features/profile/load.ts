import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfileUpdateInput } from "./schemas";

/**
 * Read the signed-in user's own profile.
 *
 * Returns `null` when there is no row yet (a brand-new account whose trigger has
 * not run, or a failed read) — the form then renders empty rather than throwing,
 * and saving creates nothing it cannot update. The column names are mapped to the
 * form's names here so the UI never has to know the database spelling.
 */
export async function loadOwnProfile(
  userId: string,
): Promise<ProfileUpdateInput | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "full_name, headline, location, phone, website_url, linkedin_url, github_url, bio",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    fullName: data.full_name ?? "",
    headline: data.headline ?? "",
    location: data.location ?? "",
    phone: data.phone ?? "",
    websiteUrl: data.website_url ?? "",
    linkedinUrl: data.linkedin_url ?? "",
    githubUrl: data.github_url ?? "",
    bio: data.bio ?? "",
  };
}
