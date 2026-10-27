import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell, SkipLink } from "@/components/layout/app-shell";
import type { Viewer } from "@/components/layout/viewer-context";
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog";
import { getSession } from "@/lib/auth/session";

/**
 * The signed-in application shell.
 *
 * The proxy already redirects an anonymous visitor, but a proxy matcher is
 * configuration and configuration drifts — this check sits next to the data and
 * is the one that actually has to hold. It never fires in local demo mode, where
 * by definition there is no account to require.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (session.mode === "cloud" && !session.isAuthenticated) {
    redirect("/login");
  }

  const viewer: Viewer = {
    mode: session.mode,
    isAuthenticated: session.isAuthenticated,
    email: session.user?.email ?? null,
    fullName: session.user?.fullName ?? null,
    roles: session.user?.roles ?? (session.mode === "local" ? ["candidate"] : []),
  };

  return (
    <>
      <SkipLink />
      <AppShell viewer={viewer}>
        {children}
      </AppShell>
      <WelcomeDialog />
    </>
  );
}
