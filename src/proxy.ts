import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Proxy (formerly `middleware` in Next.js ≤ 15).
 *
 * Two jobs, and only two:
 *
 *  1. Refresh the Supabase auth cookie so a long-lived session does not silently
 *     expire between page loads. This is the *only* place a rotated token can be
 *     written back, because Server Components cannot set cookies during render.
 *
 *  2. Give signed-out visitors a fast redirect to `/login` instead of rendering
 *     a protected shell that will bounce them anyway.
 *
 * It is deliberately **not** the authorisation layer. Next.js' own guidance is
 * explicit that a matcher change can silently remove proxy coverage, so every
 * protected page, Server Function and Route Handler re-checks the session
 * server-side (`requirePermission`). Proxy is a convenience, not a control.
 *
 * In local demo mode (no Supabase configured) it is a no-op passthrough, so the
 * original browser-storage workspace keeps working untouched.
 */

/** Paths that require a signed-in account in cloud mode. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/jobs",
  "/cv",
  "/match",
  "/applications",
  "/interviews",
  "/analytics",
  "/assistant",
  "/roadmap",
  "/find-jobs",
  "/saved-jobs",
  "/onboarding",
  "/profile",
  "/settings",
  "/admin",
] as const;

/** Paths a signed-in user should not see (they are already authenticated). */
const AUTH_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
] as const;

const isUnder = (pathname: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Local demo mode: nothing to refresh, nothing to protect.
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: `getUser()` must be called here. Removing it causes sessions to
  // expire unpredictably because nothing refreshes the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // API routes authenticate themselves and must return JSON, never a redirect.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (!user && isUnder(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // `next` is validated again server-side against an allow-list of local paths.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && isUnder(pathname, AUTH_PAGES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. `/api/*` is
     * matched on purpose so the session cookie is refreshed for API calls too;
     * the handler returns early for those paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
