"use client";

import * as React from "react";

import type { Role } from "@/lib/auth/roles";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ViewerProvider, type Viewer } from "./viewer-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  /** Signed-in account details; empty in local demo mode. */
  viewer?: Viewer;
}

const DEFAULT_VIEWER: Viewer = {
  mode: "local",
  isAuthenticated: false,
  email: null,
  fullName: null,
  roles: [],
};

export function AppShell({ children, viewer = DEFAULT_VIEWER }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <ViewerProvider viewer={viewer}>
      <TooltipProvider delayDuration={200}>
        <div className="flex min-h-dvh bg-muted/20">
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            {viewer.mode === "local" ? <DemoModeBanner /> : null}
            <main id="main-content" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </ViewerProvider>
  );
}

/**
 * Explains the local-demo mode.
 *
 * Shown because the alternative — letting somebody believe their data is saved
 * to an account — is the kind of dishonesty that wastes a user's afternoon. It
 * states exactly what is and is not available, and how to change it.
 */
function DemoModeBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200 lg:px-8"
    >
      <span className="font-semibold">Mode démo local.</span> Supabase n&apos;est
      pas configuré : vos données restent dans ce navigateur, il n&apos;y a pas de
      compte et l&apos;administration est désactivée. Ajoutez vos clés Supabase
      pour activer les comptes et la synchronisation.
    </div>
  );
}

/** Skip link rendered at the top of the app for keyboard users. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
    >
      Aller au contenu principal
    </a>
  );
}

export type { Role };
