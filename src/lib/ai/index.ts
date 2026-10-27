import "server-only";

import { notConfigured } from "@/lib/auth/errors";
import { AI_MODEL_ID, AI_PROVIDER_ID } from "@/lib/env";
import { AI_API_KEY } from "@/lib/env.server";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { AI_PROVIDERS, type AiProvider, type AiProviderKind } from "./types";

/**
 * The AI provider factory.
 *
 * Configuration is read once, server-side, from environment variables. There is
 * no code path that lets a browser choose a provider, a model or a key — that is
 * what keeps user-supplied prompt text from reaching an endpoint the operator
 * did not configure.
 */

export interface AiStatus {
  configured: boolean;
  provider: AiProviderKind | null;
  providerLabel: string | null;
  model: string | null;
  keyUrl: string | null;
  quotaNote: string | null;
  /** Why the feature is unavailable, when it is. Safe to display. */
  reason: string | null;
}

const NOT_CONFIGURED_GUIDANCE =
  "L'assistant IA n'est pas configuré sur ce déploiement. Ajoutez AI_PROVIDER, " +
  "AI_API_KEY et (optionnellement) AI_MODEL à vos variables d'environnement, " +
  "puis redémarrez le serveur. Toutes les autres fonctionnalités — recherche " +
  "d'offres, CV, candidatures, préparation d'entretien hors IA — restent " +
  "utilisables sans clé.";

/** Status for the UI: never includes the key, only whether it exists. */
export function getAiStatus(): AiStatus {
  if (!AI_PROVIDER_ID) {
    return {
      configured: false,
      provider: null,
      providerLabel: null,
      model: null,
      keyUrl: null,
      quotaNote: null,
      reason:
        "AI_PROVIDER n'est pas défini. Valeurs acceptées : « gemini » ou « openrouter ».",
    };
  }
  if (!AI_API_KEY) {
    const info = AI_PROVIDERS[AI_PROVIDER_ID];
    return {
      configured: false,
      provider: AI_PROVIDER_ID,
      providerLabel: info.label,
      model: AI_MODEL_ID ?? info.defaultModel,
      keyUrl: info.keyUrl,
      quotaNote: info.quotaNote,
      reason: `AI_API_KEY n'est pas défini pour ${info.label}. Créez une clé sur ${info.keyUrl}.`,
    };
  }

  const info = AI_PROVIDERS[AI_PROVIDER_ID];
  return {
    configured: true,
    provider: AI_PROVIDER_ID,
    providerLabel: info.label,
    model: AI_MODEL_ID ?? info.defaultModel,
    keyUrl: info.keyUrl,
    quotaNote: info.quotaNote,
    reason: null,
  };
}

export function isAiEnabled(): boolean {
  return getAiStatus().configured;
}

/**
 * Build the configured provider, or throw a typed configuration error.
 *
 * Throwing (rather than returning `null`) matters: a route handler that forgot
 * to check would otherwise call a method on `null`. Here it is impossible to
 * reach provider code without a provider.
 */
export function getAiProvider(): AiProvider {
  const status = getAiStatus();
  if (!status.configured || !AI_PROVIDER_ID || !AI_API_KEY) {
    throw notConfigured(status.reason ?? NOT_CONFIGURED_GUIDANCE);
  }

  const model = AI_MODEL_ID ?? AI_PROVIDERS[AI_PROVIDER_ID].defaultModel;

  switch (AI_PROVIDER_ID) {
    case "gemini":
      return new GeminiProvider(AI_API_KEY, model);
    case "openrouter":
      return new OpenRouterProvider(AI_API_KEY, model);
  }
}

export { NOT_CONFIGURED_GUIDANCE };
export * from "./types";
