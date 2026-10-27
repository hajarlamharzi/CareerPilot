"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MethodNoteProps {
  /** One-line statement of what the number means. */
  definition: string;
  /** The calculation, written out with real values where possible. */
  formula?: string;
  /** Optional caveat, e.g. the denominator or a small-sample warning. */
  caveat?: string;
}

/**
 * "How is this calculated?" affordance shown next to every derived number.
 *
 * Analytics promises no black boxes: each figure states its definition, its
 * formula and any caveat, using the same wording as the code that computes it.
 */
export function MethodNote({ definition, formula, caveat }: MethodNoteProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="How is this calculated?"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm">
        <p className="font-medium">How this is calculated</p>
        <p className="mt-2 text-muted-foreground">{definition}</p>
        {formula ? (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            {formula}
          </p>
        ) : null}
        {caveat ? (
          <p className="mt-3 text-xs text-muted-foreground">{caveat}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface ChartCardProps {
  title: string;
  description?: string;
  /** Method note shown beside the title. */
  note?: MethodNoteProps;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Consistent card chrome for one insight, with its method note. */
export function InsightCard({
  title,
  description,
  note,
  action,
  children,
  className,
}: ChartCardProps) {
  return (
    <section
      className={`rounded-xl border border-border bg-card p-5 text-card-foreground${className ? ` ${className}` : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            {note ? <MethodNote {...note} /> : null}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
