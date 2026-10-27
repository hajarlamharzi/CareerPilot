import {
  BarChart3,
  Briefcase,
  FileText,
  KanbanSquare,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * A genuine, code-built preview of the workspace UI. It uses the same design
 * tokens and components as the real app rather than an image, so it always
 * matches the shipped interface and stays accessible to screen readers.
 */
export function AppPreview() {
  const jobs = [
    { title: "Frontend Developer", company: "Northwind Labs", score: 86, tone: "strong" },
    { title: "React Developer", company: "Bright Harbor", score: 74, tone: "good" },
    { title: "Full Stack Developer", company: "Cobalt Systems", score: 61, tone: "ok" },
  ] as const;

  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <p className="ml-2 truncate text-xs font-medium text-muted-foreground">
            CareerPilot — Dashboard
          </p>
        </div>

        <div className="grid grid-cols-[auto_1fr]">
          <aside className="hidden w-40 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3 sm:flex">
            {[
              { icon: Briefcase, label: "Jobs", active: false },
              { icon: Target, label: "Match", active: true },
              { icon: FileText, label: "CV", active: false },
              { icon: KanbanSquare, label: "Applications", active: false },
              { icon: BarChart3, label: "Analytics", active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={
                  item.active
                    ? "flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5 text-xs font-medium text-sidebar-accent-foreground"
                    : "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground"
                }
              >
                <item.icon className="size-3.5" />
                {item.label}
              </div>
            ))}
          </aside>

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Match opportunities</p>
              <Badge variant="muted" className="text-[10px]">
                3 jobs
              </Badge>
            </div>
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li
                  key={job.title}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{job.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {job.company}
                    </p>
                  </div>
                  <span
                    className={
                      job.tone === "strong"
                        ? "rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-inset ring-success/25"
                        : job.tone === "good"
                          ? "rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground ring-1 ring-inset ring-warning/30"
                          : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border"
                    }
                  >
                    {job.score}%
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Applied", value: "12" },
                { label: "Interviews", value: "4" },
                { label: "Offers", value: "1" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-background p-2.5"
                >
                  <p className="text-[11px] text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-sm font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Interface preview · sample data shown
      </p>
    </div>
  );
}
