import "server-only";

import { headers } from "next/headers";

import { APP_URL } from "@/lib/env";

/**
 * Absolute origin of the current request.
 *
 * Supabase requires an absolute `emailRedirectTo` / `redirectTo` for
 * confirmation and recovery links. Deriving it from the request means those
 * links point at the deployment the visitor is actually using — localhost, a
 * Vercel preview, or production — without a second environment variable that
 * can drift out of sync.
 *
 * `headers()` only works inside a request scope. Outside one (a script, a
 * unit test) we fall back to the configured `APP_URL`.
 */
export async function getSiteUrl(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const host =
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

    if (host) {
      const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
      const protocol =
        requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
      return `${protocol}://${host}`;
    }
  } catch {
    // Not in a request scope; fall through to the configured origin.
  }

  return APP_URL;
}
