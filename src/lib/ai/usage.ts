import "server-only";

import { redactForLogging } from "./safety";
import type { AiFeature, TokenUsage } from "./types";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * AI usage telemetry.
 *
 * What is recorded: which feature ran, against which provider and model, whether
 * it succeeded, how long it took, and a short error code. What is **never**
 * recorded: prompt text, CV content, job descriptions, message bodies, API keys,
 * or e-mail addresses — `redactForLogging` is the last line of defence for the
 * error code field, and nothing else is passed in.
 *
 * Logging is best-effort by design. A telemetry insert must never turn a working
 * answer into a failure, so every write is wrapped and a failure is only warned
 * about. Aggregates from this table are what the admin dashboard reports, and the
 * dashboard labels them as "since logging was enabled" rather than pretending to
 * have complete history.
 */

export type UsageStatus = "success" | "error" | "rate_limited" | "not_configured";

export interface UsageEntry {
  feature: AiFeature;
  status: UsageStatus;
  provider?: string | null;
  model?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  usage?: TokenUsage;
}

/**
 * Persist one usage row.
 *
 * `userId` may be `null` for a system-level event (for example: "the AI provider
 * is not configured"). RLS allows a signed-in user to insert *only* their own
 * row, so passing somebody else's id simply fails — which is the desired
 * behaviour.
 */
export async function recordAiUsage(
  supabase: ServerSupabaseClient | null,
  userId: string | null,
  entry: UsageEntry,
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from("ai_usage_logs").insert({
      user_id: userId,
      provider: entry.provider ?? null,
      model: entry.model ?? null,
      feature: entry.feature,
      status: entry.status,
      duration_ms: entry.durationMs ?? null,
      error_code: entry.errorCode ? redactForLogging(entry.errorCode, 120) : null,
    });
  } catch (error) {
    console.warn(
      "[careerpilot] could not record AI usage:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

/**
 * Run `operation`, timing it and recording the outcome.
 *
 * Every AI feature goes through this helper, which is what guarantees the
 * dashboard has consistent data without each feature re-implementing logging.
 */
export async function withUsageLogging<T>(
  supabase: ServerSupabaseClient | null,
  userId: string | null,
  context: { feature: AiFeature; provider: string | null; model: string | null },
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    await recordAiUsage(supabase, userId, {
      feature: context.feature,
      status: "success",
      provider: context.provider,
      model: context.model,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "unknown";

    await recordAiUsage(supabase, userId, {
      feature: context.feature,
      status: code === "rate_limited" ? "rate_limited" : code === "not_configured" ? "not_configured" : "error",
      provider: context.provider,
      model: context.model,
      durationMs: Date.now() - startedAt,
      errorCode: code,
    });
    throw error;
  }
}
