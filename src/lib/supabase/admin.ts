import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "@/lib/env";
import { SUPABASE_ADMIN_KEY, isSupabaseAdminConfigured } from "@/lib/env.server";
import { AppError } from "@/lib/auth/errors";
import type { Database } from "./types";

export type AdminSupabaseClient = SupabaseClient<Database>;

let cached: AdminSupabaseClient | null = null;

/**
 * Privileged Supabase client. **Bypasses Row Level Security.**
 *
 * Reserved for the handful of operations that genuinely cannot be expressed as
 * a user-scoped query:
 *   - bootstrapping the first administrator (`scripts/create-admin.mjs` uses the
 *     same key, kept in this repo so the policy is documented in one place);
 *   - recording a role grant in `user_roles` after `evaluateRoleChange` approved
 *     it, because `user_roles` has no insert policy at all;
 *   - writing `admin_audit_logs` and platform-wide import batches.
 *
 * Reads of another user's private rows (CV content, AI conversations,
 * applications) must never use this client.
 */
export function getAdminSupabase(): AdminSupabaseClient | null {
  if (!isSupabaseAdminConfigured || !SUPABASE_URL || !SUPABASE_ADMIN_KEY) {
    return null;
  }
  cached ??= createClient<Database>(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Like `getAdminSupabase`, but throws a typed, actionable configuration error. */
export function requireAdminSupabase(): AdminSupabaseClient {
  const client = getAdminSupabase();
  if (!client) {
    throw new AppError(
      "not_configured",
      "Cette action nécessite la clé serveur SUPABASE_SERVICE_ROLE_KEY. Elle n'est pas configurée sur ce déploiement.",
    );
  }
  return client;
}
