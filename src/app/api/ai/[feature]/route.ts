import { z } from "zod";

import { invalidInput, notConfigured, unauthenticated, withErrorHandling } from "@/lib/auth/errors";
import { getPrincipal } from "@/lib/auth/session";
import { getAiStatus } from "@/lib/ai";
import { runAgent } from "@/lib/ai/agent";
import { FEATURES, buildFeaturePrompt, isRequestableFeature } from "@/lib/ai/features";
import { actorKeyFor, enforceRateLimit } from "@/lib/ai/rate-limit";
import { buildToolContext, toSnapshot, workspaceSnapshotSchema } from "@/lib/ai/request";
import { withUsageLogging } from "@/lib/ai/usage";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Single-shot AI features: `/api/ai/cv-coach`, `/api/ai/cover-letter`,
 * `/api/ai/interview`, `/api/ai/skill-gap`, `/api/ai/roadmap`,
 * `/api/ai/application-email`.
 *
 * One handler for all six, because they differ only in their prompt: the
 * authorisation, rate limiting, fencing, logging and error mapping are identical
 * and should not be able to drift apart per feature.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  jobId: z.string().trim().max(160).nullish().transform((value) => value || null),
  cvText: z.string().trim().max(20_000).nullish().transform((value) => value || null),
  language: z.enum(["fr", "en"]).default("fr"),
  tone: z.enum(["sobre", "direct", "enthousiaste"]).default("sobre"),
  extraInstructions: z.string().trim().max(600).nullish().transform((value) => value || null),
  snapshot: workspaceSnapshotSchema.nullish().transform((value) => value ?? null),
});

export const POST = withErrorHandling(
  async (request: Request, context: { params: Promise<{ feature: string }> }) => {
    const { feature } = await context.params;

    if (!isRequestableFeature(feature)) {
      throw invalidInput(
        `Fonctionnalité IA inconnue : « ${feature} ». Valeurs acceptées : cv-coach, cover-letter, interview, skill-gap, roadmap, application-email.`,
      );
    }

    const principal = await getPrincipal();
    if (principal.mode === "cloud" && !principal.isAuthenticated) {
      throw unauthenticated("Connectez-vous pour utiliser les fonctions IA.");
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

    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) {
      throw invalidInput("Requête invalide.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    enforceRateLimit(actorKeyFor(request, principal.userId));

    const definition = FEATURES[feature];

    const toolContext = await buildToolContext({
      principal,
      // Cloud callers always read their own rows; only a local-demo caller sends
      // a workspace snapshot.
      snapshot: principal.isAuthenticated ? null : toSnapshot(parsed.data.snapshot),
      keywords: [],
      signal: request.signal,
    });

    const built = await buildFeaturePrompt(feature, toolContext, {
      jobId: parsed.data.jobId,
      cvText: parsed.data.cvText,
      language: parsed.data.language,
      tone: parsed.data.tone,
      extraInstructions: parsed.data.extraInstructions,
    });

    const supabase = principal.isAuthenticated ? await createServerSupabase() : null;

    const result = await withUsageLogging(
      supabase,
      principal.userId,
      { feature: definition.id, provider: status.provider, model: status.model },
      () =>
        runAgent({
          systemInstruction: definition.systemInstruction,
          userMessage: built.prompt,
          toolContext,
          allowTools: false,
          temperature: definition.temperature,
          maxOutputTokens: definition.maxOutputTokens,
          maxSteps: 1,
        }),
    );

    return Response.json({
      feature: definition.id,
      label: definition.label,
      text: result.text,
      blocked: result.blocked,
      blockReason: result.blockReason,
      diagnostics: built.diagnostics,
      injectionWarnings: [...built.injectionWarnings, ...result.artifacts.injectionWarnings],
      usage: result.usage,
      provider: result.provider,
      model: result.model,
    });
  },
);
