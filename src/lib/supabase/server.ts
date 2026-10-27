import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { AppError } from "@/lib/auth/errors";
import type { Database } from "./types";

export type ServerSupabaseClient = SupabaseClient<Database>;

/**
 * Request-scoped Supabase client bound to the caller's cookies.
 *
 * Runs with the publishable key, so **Row Level Security applies**: this client
 * can only ever read and write rows the signed-in user is allowed to touch. Use
 * it for everything a normal request does — never reach for the admin client
 * just because a query is awkward.
 */
export async function createServerSupabase(): Promise<ServerSupabaseClient | null> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where the response headers
          // are already committed. The Proxy refreshes the session instead, so
          // nothing is lost — this is the officially documented behaviour.
        }
      },
    },
  });
}

/** Like `createServerSupabase`, but throws a typed error instead of `null`. */
export async function requireServerSupabase(): Promise<ServerSupabaseClient> {
  const client = await createServerSupabase();
  if (!client) {
    throw new AppError(
      "not_configured",
      "Supabase n'est pas configuré sur ce déploiement. Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return client;
}
