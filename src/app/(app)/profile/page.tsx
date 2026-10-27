import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ProfileView } from "@/components/profile/profile-view";
import { getSession } from "@/lib/auth/session";
import { loadOwnProfile } from "@/features/profile/load";

export const metadata: Metadata = {
  title: "Profil",
  description:
    "Vos coordonnées et votre présentation : elles alimentent le calcul d'adéquation et vos documents.",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();

  // Read on the server so the form is filled on first paint: no loading flash,
  // and the values come from the database rather than from a background request
  // the browser could tamper with before rendering.
  const initialProfile =
    session.mode === "cloud" && session.user
      ? await loadOwnProfile(session.user.id)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil"
        description="Votre présentation et vos coordonnées. Elles servent au calcul d'adéquation et à la rédaction de vos documents, et ne sont jamais publiées."
      />
      <ProfileView
        mode={session.mode}
        initialProfile={initialProfile}
        account={{
          email: session.user?.email ?? null,
          roles: session.user?.roles ?? [],
        }}
      />
    </div>
  );
}
