import { z } from "zod";

import { invalidInput, withErrorHandling } from "@/lib/auth/errors";
import { getPrincipal } from "@/lib/auth/session";
import { checkRateLimit, actorKeyFor } from "@/lib/ai/rate-limit";
import { searchLiveJobs } from "@/lib/jobs/live/search-service";
import { EMPLOYMENT_TYPES, SENIORITIES } from "@/config/constants";

/**
 * Live job search endpoint.
 *
 * `GET /api/jobs/search?q=…&country=FR&…`
 *
 * Design constraints:
 *  - **Node runtime** — the adapters read server-only credentials and use
 *    `AbortSignal.timeout`, which the Edge runtime handles inconsistently.
 *  - **No LLM anywhere in this path.** Ordinary keyword search must work
 *    without an AI key: this route never touches the AI layer.
 *  - **Validation before rate-limiting**, so malformed requests do not consume
 *    the caller's budget.
 *  - **Per-source honesty**: a disabled or failing provider is reported as
 *    such; it never fabricates results and never blocks the other sources.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** In-process limiter, same rationale as the AI endpoints. */
const SEARCH_RATE_LIMIT_MAX = 30;
const SEARCH_RATE_LIMIT_WINDOW_SECONDS = 60;

const stringList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[];
    const parts = Array.isArray(value) ? value : [value];
    return parts
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 10);
  });

const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Code pays ISO sur deux lettres (ex. FR, MA).")
    .optional()
    .transform((value) => (value ? value.toUpperCase() : null)),
  location: z.string().trim().max(120).optional().default("").transform((v) => v || null),
  remote: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .default("0")
    .transform((value) => value === "1" || value === "true"),
  types: stringList,
  seniority: z
    .enum([...SENIORITIES] as [string, ...string[]])
    .optional()
    .transform((value) => value ?? null),
  minSalary: z.coerce.number().int().min(0).max(10_000_000).optional().default(0).transform((v) => (v > 0 ? v : null)),
  withinDays: z.coerce.number().int().min(1).max(365).optional().default(0).transform((v) => (v > 0 ? v : null)),
  page: z.coerce.number().int().min(1).max(20).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(25).optional().default(12),
  source: z.string().trim().max(80).optional().default("").transform((v) =>
    v
      ? v.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean).slice(0, 4)
      : undefined,
  ),
});

export const GET = withErrorHandling(async (request: Request) => {
  const principal = await getPrincipal();

  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = searchQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    throw invalidInput(
      "Paramètres de recherche invalides.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const limit = checkRateLimit(
    actorKeyFor(request, principal.userId),
    SEARCH_RATE_LIMIT_MAX,
    SEARCH_RATE_LIMIT_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return Response.json(
      {
        error: "rate_limited",
        message: `Trop de recherches. Réessayez dans ${limit.retryAfterSeconds} s.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const data = parsed.data;

  const result = await searchLiveJobs({
    keywords: data.q
      ? data.q.split(/\s+/).map((entry) => entry.trim()).filter(Boolean)
      : [],
    country: data.country,
    location: data.location,
    remote: data.remote,
    employmentTypes: data.types.filter((type): type is (typeof EMPLOYMENT_TYPES)[number] =>
      (EMPLOYMENT_TYPES as readonly string[]).includes(type),
    ),
    seniority: data.seniority as (typeof SENIORITIES)[number] | null,
    minSalary: data.minSalary,
    withinDays: data.withinDays,
    page: data.page,
    pageSize: data.pageSize,
    sourceIds: data.source,
  });

  return Response.json({
    jobs: result.items,
    sources: result.sources,
    total: result.total,
    duplicatesRemoved: result.duplicatesRemoved,
    irrelevantRemoved: result.irrelevantRemoved,
    fetchedAt: result.fetchedAt,
    allCached: result.allCached,
    page: data.page,
    pageSize: data.pageSize,
    rateLimit: {
      remaining: limit.remaining,
      limit: limit.limit,
    },
  });
});
