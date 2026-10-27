import "server-only";

import {
  AI_MODEL_ID,
  AI_PROVIDER_ID,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/env";

/**
 * Server-only environment access.
 *
 * The `server-only` import makes the bundler fail the build if a Client
 * Component ever imports this module, which is the guard that keeps the
 * service-role key and the AI API key out of the browser bundle.
 */

/** Service-role/secret key. Only the trusted bootstrap script and imports use it. */
export const SUPABASE_SERVICE_ROLE_KEY: string | null =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

export const SUPABASE_SECRET_KEY: string | null =
  process.env.SUPABASE_SECRET_KEY?.trim() || null;

/** The privileged key, if any. Treated as extremely sensitive. */
export const SUPABASE_ADMIN_KEY: string | null =
  SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SECRET_KEY;

/**
 * `true` only when a thoroughly privileged server-side Supabase client can be
 * built. Administrator operations that must bypass RLS check this flag and fail
 * loudly (rather than silently doing nothing) when it is missing.
 */
export const isSupabaseAdminConfigured: boolean = Boolean(
  SUPABASE_URL && SUPABASE_ADMIN_KEY,
);

/** AI API key for the configured provider. */
export const AI_API_KEY: string | null =
  process.env.AI_API_KEY?.trim() || null;

/**
 * Adzuna job-search credentials (https://developer.adzuna.com).
 *
 * Server-only, like the AI key: these must never appear in a `NEXT_PUBLIC_`
 * variable or in any client bundle. Without them the Adzuna source reports
 * itself disabled and live search falls back to the keyless Jobicy source.
 */
export const ADZUNA_APP_ID: string | null =
  process.env.ADZUNA_APP_ID?.trim() || null;

export const ADZUNA_APP_KEY: string | null =
  process.env.ADZUNA_APP_KEY?.trim() || null;

/** `true` when both Adzuna credentials are present. */
export const isAdzunaConfigured: boolean = Boolean(
  ADZUNA_APP_ID && ADZUNA_APP_KEY,
);

/**
 * Signing secret for AI action confirmations (`src/lib/ai/confirmations.ts`).
 *
 * Required in production and on any deployment with more than one instance:
 * without it, each process signs with its own random key and a confirmation
 * dialog that lands on a different instance fails. Generate one with
 * `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
 */
export const ACTION_SIGNING_SECRET: string | null =
  process.env.ACTION_SIGNING_SECRET?.trim() || null;

/** `true` when an AI provider, key and model are all usable. */
export const isAiConfigured: boolean = Boolean(
  AI_PROVIDER_ID && AI_API_KEY,
);

export const aiConfig: {
  provider: "gemini" | "openrouter" | null;
  apiKey: string | null;
  model: string | null;
} = {
  provider: AI_PROVIDER_ID,
  apiKey: AI_API_KEY,
  model: AI_MODEL_ID,
};

/** Re-exported so server modules have a single import site. */
export {
  AI_MODEL_ID,
  AI_PROVIDER_ID,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
};

/**
 * Human-readable summary of what is (not) configured. Rendered in the
 * administration overview and in configuration error messages, so it must never
 * contain key material.
 */
export function describeConfiguration(): {
  database: "supabase" | "local-demo";
  privilegedAccess: boolean;
  ai: string;
} {
  return {
    database: isSupabaseConfigured ? "supabase" : "local-demo",
    privilegedAccess: isSupabaseAdminConfigured,
    ai: isAiConfigured
      ? `${AI_PROVIDER_ID}${AI_MODEL_ID ? ` (${AI_MODEL_ID})` : ""}`
      : "not configured",
  };
}
