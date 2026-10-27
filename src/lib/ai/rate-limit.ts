import "server-only";

import { AppError } from "@/lib/auth/errors";
import { AI_RATE_LIMIT_MAX, AI_RATE_LIMIT_WINDOW_SECONDS } from "@/lib/env";

/**
 * A small fixed-window rate limiter for the AI endpoints.
 *
 * Honest description of what this is: an **in-process** limiter. On a
 * single-instance deployment (or a long-lived Node server) it is accurate. On
 * Vercel's serverless runtime each instance keeps its own counters, so the
 * effective global limit is `AI_RATE_LIMIT_MAX × instances`. It still does the
 * job it exists for — it stops one user (or one buggy effect) from burning a
 * provider quota — while the hard ceiling on spend remains the provider's own
 * quota and the token limits per request.
 *
 * A distributed limiter would need shared state. The natural upgrade is a
 * `ai_usage_logs` count query, and the code below is deliberately shaped so that
 * swap is a single function replacement: `countRecentRequests()`.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Drop expired windows so a long-lived process does not grow unbounded. */
function sweep(now: number): void {
  if (windows.size < 500) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

/**
 * Record an attempt and report whether it is allowed.
 *
 * @param actorKey Stable per-actor key. Use the user id when authenticated and a
 *   coarse IP-derived key otherwise. It is hashed before use so no IP address is
 *   retained in memory.
 */
export function checkRateLimit(
  actorKey: string,
  limit = AI_RATE_LIMIT_MAX,
  windowSeconds = AI_RATE_LIMIT_WINDOW_SECONDS,
  now = Date.now(),
): RateLimitResult {
  sweep(now);

  const key = `${limit}:${actorKey}`;
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1_000 });
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      retryAfterSeconds: windowSeconds,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
  };
}

/** Throwing wrapper for route handlers. */
export function enforceRateLimit(actorKey: string): RateLimitResult {
  const result = checkRateLimit(actorKey);
  if (!result.allowed) {
    throw new AppError(
      "rate_limited",
      `Vous avez atteint la limite de ${result.limit} requêtes IA. ` +
        `Réessayez dans ${result.retryAfterSeconds} seconde(s).`,
    );
  }
  return result;
}

/**
 * Hash a coarse client identifier.
 *
 * The raw address is never stored: it is hashed with the action-signing secret
 * so the map key is stable for the life of the process but is not a readable IP.
 */
export function actorKeyFor(request: Request, userId: string | null): string {
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  // Coarse, non-reversible-enough: only the first two octets of an IPv4 address
  // (or the whole IPv6 /64 prefix) participate, which is what an abuse limiter
  // needs and what a privacy review can accept.
  const coarse = address.includes(":")
    ? address.split(":").slice(0, 4).join(":")
    : address.split(".").slice(0, 2).join(".");

  return `anon:${coarse}`;
}

/** Exposed for tests. */
export const __testing = { windows };
