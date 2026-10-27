import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Hide the wordmark and show only the mark. */
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 19V7.5L12 4l7 3.5V19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 19v-5h6v5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!iconOnly ? (
        <span className="text-[15px] font-semibold tracking-tight">
          CareerPilot
        </span>
      ) : null}
    </span>
  );
}
