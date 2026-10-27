import { invalidInput, notConfigured, unauthenticated, withErrorHandling } from "@/lib/auth/errors";
import { getPrincipal } from "@/lib/auth/session";
import { verifyConfirmationToken } from "@/lib/ai/confirmations";
import { getAiStatus } from "@/lib/ai";
import { actorKeyFor, enforceRateLimit } from "@/lib/ai/rate-limit";
import { buildToolContext, confirmRequestSchema, toSnapshot } from "@/lib/ai/request";
import { recordAiUsage } from "@/lib/ai/usage";
import { executeTool } from "@/lib/ai/tools";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Confirm a data-changing assistant action.
 *
 * This is the second half of the flow described in `confirmations.ts`. The
 * essential property: **the arguments were fixed before the user was asked**. The
 * token carries the validated arguments and a signature the model cannot produce,
 * so nothing the model says — and nothing the client sets — can change what gets
 * written between the prompt and the click.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (request: Request) => {
  const principal = await getPrincipal();

  if (principal.mode === "cloud" && !principal.isAuthenticated) {
    throw unauthenticated("Connectez-vous pour confirmer cette action.");
  }

  const status = getAiStatus();
  if (!status.configured) {
    throw notConfigured(status.reason ?? undefined);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw invalidInput("Le corps de la requête doit être un JSON valide.");
  }

  const parsed = confirmRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw invalidInput("Confirmation invalide.");
  }

  enforceRateLimit(actorKeyFor(request, principal.userId));

  const supabase = principal.isAuthenticated ? await createServerSupabase() : null;

  // --- Verified account: the token is the authority --------------------------
  if (principal.isAuthenticated && principal.userId) {
    if (!parsed.data.confirmationId) {
      throw invalidInput("Jeton de confirmation manquant.");
    }

    // Throws for a forged, expired or foreign token.
    const action = verifyConfirmationToken(parsed.data.confirmationId, principal.userId);

    const toolContext = await buildToolContext({
      principal,
      snapshot: null,
      keywords: [],
    });

    const outcome = await executeTool(action.tool, action.args, toolContext, {
      confirmed: true,
    });

    await recordAiUsage(supabase, principal.userId, {
      feature: "assistant",
      status: outcome.kind === "error" ? "error" : "success",
      provider: status.provider,
      model: status.model,
      errorCode: outcome.kind === "error" ? outcome.code : null,
    });

    return Response.json({ tool: action.tool, outcome });
  }

  // --- Local demo mode ------------------------------------------------------
  // There is no identity to sign for, and the browser already asked the user to
  // click. The server still re-validates the arguments against the tool's own
  // schema and re-checks the permission, and every write tool resolves to a
  // `client_action` — a change the browser applies to its own local workspace.
  // Nothing here can reach the database: `supabase` is null and the principal is
  // unauthenticated.
  if (!parsed.data.tool) {
    throw invalidInput("Aucune action à confirmer.");
  }

  const toolContext = await buildToolContext({
    principal,
    snapshot: toSnapshot(parsed.data.snapshot),
    keywords: [],
  });

  const outcome = await executeTool(parsed.data.tool, parsed.data.args, toolContext, {
    confirmed: true,
  });

  // A local caller is unauthenticated, so nothing was written anywhere.
  return Response.json({ tool: parsed.data.tool, outcome });
});
