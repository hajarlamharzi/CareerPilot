import { providerError } from "@/lib/auth/errors";
import { APP_URL } from "@/lib/env";
import {
  AI_PROVIDERS,
  type AiProvider,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type TokenUsage,
  type ToolCallRequest,
} from "../types";
import { combineSignals } from "./gemini";

/**
 * OpenRouter adapter (OpenAI-compatible `chat/completions`).
 *
 * Same care as the Gemini adapter: the key only ever travels in an
 * `Authorization` header, upstream errors become fixed French messages, and
 * conversation content is never logged.
 *
 * `HTTP-Referer` and `X-Title` are the attribution headers OpenRouter asks for;
 * they only carry the app name and the configured `AI_APP_URL`.
 */

const API_BASE = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 90_000;

interface OpenRouterToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
}

interface OpenRouterResponse {
  choices?: {
    message?: OpenRouterMessage;
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
}

function toMessages(messages: readonly ChatMessage[]): OpenRouterMessage[] {
  return messages.map((message) => {
    const mapped: OpenRouterMessage = {
      role: message.role,
      content: message.content.length > 0 ? message.content : null,
    };

    if (message.role === "tool" && message.toolCallId) {
      mapped.tool_call_id = message.toolCallId;
      if (mapped.content === null) mapped.content = "";
    }

    if (message.toolCalls && message.toolCalls.length > 0) {
      mapped.tool_calls = message.toolCalls.map((call) => ({
        id: call.id,
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      }));
    }

    return mapped;
  });
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    // A truncated or malformed argument blob is a model failure, not a crash:
    // the tool registry rejects the unknown arguments and the agent retries.
    return { __malformed: raw.slice(0, 500) };
  }
}

function mapFinishReason(
  raw: string | undefined,
  hasToolCalls: boolean,
): ChatResponse["finishReason"] {
  if (hasToolCalls || raw === "tool_calls") return "tool_calls";
  switch (raw) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "blocked";
    default:
      return raw ? "other" : "stop";
  }
}

function toUsage(raw: OpenRouterResponse["usage"]): TokenUsage {
  return {
    inputTokens: raw?.prompt_tokens ?? null,
    outputTokens: raw?.completion_tokens ?? null,
  };
}

export class OpenRouterProvider implements AiProvider {
  readonly id = "openrouter" as const;
  readonly model: string;
  readonly #apiKey: string;

  constructor(apiKey: string, model: string) {
    this.#apiKey = apiKey;
    this.model = model || AI_PROVIDERS.openrouter.defaultModel;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = toMessages(request.messages);

    if (request.systemInstruction) {
      messages.unshift({ role: "system", content: request.systemInstruction });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: request.temperature ?? 0.35,
      max_tokens: request.maxOutputTokens ?? 2048,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const signal = combineSignals(request.signal, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.#apiKey}`,
          "HTTP-Referer": APP_URL,
          "X-Title": "CareerPilot",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw providerError(
        "Impossible de joindre OpenRouter. Vérifiez votre connexion réseau puis réessayez.",
        error,
      );
    }

    if (!response.ok) {
      throw providerError(describeUpstreamFailure(response.status));
    }

    let payload: OpenRouterResponse;
    try {
      payload = (await response.json()) as OpenRouterResponse;
    } catch (error) {
      throw providerError(
        "La réponse d'OpenRouter n'a pas pu être lue (format inattendu).",
        error,
      );
    }

    if (payload.error) {
      throw providerError(
        `OpenRouter a signalé une erreur : ${payload.error.message ?? "cause inconnue"}.`,
      );
    }

    const choice = payload.choices?.[0];
    const message = choice?.message;

    const toolCalls: ToolCallRequest[] = (message?.tool_calls ?? [])
      .filter((call) => Boolean(call.function?.name))
      .map((call, index) => ({
        id: call.id ?? `openrouter_${index}_${call.function?.name ?? "tool"}`,
        name: call.function?.name ?? "unknown",
        arguments: parseArguments(call.function?.arguments),
      }));

    return {
      text: (message?.content ?? "").trim(),
      toolCalls,
      finishReason: mapFinishReason(choice?.finish_reason, toolCalls.length > 0),
      usage: toUsage(payload.usage),
      model: this.model,
      blockReason:
        choice?.finish_reason === "content_filter"
          ? "La réponse a été filtrée par OpenRouter."
          : null,
    };
  }
}

function describeUpstreamFailure(status: number): string {
  if (status === 400) {
    return "OpenRouter a rejeté la requête. Vérifiez le modèle configuré dans AI_MODEL.";
  }
  if (status === 401) {
    return "La clé AI_API_KEY n'est pas acceptée par OpenRouter. Vérifiez la clé.";
  }
  if (status === 402) {
    return "Le crédit OpenRouter est insuffisant pour ce modèle. Choisissez un modèle gratuit ou rechargez le compte.";
  }
  if (status === 403) {
    return "Ce modèle est refusé pour la clé OpenRouter utilisée (modération ou restriction de compte).";
  }
  if (status === 429) {
    return "Quota OpenRouter atteint (trop de requêtes). Patientez puis réessayez.";
  }
  if (status >= 500) {
    return "OpenRouter ou le modèle amont est momentanément indisponible. Réessayez dans quelques instants.";
  }
  return `OpenRouter a répondu avec le statut ${status}.`;
}

export const __testing = { toMessages, parseArguments, mapFinishReason };
