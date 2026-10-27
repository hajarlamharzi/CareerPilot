import { providerError } from "@/lib/auth/errors";
import {
  AI_PROVIDERS,
  type AiProvider,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatRole,
  type TokenUsage,
  type ToolCallRequest,
} from "../types";

/**
 * Google Gemini adapter (`generativelanguage.googleapis.com/v1beta`).
 *
 * Points of care:
 *
 *  * The API key travels in the `x-goog-api-key` header, never in the URL, so it
 *    cannot end up in a proxy access log or a referrer.
 *  * A failed upstream response is translated into a fixed French message. The
 *    provider's raw body is *not* forwarded to the client and never contains the
 *    key, but it can echo parts of the prompt.
 *  * `blockReason` from `promptFeedback` is surfaced honestly as a refusal rather
 *    than being reported as an empty answer.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 60_000;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: {
    content?: { role?: string; parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

function toContents(messages: readonly ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    const role: GeminiContent["role"] =
      message.role === "assistant" ? "model" : "user";

    const parts: GeminiPart[] = [];

    if (message.content.trim().length > 0) {
      parts.push({ text: message.content });
    }

    if (message.toolCalls) {
      for (const call of message.toolCalls) {
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      }
    }

    if (message.role === "tool") {
      parts.push({
        functionResponse: {
          name: message.toolName ?? message.toolCallId ?? "tool",
          response: parseToolResult(message.content),
        },
      });
    }

    if (parts.length === 0) continue;

    // Gemini rejects two consecutive turns with the same role, so merge.
    const previous = contents.at(-1);
    if (previous && previous.role === role) {
      previous.parts.push(...parts);
      continue;
    }
    contents.push({ role, parts });
  }

  return contents;
}

/** A tool result is stored as JSON text; fall back to a text field if not. */
function parseToolResult(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: content };
  }
}

function mapFinishReason(
  raw: string | undefined,
  hasToolCalls: boolean,
): ChatResponse["finishReason"] {
  if (hasToolCalls) return "tool_calls";
  switch (raw) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "PROHIBITED_CONTENT":
    case "BLOCKLIST":
      return "blocked";
    default:
      return raw ? "other" : "stop";
  }
}

function toUsage(raw: GeminiResponse["usageMetadata"]): TokenUsage {
  return {
    inputTokens: raw?.promptTokenCount ?? null,
    outputTokens: raw?.candidatesTokenCount ?? null,
  };
}

export class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly model: string;
  readonly #apiKey: string;

  constructor(apiKey: string, model: string) {
    this.#apiKey = apiKey;
    this.model = model || AI_PROVIDERS.gemini.defaultModel;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      contents: toContents(request.messages),
      generationConfig: {
        temperature: request.temperature ?? 0.35,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
      },
    };

    if (request.systemInstruction) {
      body.systemInstruction = { parts: [{ text: request.systemInstruction }] };
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = [{ functionDeclarations: request.tools }];
    }

    const signal = combineSignals(request.signal, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.#apiKey,
          },
          body: JSON.stringify(body),
          signal,
        },
      );
    } catch (error) {
      throw providerError(
        "Impossible de joindre Google Gemini. Vérifiez votre connexion réseau puis réessayez.",
        error,
      );
    }

    if (!response.ok) {
      throw providerError(describeUpstreamFailure(response.status));
    }

    let payload: GeminiResponse;
    try {
      payload = (await response.json()) as GeminiResponse;
    } catch (error) {
      throw providerError(
        "La réponse de Google Gemini n'a pas pu être lue (format inattendu).",
        error,
      );
    }

    const blocked = payload.promptFeedback?.blockReason;
    const candidate = payload.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const toolCalls: ToolCallRequest[] = [];
    let text = "";

    parts.forEach((part, index) => {
      if (typeof part.text === "string") text += part.text;
      if (part.functionCall?.name) {
        toolCalls.push({
          // Gemini assigns no call id; a deterministic one keeps the pairing
          // stable when the result travels back on the next turn.
          id: `gemini_${index}_${part.functionCall.name}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    });

    return {
      text: text.trim(),
      toolCalls,
      finishReason: blocked ? "blocked" : mapFinishReason(candidate?.finishReason, toolCalls.length > 0),
      usage: toUsage(payload.usageMetadata),
      model: this.model,
      blockReason: blocked ? describeBlock(blocked) : null,
    };
  }
}

function describeBlock(reason: string): string {
  switch (reason) {
    case "SAFETY":
      return "La requête a été bloquée par les filtres de sécurité de Google.";
    case "RECITATION":
      return "La réponse a été bloquée car elle reproduisait trop fidèlement un contenu existant.";
    case "PROHIBITED_CONTENT":
      return "La requête porte sur un contenu interdit par le fournisseur.";
    case "BLOCKLIST":
      return "La requête contient un terme figurant sur la liste de blocage du fournisseur.";
    default:
      return "Le fournisseur a refusé de traiter cette requête.";
  }
}

function describeUpstreamFailure(status: number): string {
  if (status === 400) {
    return "Google Gemini a rejeté la requête (requête invalide). Vérifiez le modèle configuré dans AI_MODEL.";
  }
  if (status === 401 || status === 403) {
    return "La clé AI_API_KEY n'est pas acceptée par Google Gemini. Vérifiez la clé et les restrictions du projet Google Cloud.";
  }
  if (status === 404) {
    return "Le modèle demandé n'existe pas pour cette clé Gemini. Corrigez AI_MODEL.";
  }
  if (status === 429) {
    return "Quota Google Gemini atteint. Patientez ou changez de modèle, puis réessayez.";
  }
  if (status >= 500) {
    return "Google Gemini est momentanément indisponible. Réessayez dans quelques instants.";
  }
  return `Google Gemini a répondu avec le statut ${status}.`;
}

/**
 * Compose the caller's abort signal with a hard timeout.
 *
 * `AbortSignal.any` keeps whichever fires first, so a user who closes the panel
 * cancels the upstream request immediately while a hung provider still cannot
 * hold a serverless invocation open indefinitely.
 */
export function combineSignals(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Exposed for tests: verify role merging without any network access. */
export const __testing = { toContents, mapFinishReason, describeBlock };

export type { ChatRole };
