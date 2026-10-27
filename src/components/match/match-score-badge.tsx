"use client";

import { MATCH_THRESHOLDS } from "@/config/app";
import { cn } from "@/lib/utils";

interface MatchScoreBadgeProps {
  score: number;
  className?: string;
  withLabel?: boolean;
}

/** Compact 0–100 match score pill with category colouring. */
export function MatchScoreBadge({
  score,
  className,
  withLabel = false,
}: MatchScoreBadgeProps) {
  const tone =
    score >= MATCH_THRESHOLDS.strong
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
      : score >= MATCH_THRESHOLDS.moderate
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30"
        : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tone,
        className,
      )}
      title={`Match score: ${score}%`}
    >
      <span aria-hidden>◎</span>
      {withLabel ? (
        <span>Match {score}%</span>
      ) : (
        <span data-testid="match-score">{score}%</span>
      )}
    </span>
  );
}