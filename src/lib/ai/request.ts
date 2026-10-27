import "server-only";

import { z } from "zod";

import { applicationArraySchema } from "@/schemas/application";
import { cvDocumentSchema } from "@/schemas/cv";
import { jobArraySchema } from "@/schemas/job";
import type { Principal } from "@/lib/auth/session";
import { tokenize } from "@/lib/jobs/text";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ToolContext, WorkspaceSnapshot } from "./tools";
import { UNTRUSTED_LIMITS } from "./safety";

/**
 * Request contracts for the AI endpoints.
 *
 * Everything a client sends is validated here before it reaches a tool or a
 * prompt. In particular the local-demo snapshot is validated against **the same
 * Zod schemas the storage layer uses** — a browser cannot smuggle a malformed
 * job, an out-of-range salary or an unexpected field into the assistant's
 * context.
 */

const boundedText = (max: number) => z.string().trim().max(max);

export const workspaceSnapshotSchema = z.object({
  profile: z.object({
    fullName: boundedText(160).default(""),
    headline: boundedText(200).nullish().transform((value) => value || null),
    location: boundedText(160).nullish().transform((value) => value || null),
    summary: boundedText(4_000).nullish().transform((value) => value || null),
  }),
  skills: z.array(boundedText(80)).max(300).default([]),
  preferences: z
    .object({
      targetTitles: z.array(boundedText(120)).max(20).default([]),
      locations: z.array(boundedText(120)).max(20).default([]),
      workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3).default([]),
      employmentTypes: z
        .array(z.enum(["full-time", "part-time", "contract", "internship", "temporary"]))
        .max(5)
        .default([]),
      seniorities: z
        .array(z.enum(["intern", "junior", "mid", "senior", "lead", "principal"]))
        .max(6)
        .default([]),
      minimumSalary: z.number().int().min(0).max(10_000_000).nullish().transform((v) => v ?? null),
      currency: boundedText(8).nullish().transform((value) => value || null),
    })
    .default({
      targetTitles: [],
      locations: [],
      workModes: [],
      employmentTypes: [],
      seniorities: [],
      minimumSalary: null,
      currency: null,
    }),
  // Bounded so a hostile or simply huge workspace cannot exhaust memory.
  jobs: jobArraySchema.max(2_000).default([]),
  applications: applicationArraySchema.max(2_000).default([]),
  savedJobIds: z.array(boundedText(160)).max(2_000).default([]),
  cv: cvDocumentSchema.nullish().transform((value) => value ?? null),
});

export type WorkspaceSnapshotInput = z.infer<typeof workspaceSnapshotSchema>;

export const conversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(UNTRUSTED_LIMITS.userMessage),
});

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1, "Écrivez un message.").max(UNTRUSTED_LIMITS.userMessage),
  history: z.array(conversationTurnSchema).max(20).default([]),
  conversationId: boundedText(80).nullish().transform((value) => value || null),
  snapshot: workspaceSnapshotSchema.nullish().transform((value) => value ?? null),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const confirmRequestSchema = z.object({
  /**
   * Signed token minted by the server. Required for a verified account; empty in
   * local demo mode, where no token can be bound to an identity.
   */
  confirmationId: z.string().trim().max(8_192).default(""),
  /** Local demo mode only: the tool the browser is confirming. */
  tool: boundedText(64).nullish().transform((value) => value || null),
  /** Local demo mode only: re-validated against the tool's own schema. */
  args: z.record(z.string(), z.unknown()).default({}),
  conversationId: boundedText(80).nullish().transform((value) => value || null),
  snapshot: workspaceSnapshotSchema.nullish().transform((value) => value ?? null),
});

/**
 * French stop words.
 *
 * Kept short and explicit rather than pulling in a dependency: the list only
 * needs to stop "je cherche un poste de" from being treated as five search
 * terms, and a wrong entry costs nothing.
 */
const STOP_WORDS = new Set([
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "un", "une", "des", "du", "de", "dans", "sur", "pour", "par", "avec",
  "sans", "sous", "vers", "chez", "que", "qui", "quoi", "dont", "ou", "et",
  "mais", "donc", "or", "ni", "car", "est", "sont", "suis", "es", "etes",
  "etre", "avoir", "ai", "as", "a", "avons", "avez", "ont",
  "je", "me", "moi", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa",
  "ses", "leur", "leurs", "notre", "nos", "votre", "vos",
  "le", "la", "les", "l", "en", "y", "au", "aux", "ce", "cet", "cette",
  "ces", "se", "sa", "ne", "pas", "plus", "moins", "tres", "trop", "peu",
  "bonjour", "merci", "salut", "svp", "stp", "peux", "peut", "pourrais",
  "voudrais", "cherche", "recherche", "trouve", "offre", "offres", "poste",
  "emploi", "job", "jobs", "travail", "candidature", "stage", "s",
  "the", "a", "an", "of", "for", "in", "on", "at", "to", "and", "or",
  "i", "you", "we", "my", "me", "is", "are", "be", "with", "looking",
  "job", "jobs", "role", "position", "please",
]);

/**
 * Pull the search-worthy terms out of a free-text request.
 *
 * Used as a *ranking hint*, never as a filter: the structured filters come from
 * the model's tool arguments. Tokens are folded (accents removed, lower-cased)
 * by `tokenize`, so « développeur » and « developpeur » behave the same.
 */
export function extractSearchKeywords(message: string, max = 12): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const token of tokenize(message)) {
    if (token.length < 3) continue;
    if (STOP_WORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    keywords.push(token);
    if (keywords.length >= max) break;
  }

  return keywords;
}

/**
 * Build the execution context for a turn.
 *
 * The Supabase client is only created for a verified account: in local demo mode
 * every tool takes the snapshot path, and nothing can reach the database.
 */
export async function buildToolContext(input: {
  principal: Principal;
  snapshot: WorkspaceSnapshot | null;
  keywords: string[];
  signal?: AbortSignal;
}): Promise<ToolContext> {
  const supabase =
    input.principal.isAuthenticated && input.principal.userId
      ? await createServerSupabase()
      : null;

  return {
    principal: input.principal,
    supabase,
    snapshot: input.snapshot,
    keywords: input.keywords,
    ...(input.signal ? { signal: input.signal } : {}),
  };
}

/** Narrow the validated request snapshot to the tool-layer shape. */
export function toSnapshot(
  value: WorkspaceSnapshotInput | null,
): WorkspaceSnapshot | null {
  if (!value) return null;
  return {
    profile: value.profile,
    skills: value.skills,
    preferences: value.preferences,
    jobs: value.jobs,
    applications: value.applications,
    savedJobIds: value.savedJobIds,
    cv: value.cv,
  };
}
