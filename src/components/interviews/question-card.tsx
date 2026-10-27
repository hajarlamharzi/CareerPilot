"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  INTERVIEW_CATEGORY_LABELS,
  INTERVIEW_DIFFICULTY_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/config/constants";
import {
  deleteInterviewQuestion,
  setInterviewPracticed,
  updateInterviewAnswer,
} from "@/features/interviews/interview-store";
import type { InterviewQuestion, Job } from "@/types";

const DIFFICULTY_TONE = {
  easy: "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium:
    "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  hard: "border-transparent bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
} as const;

interface QuestionCardProps {
  question: InterviewQuestion;
  /** Resolved job, when the question is tied to one that still exists. */
  job?: Job | null;
}

/**
 * One practice question: the prompt, its guidance, the user's own answer, and
 * the rehearsal flag. Answers are saved explicitly so a half-typed thought is
 * never persisted as if it were finished.
 */
export function QuestionCard({ question, job }: QuestionCardProps) {
  const [answer, setAnswer] = useState(question.userAnswer);
  const [showGuidance, setShowGuidance] = useState(false);
  const [practiced, setPracticed] = useState(question.practiced);
  const [saving, setSaving] = useState(false);

  const dirty = answer !== question.userAnswer;

  function handleSave() {
    setSaving(true);
    const updated = updateInterviewAnswer(question.id, answer);
    setSaving(false);
    if (updated) {
      toast.success("Answer saved.");
    } else {
      toast.error("That question no longer exists.");
    }
  }

  function handlePracticed(next: boolean) {
    setPracticed(next);
    const updated = setInterviewPracticed(question.id, next);
    if (!updated) {
      setPracticed(!next);
      toast.error("That question no longer exists.");
      return;
    }
    toast.success(next ? "Marked as rehearsed." : "Marked as not rehearsed.");
  }

  function handleDelete() {
    deleteInterviewQuestion(question.id);
    toast.success("Question deleted.");
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {INTERVIEW_CATEGORY_LABELS[question.category]}
        </Badge>
        <Badge
          variant="outline"
          className={DIFFICULTY_TONE[question.difficulty]}
        >
          {INTERVIEW_DIFFICULTY_LABELS[question.difficulty]}
        </Badge>
        <Badge variant="secondary">
          {INTERVIEW_TYPE_LABELS[question.type]}
        </Badge>
        {job ? (
          <Link
            href={`/jobs/${job.id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {job.title} · {job.company}
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
        {practiced ? (
          <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Rehearsed
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 text-sm font-medium leading-relaxed">
        {question.question}
      </h3>

      {question.guidance ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowGuidance((value) => !value)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showGuidance}
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${showGuidance ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {showGuidance ? "Hide guidance" : "How to structure your answer"}
          </button>
          {showGuidance ? (
            <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {question.guidance}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <Label htmlFor={`answer-${question.id}`} className="text-xs">
          Your answer
        </Label>
        <Textarea
          id={`answer-${question.id}`}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Write it in your own words. Nothing is generated or sent anywhere."
          rows={4}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`practiced-${question.id}`}
            checked={practiced}
            onCheckedChange={handlePracticed}
          />
          <Label htmlFor={`practiced-${question.id}`} className="text-xs">
            I have rehearsed this
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            Save answer
          </Button>
          <ConfirmDialog
            variant="destructive"
            title="Delete this question?"
            description="The question and the answer you wrote for it will be removed. This cannot be undone."
            confirmLabel="Delete"
            onConfirm={handleDelete}
            trigger={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Delete question"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            }
          />
        </div>
      </div>
    </article>
  );
}
