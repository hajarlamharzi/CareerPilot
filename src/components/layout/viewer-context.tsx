"use client";

import * as React from "react";

import type { Role } from "@/lib/auth/roles";

/**
 * Who is looking at the app, made available to the client shell.
 *
 * A context rather than a prop chain because the sidebar, the mobile drawer and
 * the top bar all need it, and none of them owns it: the values come from the
 * server layout, which read the session.
 *
 * **Display state only.** It decides which links are visible and which name is
 * shown; it must never be the basis of an authorisation decision. Every page,
 * route handler and tool re-checks permissions server-side via
 * `requirePermission` / `can`, because a browser context is trivially forgeable.
 */
export interface Viewer {
  mode: "cloud" | "local";
  isAuthenticated: boolean;
  email: string | null;
  fullName: string | null;
  roles: readonly Role[];
}

const LOCAL_VIEWER: Viewer = {
  mode: "local",
  isAuthenticated: false,
  email: null,
  fullName: null,
  roles: [],
};

const ViewerContext = React.createContext<Viewer>(LOCAL_VIEWER);

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: React.ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  return React.useContext(ViewerContext);
}

/** Two initials for the avatar, falling back to the e-mail, then to `CP`. */
export function initialsFor(viewer: Viewer): string {
  const source = viewer.fullName?.trim() || viewer.email?.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return "CP";
}
