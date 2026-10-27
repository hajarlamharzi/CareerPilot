/**
 * Public (client-safe) environment access.
 *
 * Nothing in this module may read a secret: Next.js inlines every
 * `NEXT_PUBLIC_*` reference into the browser bundle, so a value read here is
 * effectively public. Server-only secrets live in `env.server.ts`, which is
 * guarded by the `server-only` marker package.
 */

/** Supabase project URL, or `null` when the project is not configured. */
export const SUPABASE_URL: string | null =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;

/**
 * Supabase publishable ("anon") key. Modern projects issue
 * `sb_publishable_…` tokens; older ones issue a JWT anon key. Both work.
 */
export const SUPABASE_PUBLISHABLE_KEY: string | null =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  null;

/**
 * `true` when a Supabase project is configured.
 *
 * When `false`, CareerPilot runs in **local demo mode**: the original
 * browser-storage workspace, no remote accounts, and the administration area
 * disabled. This is an explicit, clearly-labelled fallback — not a substitute
 * for authentication in production.
 */
export const isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

/** Selected AI provider id, or `null` when unset/unknown. */
export const AI_PROVIDER_ID: "gemini" | "openrouter" | null = (() => {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  return raw === "gemini" || raw === "openrouter" ? raw : null;
})();

/**
 * Configured model id. Read on the server only — the client never needs it,
 * and exposing it would leak nothing useful but adds no value either.
 */
export const AI_MODEL_ID: string | null = process.env.AI_MODEL?.trim() || null;

/** Where the app is reachable, used for OpenRouter attribution headers. */
export const APP_URL: string =
  process.env.AI_APP_URL?.trim() || "http://localhost:3000";

export const AI_RATE_LIMIT_MAX: number = toPositiveInt(
  process.env.AI_RATE_LIMIT_MAX,
  20,
);

export const AI_RATE_LIMIT_WINDOW_SECONDS: number = toPositiveInt(
  process.env.AI_RATE_LIMIT_WINDOW_SECONDS,
  300,
);

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
