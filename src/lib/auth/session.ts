import "server-only";

import { cache } from "react";

import { AppError, forbidden, unauthenticated } from "@/lib/auth/errors";
import {
  can,
  isAdmin,
  toRoles,
  type Permission,
  type Role,
} from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Which data backend this process is serving.
 *
 * - `cloud`  — Supabase is configured: real accounts, real PostgreSQL, RLS on.
 * - `local`  — no backend configured: the original single-user browser workspace
 *              ("mode démo local"). Clearly labelled in the UI; no administration,
 *              no shared data, and the AI routes run without a user identity.
 */
export type DataMode = "cloud" | "local";

export interface SessionUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  roles: Role[];
  fullName: string | null;
  avatarUrl: string | null;
}

export interface Session {
  mode: DataMode;
  /** `null` in local demo mode, or for a signed-out visitor. */
  user: SessionUser | null;
  /** The visitor is a *real*, Supabase-authenticated account. */
  isAuthenticated: boolean;
}

export const getDataMode = (): DataMode =>
  isSupabaseConfigured ? "cloud" : "local";

/**
 * Resolve the current session.
 *
 * Wrapped in React `cache` so a Server Component tree or a route handler that
 * calls it five times still performs a single `auth.getUser()` round-trip.
 *
 * Uses `auth.getUser()` (which validates the JWT against the Auth server)
 * rather than `getSession()` (which merely decodes a cookie), because only the
 * former is safe to authorise on.
 */
export const getSession = cache(async (): Promise<Session> => {
  const mode = getDataMode();
  const supabase = await createServerSupabase();

  if (!supabase) {
    return { mode: "local", user: null, isAuthenticated: false };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { mode, user: null, isAuthenticated: false };
  }

  const [rolesResult, profileResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const roles = toRoles((rolesResult.data ?? []).map((row) => row.role));

  return {
    mode,
    isAuthenticated: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      emailVerified: Boolean(user.email_confirmed_at ?? user.confirmed_at),
      // A signed-in account with no explicit role row is still a candidate:
      // registration assigns the role, and the database default is `candidate`.
      roles: roles.length > 0 ? roles : ["candidate"],
      fullName: profileResult.data?.full_name ?? null,
      avatarUrl: profileResult.data?.avatar_url ?? null,
    },
  };
});

export interface Principal {
  mode: DataMode;
  /** `null` in local demo mode. */
  userId: string | null;
  roles: Role[];
  email: string | null;
  /** `false` in local demo mode: there is no verified identity behind it. */
  isAuthenticated: boolean;
  isAdmin: boolean;
}

function toPrincipal(session: Session): Principal {
  if (session.user) {
    return {
      mode: session.mode,
      userId: session.user.id,
      roles: session.user.roles,
      email: session.user.email,
      isAuthenticated: true,
      isAdmin: isAdmin(session.user.roles),
    };
  }
  return {
    mode: session.mode,
    userId: null,
    // In local demo mode the single browser user holds the candidate capability
    // set. It is explicitly *not* authentication: `isAuthenticated` stays false,
    // no administration permission is ever granted, and the UI says so.
    roles: session.mode === "local" ? ["candidate"] : [],
    email: null,
    isAuthenticated: false,
    isAdmin: false,
  };
}

/** The current principal, without enforcing anything. */
export async function getPrincipal(): Promise<Principal> {
  return toPrincipal(await getSession());
}

/**
 * Require a signed-in Supabase account.
 *
 * Always throws in local demo mode: code that truly needs an identity (writing a
 * row owned by a user, granting a role, listing another account's data) must not
 * silently operate on a shared local workspace.
 */
export async function requireAuthenticatedUser(): Promise<
  SessionUser & { principal: Principal }
> {
  const session = await getSession();

  if (session.mode === "local") {
    throw new AppError(
      "not_configured",
      "Cette action nécessite un compte. Supabase (authentification) n'est pas configuré sur ce déploiement.",
    );
  }
  if (!session.user) {
    throw unauthenticated();
  }

  return { ...session.user, principal: toPrincipal(session) };
}

/** Require a permission. Denies by default, for unknown callers too. */
export async function requirePermission(
  permission: Permission,
): Promise<Principal> {
  const principal = await getPrincipal();

  if (!can(principal.roles, permission)) {
    if (!principal.isAuthenticated) throw unauthenticated();
    throw forbidden(
      `Permission manquante : ${permission}. Demandez à un administrateur si vous pensez qu'il s'agit d'une erreur.`,
    );
  }

  return principal;
}

/** Require an administrator. Never satisfiable in local demo mode. */
export async function requireAdmin(): Promise<Principal> {
  return requirePermission("admin:dashboard:read");
}

/** `true` when the principal may use the administration area at all. */
export async function canAccessAdmin(): Promise<boolean> {
  const principal = await getPrincipal();
  return isAdmin(principal.roles);
}
