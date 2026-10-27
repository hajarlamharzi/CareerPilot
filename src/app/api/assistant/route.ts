import { unauthenticated, invalidInput, notConfigured } from "@/lib/auth/errors";
import { withErrorHandling } from "@/lib/auth/errors";
import { getPrincipal } from "@/lib/auth/session";
import { runAgent } from "@/lib/ai/agent";
import { appendMessage, listConversations, resolveConversation } from "@/lib/ai/conversations";
import { getAiStatus } from "@/lib/ai";
import { assistantSystemFor } from "@/lib/ai/prompts";
import { actorKeyFor, enforceRateLimit } from "@/lib/ai/rate-limit";
import {
  assistantRequestSchema,
  buildToolContext,
  extractSearchKeywords,
  toSnapshot,
} from "@/lib/ai/request";
import { withUsageLogging } from "@/lib/ai/usage";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Assistant endpoint.
 *
 * `runtime = "nodejs"` is required, not cosmetic: confirmation tokens are signed
 * with `node:crypto`, and the Supabase server client relies on Node APIs. The
 * Edge runtime would silently lose a piece of the security model.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 2 MB is far more than a workspace snapshot needs, and stops a memory bomb. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * GET — deployment status and the caller's recent conversations.
 *
 * The UI calls this first so it can either show the composer or explain exactly
 * which environment variable is missing, instead of offering a button that can
 * only fail.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const principal = await getPrincipal();
  const status = getAiStatus();

  const url = new URL(request.url);
  const wantsConversations = url.searchParams.get("conversations") === "1";

  let conversations: Awaited<ReturnType<typeof listConversations>> = [];
  if (wantsConversations && principal.isAuthenticated && principal.userId) {
    const supabase = await createServerSupabase();
    conversations = await listConversations(supabase, principal.userId);
  }

  return Response.json({
    configured: status.configured,
    provider: status.provider,
    providerLabel: status.providerLabel,
    model: status.model,
    keyUrl: status.keyUrl,
    quotaNote: status.quotaNote,
    reason: status.reason,
    mode: principal.mode,
    authenticated: principal.isAuthenticated,
    roles: principal.roles,
    conversations,
  });
});

/**
 * POST — one assistant turn.
 *
 * Order of operations matters and is not arbitrary:
 *
 *   1. authenticate (in cloud mode an anonymous caller is refused outright);
 *   2. confirm the AI provider is configured, with an actionable message;
 *   3. read the body under a size cap and validate it;
 *   4. rate-limit *after* validation, so garbage does not consume the budget;
 *   5. run the agent;
 *   6. persist the two messages, best-effort.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const principal = await getPrincipal();

  if (principal.mode === "cloud" && !principal.isAuthenticated) {
    throw unauthenticated("Connectez-vous pour utiliser l'assistant.");
  }

  const status = getAiStatus();
  if (!status.configured) {
    throw notConfigured(status.reason ?? undefined);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw invalidInput("La requête envoyée est trop volumineuse.");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw invalidInput("Le corps de la requête doit être un JSON valide.");
  }

  const parsed = assistantRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw invalidInput(
      "Votre message n'a pas pu être traité.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  enforceRateLimit(actorKeyFor(request, principal.userId));

  const { message, history, conversationId: requestedConversationId } = parsed.data;

  // In cloud mode a client-supplied snapshot is ignored: the tools read the
  // caller's real rows through their RLS-bound client. Only an unauthenticated
  // local-demo caller may contribute local data.
  const snapshot = principal.isAuthenticated ? null : toSnapshot(parsed.data.snapshot);

  const supabase = principal.isAuthenticated ? await createServerSupabase() : null;

  const conversationId =
    principal.isAuthenticated && principal.userId
      ? await resolveConversation(supabase, principal.userId, requestedConversationId, message)
      : null;

  if (principal.userId) {
    await appendMessage(supabase, principal.userId, conversationId, "user", message);
  }

  const toolContext = await buildToolContext({
    principal,
    snapshot,
    keywords: extractSearchKeywords(message),
    signal: request.signal,
  });

  const result = await withUsageLogging(
    supabase,
    principal.userId,
    { feature: "assistant", provider: status.provider, model: status.model },
    () =>
      runAgent({
        // Role-adaptive instruction: the same conversation surface serves
        // candidates and administrators differently. Permissions are still
        // enforced per tool, server-side — this only shapes behaviour.
        systemInstruction: assistantSystemFor(principal.roles),
        history,
        userMessage: message,
        toolContext,
      }),
  );

  if (principal.userId) {
    await appendMessage(supabase, principal.userId, conversationId, "assistant", result.text, {
      toolTrace: result.artifacts.toolTrace,
      jobIds: result.artifacts.jobCards.map((card) => card.id),
      steps: result.steps,
    });
  }

  return Response.json({
    conversationId,
    text: result.text,
    blocked: result.blocked,
    blockReason: result.blockReason,
    artifacts: result.artifacts,
    usage: result.usage,
    provider: result.provider,
    model: result.model,
    steps: result.steps,
  });
});
