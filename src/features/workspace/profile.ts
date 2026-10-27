import { workspaceStore } from "@/lib/storage";
import type { CandidateProfile } from "@/types";

/** The workspace owner's profile, stored alongside everything else locally. */

export function readProfile(): CandidateProfile | null {
  return workspaceStore.read("profile");
}

/**
 * Merge a partial update into the stored profile and stamp `updatedAt`. Returns
 * `null` when there is no profile to update (storage unavailable and unseeded).
 */
export function updateProfile(
  patch: Partial<Omit<CandidateProfile, "id" | "updatedAt">>,
): CandidateProfile | null {
  const current = readProfile();
  if (!current) return null;
  const next: CandidateProfile = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  workspaceStore.set("profile", next);
  return next;
}
