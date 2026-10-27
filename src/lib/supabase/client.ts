"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./types";

export type BrowserSupabaseClient = SupabaseClient<Database>;

let cached: BrowserSupabaseClient | null = null;

/**
 * Browser Supabase client (publishable key only).
 *
 * Returns `null` in local demo mode so callers must explicitly handle the
 * "no backend configured" case instead of crashing. The session is stored in
 * cookies — not `localStorage` — by `@supabase/ssr`, which is what lets the
 * server and the client agree on who is signed in.
 */
export function getBrowserSupabase(): BrowserSupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  cached ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return cached;
}
