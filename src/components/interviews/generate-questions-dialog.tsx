"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERVIEW_CATEGORY_LABELS } from "@/config/constants";
import { addInterviewQuestions } from "@/features/interviews/interview-store";
import {
  availableSources,
  generateInterviewQuestions,
  QUESTION_SOURCES,
  type QuestionSource,
} from "@/features/interviews/question-bank";
import { latestMatchPerJob } from "@/lib/matching/report";
import type {
  CvLibrary,
  InterviewQuestion,
  Job,
  MatchReport,
} from "@/types";

const NO_JOB = "__none__";

interface GenerateQuestionsDialogProps {
  jobs: Job[];
  matches: MatchReport[];
  cv: CvLibrary | null;
  existing: InterviewQuestion[];
  /** Pre-select a job, e.g. when arriving from a job page. */
  defaultJobId?: string | null;
}

/**
 * Builds a batch of practice questions from the user's own records. The preview
 * shows exactly what will be added before anything is stored, and duplicates of
 * questions already in the workspace are filtered out.
 */
export function GenerateQuestionsDialog({
  jobs,
  matches,
  cv,
  existing,
  defaultJobId,
}: GenerateQuestionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string>(defaultJobId ?? NO_JOB);
  const [limit, setLimit] = useState(5);

  const job = jobs.find((entry) => entry.id === jobId) ?? null;
  const activeCv = cv?.documents.find((doc) => doc.id === cv.activeId) ?? null;
  const matchReport =
    latestMatchPerJob(matches).find((report) => report.jobId === jobId) ?? null;

  const supported = useMemo(
    () =>
      availableSources({
        job,
        cv: activeCv,
        matchReport,
      }),
    [job, activeCv, matchReport],
  );

  // Sources the user turned off. Everything the selection supports is on by
  // default, so choosing a job immediately offers job-derived questions.
  const [disabled, setDisabled] = useState<QuestionSource[]>([]);
  const effectiveSources = supported.filter(
    (source) => !disabled.includes(source),
  );

  const drafts = useMemo(
    () =>
      generateInterviewQuestions({
        job,
        cv: activeCv,
        matchReport,
        sources: effectiveSources,
        limitPerSource: limit,
        existing,
      }),
    [job, activeCv, matchReport, effectiveSources, limit, existing],
  );

  function toggleSource(source: QuestionSource, checked: boolean) {
    setDisabled((current) =>
      checked
        ? current.filter((entry) => entry !== source)
        : [...new Set([...current, source])],
    );
  }

  function handleGenerate() {
    if (drafts.length === 0) return;
    addInterviewQuestions(drafts, { jobTitle: job?.title ?? null });
    toast.success(
      `Added ${drafts.length} question${drafts.length === 1 ? "" : "s"}${
        job ? ` for ${job.title}` : ""
      }.`,
    );
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="size-4" aria-hidden="true" />
          Generate questions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate practice questions</DialogTitle>
          <DialogDescription>
            Questions are built from records you already store. Nothing is sent
            anywhere and no facts are invented for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="generate-job">Base the questions on</Label>
            {jobs.length > 0 ? (
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger id="generate-job">
                  <SelectValue placeholder="No specific job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_JOB}>No specific job</SelectItem>
                  {jobs.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.title} · {entry.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                You have no saved jobs yet, so only your CV can be used.
              </p>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Sources</legend>
            {QUESTION_SOURCES.map((source) => {
              const enabled = supported.includes(source.value);
              return (
                <div
                  key={source.value}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {enabled
                        ? source.description
                        : "Not available with the current selection."}
                    </p>
                  </div>
                  <Switch
                    checked={effectiveSources.includes(source.value)}
                    disabled={!enabled}
                    onCheckedChange={(checked) =>
                      toggleSource(source.value, checked)
                    }
                    aria-label={source.label}
                  />
                </div>
              );
            })}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="generate-limit">Maximum per source</Label>
            <Select
              value={String(limit)}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger id="generate-limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 8, 12].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {drafts.length === 0
                ? "No new questions for this selection"
                : `${drafts.length} new question${drafts.length === 1 ? "" : "s"} will be added`}
            </p>
            {drafts.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {drafts.slice(0, 4).map((draft) => (
                  <li key={draft.question} className="text-xs">
                    <span className="font-medium text-muted-foreground">
                      {INTERVIEW_CATEGORY_LABELS[draft.category]}:
                    </span>{" "}
                    {draft.question}
                  </li>
                ))}
                {drafts.length > 4 ? (
                  <li className="text-xs text-muted-foreground">
                    …and {drafts.length - 4} more.
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Every question for this selection is already in your practice
                set. Try another source or a different job.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={drafts.length === 0}>
            Add {drafts.length > 0 ? drafts.length : ""} question
            {drafts.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
