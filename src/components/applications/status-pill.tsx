"use client";

import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_STYLES,
} from "@/config/constants";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types";

interface StatusPillProps {
  status: ApplicationStatus;
  className?: string;
}

/** Consistent status pill used on boards, cards and detail pages. */
export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        APPLICATION_STATUS_STYLES[status],
        className,
      )}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}