/**
 * Provider-neutral AI contracts.
 *
 * The application never talks to Gemini or OpenRouter directly: it talks to an
 * `AiProvider`. Swapping providers, or running with none at all, is therefore a
 * configuration change rather than a refactor.
 *
 * Everything here is transport-shaped on purpose (messages in, text + tool calls
 * out) so both a Google `generateContent` body and an OpenAI-compatible
 * `chat/completions` body can be produced from the same request.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCallRequest {
  /** Provider-assigned id, echoed back when the tool result is returned. */
  id: string;
  name: string;
  /** Raw arguments as produced by the model. Validated before any use. */
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /**
   * Tool results are keyed by the call they answer.
   *
   * Google pairs a `functionResponse` with an earlier `functionCall` by *name*,
   * OpenAI pairs it by `tool_call_id`. Both are carried so neither adapter has
   * to guess.
   */
  toolCallId?: string;
  toolName?: string;
  /** Assistant messages may carry the calls they want executed. */
  toolCalls?: ToolCallRequest[];
}

/** JSON Schema fragment describing one tool parameter. */
export interface ToolParameterSchema {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
}

export interface ChatRequest {
  /** Provider-specific model id. */
  model: string;
  messages: ChatMessage[];
  /** Delivered out-of-band: Google has a dedicated field, OpenAI a system turn. */
  systemInstruction?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Aborts the upstream HTTP request. */
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ChatResponse {
  text: string;
  toolCalls: ToolCallRequest[];
  finishReason: "stop" | "tool_calls" | "length" | "blocked" | "other";
  usage: TokenUsage;
  /** Provider model actually used, when it differs from the request. */
  model: string;
  /** Plain-text reason when `finishReason` is `blocked`. */
  blockReason: string | null;
}

export interface AiProvider {
  readonly id: AiProviderKind;
  /** The model this instance will use for every request. */
  readonly model: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

export type AiProviderKind = "gemini" | "openrouter";

export interface AiProviderInfo {
  kind: AiProviderKind;
  label: string;
  /** Default model when `AI_MODEL` is not set. */
  defaultModel: string;
  /** API key console, shown in configuration guidance. */
  keyUrl: string;
  /** A short note about quota/limits the user should know about. */
  quotaNote: string;
}

export const AI_PROVIDERS: Record<AiProviderKind, AiProviderInfo> = {
  gemini: {
    kind: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/app/apikey",
    quotaNote:
      "Le palier gratuit de Google AI Studio applique des limites de requêtes par minute et par jour.",
  },
  openrouter: {
    kind: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemini-2.0-flash-001",
    keyUrl: "https://openrouter.ai/keys",
    quotaNote:
      "OpenRouter facture à l'usage selon le modèle choisi ; certains modèles offrent un quota gratuit limité.",
  },
};

/** Which product feature issued an AI request. Recorded in `ai_usage_logs`. */
export type AiFeature =
  | "assistant"
  | "cv-coach"
  | "cover-letter"
  | "interview"
  | "skill-gap"
  | "roadmap"
  | "application-email";
