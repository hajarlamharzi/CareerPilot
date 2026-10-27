import "server-only";

import { getAiProvider } from "./index";
import {
  UNTRUSTED_DATA_POLICY,
  UNTRUSTED_LIMITS,
  detectInjectionAttempts,
  sanitizeUntrusted,
  type InjectionSignal,
} from "./safety";
import {
  TOOL_DEFINITIONS,
  buildCandidateContext,
  executeTool,
  outcomeToToolContent,
  type JobCard,
  type ToolContext,
  type ToolOutcome,
} from "./tools";
import type { ChatMessage, TokenUsage, ToolCallRequest } from "./types";

/**
 * The assistant loop.
 *
 * A single request produces **one or more** provider round-trips: the model asks
 * for tools, the server validates and runs them, the results go back, and the
 * model answers. This file owns that loop, the artifact collection the UI needs,
 * and the ledger of what was read and written.
 *
 * What it deliberately does **not** do:
 *
 *  * trust the model's tool arguments (see `tools.ts`);
 *  * let the model decide whether a write is confirmed (see `confirmations.ts`);
 *  * put anything from the conversation into a log line.
 */

const DEFAULT_MAX_STEPS = 4;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** A write the user must approve before it happens. */
export interface PendingConfirmation {
  /** Signed token, presented back to `/api/assistant/confirm`. */
  confirmationId: string;
  tool: string;
  /** What the model wants to do, in plain French. */
  summary: string;
  /** Validated arguments, shown so the user knows exactly what will change. */
  details: Record<string, unknown>;
  /** Epoch ms; the token is refused after this. */
  expiresAt: number;
  /** `true` when the caller has no verified identity (demo mode). */
  localOnly: boolean;
}

/** A change the browser must apply to its own local workspace. */
export interface ClientAction {
  action: "save_job" | "unsave_job" | "create_application" | "update_application_status";
  payload: Record<string, unknown>;
  summary: string;
}

export interface ToolTraceEntry {
  name: string;
  status: "ok" | "error" | "confirmation_required" | "client_action";
  summary: string;
  /** Present when `status` is `error`. Safe to display. */
  errorCode?: string;
}

export interface AgentArtifacts {
  jobCards: JobCard[];
  confirmations: PendingConfirmation[];
  clientActions: ClientAction[];
  toolTrace: ToolTraceEntry[];
  /** Manipulation attempts found in third-party content, surfaced honestly. */
  injectionWarnings: InjectionSignal[];
}

export interface AgentResult {
  text: string;
  artifacts: AgentArtifacts;
  /** `true` when the provider refused the request outright. */
  blocked: boolean;
  blockReason: string | null;
  usage: TokenUsage;
  model: string;
  provider: string;
  /** Provider round-trips consumed. Useful for the admin dashboard. */
  steps: number;
}

export interface RunAgentOptions {
  /** Feature label, used for logging by the caller. */
  systemInstruction: string;
  /** Prior turns, oldest first. */
  history?: readonly ConversationTurn[];
  userMessage: string;
  toolContext: ToolContext;
  /** `false` for prose-only features (cover letter, CV coach). */
  allowTools?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  maxSteps?: number;
  signal?: AbortSignal;
}

function emptyArtifacts(): AgentArtifacts {
  return {
    jobCards: [],
    confirmations: [],
    clientActions: [],
    toolTrace: [],
    injectionWarnings: [],
  };
}

function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    inputTokens:
      total.inputTokens === null && next.inputTokens === null
        ? null
        : (total.inputTokens ?? 0) + (next.inputTokens ?? 0),
    outputTokens:
      total.outputTokens === null && next.outputTokens === null
        ? null
        : (total.outputTokens ?? 0) + (next.outputTokens ?? 0),
  };
}

/**
 * Describe the caller's own profile to the model, once, up front.
 *
 * Saves a `get_candidate_profile` round-trip on almost every turn and makes the
 * first answer less generic. Only career-facing fields are included: no e-mail,
 * no phone number, no CV body, no account identifiers.
 */
export async function describeCandidateForPrompt(
  toolContext: ToolContext,
): Promise<string> {
  try {
    const context = await buildCandidateContext(toolContext);

    const lines: string[] = [];
    if (context.targetTitles.length > 0) {
      lines.push(`- Intitulés visés : ${context.targetTitles.join(", ")}`);
    }
    if (context.locations.length > 0) {
      lines.push(`- Zones recherchées : ${context.locations.join(", ")}`);
    }
    if (context.workModes.length > 0) {
      lines.push(`- Modes de travail : ${context.workModes.join(", ")}`);
    }
    if (context.employmentTypes.length > 0) {
      lines.push(`- Types de contrat : ${context.employmentTypes.join(", ")}`);
    }
    if (context.seniorities.length > 0) {
      lines.push(`- Niveau : ${context.seniorities.join(", ")}`);
    }
    if (context.minimumSalary !== null) {
      lines.push(
        `- Prétention salariale : ${context.minimumSalary} ${context.currency ?? "EUR"} / an`,
      );
    }
    if (context.skills.length > 0) {
      lines.push(`- Compétences déclarées : ${context.skills.join(", ")}`);
    }

    if (lines.length === 0) {
      return "Profil : aucune préférence renseignée par l'utilisateur. Demande-lui les informations manquantes plutôt que de les inventer.";
    }

    const profile = toolContext.snapshot?.profile;
    const headline = profile?.headline ? `\n- Titre actuel : ${profile.headline}` : "";
    return `Profil de l'utilisateur (données de l'utilisateur) :\n${lines.join("\n")}${headline}`;
  } catch {
    // A profile lookup failure must not block an answer.
    return "Profil : indisponible pour le moment.";
  }
}

/** Assemble the system instruction for a request. */
export function composeSystemInstruction(
  base: string,
  candidateSection: string,
): string {
  return [
    base.trim(),
    "",
    candidateSection,
    "",
    "Rappels de forme : réponds en français, de façon concise et concrète.",
    "Ne promets jamais de contacter une entreprise, d'envoyer un e-mail ou de",
    "postuler à ta place. Ne présente jamais un score d'adéquation comme une",
    "probabilité d'embauche.",
    "",
    UNTRUSTED_DATA_POLICY,
  ].join("\n");
}

/**
 * Run the assistant until it produces a text answer or the step budget is spent.
 *
 * The step cap is a cost and latency control: a model that keeps calling tools
 * without converging is stopped, and the user is told honestly that the task was
 * cut short rather than being shown a confidently truncated nothing.
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
  const provider = getAiProvider();
  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_STEPS);
  const artifacts = emptyArtifacts();

  const candidateSection = await describeCandidateForPrompt(options.toolContext);
  const systemInstruction = composeSystemInstruction(
    options.systemInstruction,
    candidateSection,
  );

  const messages: ChatMessage[] = [];

  for (const turn of options.history ?? []) {
    const content = sanitizeUntrusted(turn.content, UNTRUSTED_LIMITS.userMessage);
    if (content.length === 0) continue;
    messages.push({ role: turn.role, content });
  }

  // The user's own message is the one place a *user* can try to manipulate their
  // own assistant. Harmless, but flagged in the trace so the UI can mention it.
  const userContent = sanitizeUntrusted(
    options.userMessage,
    UNTRUSTED_LIMITS.userMessage,
  );
  artifacts.injectionWarnings.push(...detectInjectionAttempts(userContent));
  messages.push({ role: "user", content: userContent });

  const tools = options.allowTools === false ? undefined : TOOL_DEFINITIONS;

  let usage: TokenUsage = { inputTokens: null, outputTokens: null };
  let lastText = "";
  let steps = 0;

  for (let step = 1; step <= maxSteps; step += 1) {
    steps = step;

    const response = await provider.chat({
      model: provider.model,
      messages,
      systemInstruction,
      tools,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      signal: options.signal,
    });

    usage = addUsage(usage, response.usage);
    lastText = response.text || lastText;

    if (response.finishReason === "blocked") {
      return {
        text:
          response.text ||
          response.blockReason ||
          "Le fournisseur a refusé de traiter cette demande.",
        artifacts,
        blocked: true,
        blockReason: response.blockReason,
        usage,
        model: response.model,
        provider: provider.id,
        steps,
      };
    }

    if (response.toolCalls.length === 0) {
      return {
        text:
          response.text ||
          "Je n'ai pas de réponse à formuler. Reformulez votre demande, ou précisez la ville, le type de contrat ou les compétences visées.",
        artifacts,
        blocked: false,
        blockReason: null,
        usage,
        model: response.model,
        provider: provider.id,
        steps,
      };
    }

    messages.push({
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
    });

    // Tool calls within one round are independent reads, so they run together.
    const outcomes = await Promise.all(
      response.toolCalls.map((call) =>
        executeTool(call.name, call.arguments, options.toolContext),
      ),
    );

    response.toolCalls.forEach((call: ToolCallRequest, index: number) => {
      const outcome = outcomes[index];
      if (!outcome) return;
      collectArtifacts(outcome, artifacts);
      messages.push({
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        content: outcomeToToolContent(outcome),
      });
    });

    // A round made entirely of refusals will not converge; stop early and let
    // the model explain, instead of burning the whole budget on retries.
    if (outcomes.every((outcome) => outcome.kind === "error" && !outcome.message)) {
      break;
    }
  }

  return {
    text:
      lastText ||
      "Je n'ai pas pu terminer cette demande dans le nombre d'étapes autorisé. Reformulez-la de façon plus précise (poste, lieu, contrat) et je réessaie.",
    artifacts,
    blocked: false,
    blockReason: null,
    usage,
    model: provider.model,
    provider: provider.id,
    steps,
  };
}

function collectArtifacts(outcome: ToolOutcome, artifacts: AgentArtifacts): void {
  switch (outcome.kind) {
    case "data": {
      const jobs = outcome.data.jobs;
      if (Array.isArray(jobs)) {
        for (const job of jobs) {
          if (isJobCard(job) && !artifacts.jobCards.some((seen) => seen.id === job.id)) {
            artifacts.jobCards.push(job);
          }
        }
      }
      const single = outcome.data.job;
      if (isJobCard(single) && !artifacts.jobCards.some((seen) => seen.id === single.id)) {
        artifacts.jobCards.push(single);
      }

      const signals = outcome.data.injectionSignals;
      if (Array.isArray(signals)) {
        for (const signal of signals) {
          if (
            isInjectionSignal(signal) &&
            !artifacts.injectionWarnings.some((seen) => seen.code === signal.code)
          ) {
            artifacts.injectionWarnings.push(signal);
          }
        }
      }

      artifacts.toolTrace.push({ name: "tool", status: "ok", summary: outcome.summary });
      return;
    }
    case "confirmation_required":
      artifacts.confirmations.push({
        confirmationId: outcome.confirmationId,
        tool: outcome.tool,
        summary: outcome.summary,
        details: outcome.details,
        expiresAt: outcome.expiresAt,
        localOnly: outcome.confirmationId.length === 0,
      });
      artifacts.toolTrace.push({
        name: outcome.tool,
        status: "confirmation_required",
        summary: outcome.summary,
      });
      return;
    case "client_action":
      artifacts.clientActions.push({
        action: outcome.action,
        payload: outcome.payload,
        summary: outcome.summary,
      });
      artifacts.toolTrace.push({
        name: outcome.action,
        status: "client_action",
        summary: outcome.summary,
      });
      return;
    case "error":
      artifacts.toolTrace.push({
        name: "tool",
        status: "error",
        summary: outcome.message,
        errorCode: outcome.code,
      });
      return;
  }
}

function isJobCard(value: unknown): value is JobCard {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as JobCard).id === "string" &&
    typeof (value as JobCard).title === "string"
  );
}

function isInjectionSignal(value: unknown): value is InjectionSignal {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as InjectionSignal).code === "string" &&
    typeof (value as InjectionSignal).message === "string"
  );
}

export const __testing = { addUsage, emptyArtifacts, collectArtifacts, composeSystemInstruction };
