import { logActivity } from "@/features/activity/logger";
import { createId } from "@/lib/id";
import { workspaceStore } from "@/lib/storage";
import type { InterviewQuestion } from "@/types";

import type { InterviewQuestionDraft } from "./question-bank";

/**
 * Persistence for the interview practice domain. Questions are the user's own
 * working notes, so they are stored verbatim and never regenerated behind their
 * back.
 */

function read(): InterviewQuestion[] {
  return workspaceStore.read("interviews") ?? [];
}

function write(questions: InterviewQuestion[]): void {
  workspaceStore.set("interviews", questions);
}

/** Shorten a question so activity messages stay readable. */
function summarise(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}

/** Append generated drafts as real records. Returns the created questions. */
export function addInterviewQuestions(
  drafts: InterviewQuestionDraft[],
  context: { jobTitle?: string | null } = {},
): InterviewQuestion[] {
  if (drafts.length === 0) return [];
  const now = new Date().toISOString();
  const created: InterviewQuestion[] = drafts.map((draft) => ({
    ...draft,
    id: createId("q"),
    origin: "user",
    createdAt: now,
    updatedAt: now,
  }));

  write([...created, ...read()]);
  const plural = created.length === 1 ? "" : "s";
  logActivity({
    type: "interview-saved",
    message: context.jobTitle
      ? `Added ${created.length} practice question${plural} for ${context.jobTitle}.`
      : `Added ${created.length} practice question${plural}.`,
    entityId: created[0].id,
  });
  return created;
}

export function updateInterviewAnswer(
  id: string,
  userAnswer: string,
): InterviewQuestion | null {
  const list = read();
  const index = list.findIndex((question) => question.id === id);
  if (index === -1) return null;
  const updated: InterviewQuestion = {
    ...list[index],
    userAnswer,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[index] = updated;
  write(next);
  return updated;
}

/** Toggle rehearsal state. Marking as practised also timestamps the change. */
export function setInterviewPracticed(
  id: string,
  practiced: boolean,
): InterviewQuestion | null {
  const list = read();
  const index = list.findIndex((question) => question.id === id);
  if (index === -1) return null;
  const previous = list[index];
  if (previous.practiced === practiced) return previous;
  const updated: InterviewQuestion = {
    ...previous,
    practiced,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[index] = updated;
  write(next);
  logActivity({
    type: "interview-saved",
    message: practiced
      ? `Marked "${summarise(previous.question)}" as rehearsed.`
      : `Marked "${summarise(previous.question)}" as not yet rehearsed.`,
    entityId: id,
  });
  return updated;
}

export function deleteInterviewQuestion(id: string): void {
  const list = read();
  const target = list.find((question) => question.id === id) ?? null;
  if (!target) return;
  write(list.filter((question) => question.id !== id));
  logActivity({
    type: "interview-saved",
    message: `Deleted the question "${summarise(target.question)}".`,
    entityId: null,
  });
}

/** Remove every question matching a filter. Returns how many were removed. */
export function deleteInterviewQuestions(
  ids: readonly string[],
): number {
  if (ids.length === 0) return 0;
  const remove = new Set(ids);
  const list = read();
  const kept = list.filter((question) => !remove.has(question.id));
  const removed = list.length - kept.length;
  if (removed === 0) return 0;
  write(kept);
  logActivity({
    type: "interview-saved",
    message: `Deleted ${removed} practice question${removed === 1 ? "" : "s"}.`,
    entityId: null,
  });
  return removed;
}

/** Read the practice set for a job (or every question when no job is given). */
export function questionsForJob(jobId: string | null): InterviewQuestion[] {
  const list = read();
  return jobId === null
    ? list
    : list.filter((question) => question.jobId === jobId);
}
