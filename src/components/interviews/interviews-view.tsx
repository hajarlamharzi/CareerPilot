"use client";

import { useMemo, useState } from "react";
import { MessagesSquare, Search } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { GenerateQuestionsDialog } from "@/components/interviews/generate-questions-dialog";
import { QuestionCard } from "@/components/interviews/question-card";
import {
  INTERVIEW_CATEGORIES,
  INTERVIEW_CATEGORY_LABELS,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_DIFFICULTY_LABELS,
} from "@/config/constants";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { computeInterviewPrepStats } from "@/features/analytics/insights";
import type { InterviewCategory, InterviewDifficulty } from "@/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type PracticeFilter = "all" | "todo" | "done";

/** Interview preparation workspace: the bank, your answers, and rehearsal state. */
export function InterviewsView() {
  const ready = useStoreReady();
  const questions = useWorkspaceDomain("interviews");
  const jobs = useWorkspaceDomain("jobs");
  const matches = useWorkspaceDomain("matches");
  const cv = useWorkspaceDomain("cv");

  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | InterviewCategory>(
    "all",
  );
  const [difficultyFilter, setDifficultyFilter] = useState<
    "all" | InterviewDifficulty
  >("all");
  const [practiceFilter, setPracticeFilter] = useState<PracticeFilter>("all");

  const all = useMemo(() => questions ?? [], [questions]);
  const stats = useMemo(() => computeInterviewPrepStats(all), [all]);

  const jobsById = useMemo(
    () => new Map((jobs ?? []).map((job) => [job.id, job])),
    [jobs],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((question) => {
        if (jobFilter !== "all" && question.jobId !== jobFilter) return false;
        if (categoryFilter !== "all" && question.category !== categoryFilter)
          return false;
        if (
          difficultyFilter !== "all" &&
          question.difficulty !== difficultyFilter
        )
          return false;
        if (practiceFilter === "todo" && question.practiced) return false;
        if (practiceFilter === "done" && !question.practiced) return false;
        if (needle) {
          const haystack = `${question.question} ${question.userAnswer}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Unrehearsed first, then newest, so the page opens on what needs work.
        if (a.practiced !== b.practiced) return a.practiced ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    all,
    query,
    jobFilter,
    categoryFilter,
    difficultyFilter,
    practiceFilter,
  ]);

  if (!ready) return <PageSkeleton />;

  const filtersActive =
    query.trim() !== "" ||
    jobFilter !== "all" ||
    categoryFilter !== "all" ||
    difficultyFilter !== "all" ||
    practiceFilter !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview preparation"
        description="Generate practice questions, write your own answers, and track what you have rehearsed."
        actions={
          <GenerateQuestionsDialog
            jobs={jobs ?? []}
            matches={matches ?? []}
            cv={cv ?? null}
            existing={all}
          />
        }
      />

      {all.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Questions"
              value={stats.total}
              icon={MessagesSquare}
            />
            <StatCard
              label="Rehearsed"
              value={`${stats.practicedRate}%`}
              hint={`${stats.practiced} of ${stats.total}`}
            />
            <StatCard
              label="Answers written"
              value={stats.answered}
              hint="Questions with your own draft answer"
            />
            <StatCard
              label="Still to rehearse"
              value={stats.total - stats.practiced}
              hint="Unrehearsed questions"
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Rehearsal progress</span>
              <span className="tabular-nums text-muted-foreground">
                {stats.practiced} / {stats.total}
              </span>
            </div>
            <Progress className="mt-2" value={stats.practicedRate} />
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="question-search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="question-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search questions and answers"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="question-job" className="text-xs">
                Job
              </Label>
              <select
                id="question-job"
                className={selectClass}
                value={jobFilter}
                onChange={(event) => setJobFilter(event.target.value)}
              >
                <option value="all">All jobs</option>
                {(jobs ?? []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} · {job.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="question-category" className="text-xs">
                Category
              </Label>
              <select
                id="question-category"
                className={selectClass}
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value as "all" | InterviewCategory)
                }
              >
                <option value="all">All categories</option>
                {INTERVIEW_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {INTERVIEW_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="question-difficulty" className="text-xs">
                Difficulty
              </Label>
              <select
                id="question-difficulty"
                className={selectClass}
                value={difficultyFilter}
                onChange={(event) =>
                  setDifficultyFilter(
                    event.target.value as "all" | InterviewDifficulty,
                  )
                }
              >
                <option value="all">All levels</option>
                {INTERVIEW_DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {INTERVIEW_DIFFICULTY_LABELS[difficulty]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="question-status" className="text-xs">
                Rehearsal
              </Label>
              <select
                id="question-status"
                className={selectClass}
                value={practiceFilter}
                onChange={(event) =>
                  setPracticeFilter(event.target.value as PracticeFilter)
                }
              >
                <option value="all">All questions</option>
                <option value="todo">Still to rehearse</option>
                <option value="done">Rehearsed</option>
              </select>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length} of {all.length} questions.
              </p>
              {filtered.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  job={
                    question.jobId ? jobsById.get(question.jobId) ?? null : null
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="No questions match these filters"
              description="Adjust the filters, or generate more questions from your jobs and CV."
              action={
                filtersActive ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      setQuery("");
                      setJobFilter("all");
                      setCategoryFilter("all");
                      setDifficultyFilter("all");
                      setPracticeFilter("all");
                    }}
                  >
                    Clear all filters
                  </button>
                ) : null
              }
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="No practice questions yet"
          description="Generate questions from a job advert or your CV, then write your own answers and mark them as rehearsed. Nothing is sent anywhere and no answer is written for you."
          action={
            <GenerateQuestionsDialog
              jobs={jobs ?? []}
              matches={matches ?? []}
              cv={cv ?? null}
              existing={[]}
            />
          }
        />
      )}
    </div>
  );
}
