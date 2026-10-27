import "server-only";

import { notFound } from "@/lib/auth/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Conversation persistence for the assistant.
 *
 * Only used in cloud mode. In local demo mode the transcript lives in the
 * browser's own workspace, exactly like every other piece of demo data — the
 * server keeps no copy, because there is no account to own it.
 *
 * Every read and write filters on `user_id` explicitly *in addition to* RLS.
 * That is deliberate redundancy: RLS is the real boundary, and the explicit
 * filter means a policy mistake still cannot surface another account's thread.
 */

export type StoredRole = "user" | "assistant" | "system" | "tool";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: StoredRole;
  content: string;
  createdAt: string;
}

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGES = 200;

/** A short, human title derived from the first user message. */
export function deriveTitle(message: string): string {
  const single = message.replace(/\s+/g, " ").trim();
  if (single.length === 0) return "Nouvelle conversation";
  if (single.length <= MAX_TITLE_LENGTH) return single;
  return `${single.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

export async function listConversations(
  supabase: ServerSupabaseClient | null,
  userId: string,
): Promise<ConversationSummary[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getConversationMessages(
  supabase: ServerSupabaseClient | null,
  userId: string,
  conversationId: string,
): Promise<StoredMessage[] | null> {
  if (!supabase) return null;

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!conversation) return null;

  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

/**
 * Create a conversation, or verify that an existing one belongs to the caller.
 *
 * Returns the id to use. A supplied id that belongs to somebody else raises
 * `not_found` rather than `forbidden`, so the endpoint does not confirm that
 * another account's thread exists.
 */
export async function resolveConversation(
  supabase: ServerSupabaseClient | null,
  userId: string,
  conversationId: string | null,
  firstMessage: string,
): Promise<string | null> {
  if (!supabase) return null;

  if (conversationId) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) throw notFound("Conversation introuvable.");
    return data.id;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title: deriveTitle(firstMessage) })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    // Losing the thread should not lose the answer: continue without persistence.
    return null;
  }
  return data.id;
}

export async function appendMessage(
  supabase: ServerSupabaseClient | null,
  userId: string,
  conversationId: string | null,
  role: StoredRole,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!supabase || !conversationId) return;

  try {
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
      metadata: metadata ?? null,
    });
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId);
  } catch {
    // Best effort: a persistence failure must not fail the turn.
  }
}
