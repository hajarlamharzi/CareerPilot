import * as React from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again, or reload the page.",
  icon: Icon = AlertTriangle,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

interface InlineAlertProps {
  variant?: "info" | "warning" | "destructive" | "success";
  title?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

const ALERT_STYLES: Record<NonNullable<InlineAlertProps["variant"]>, string> = {
  info: "border-info/25 bg-info/5 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  destructive: "border-destructive/25 bg-destructive/5 text-foreground",
  success: "border-success/25 bg-success/5 text-foreground",
};

export function InlineAlert({
  variant = "info",
  title,
  children,
  icon: Icon,
  className,
}: InlineAlertProps) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border p-3.5 text-sm",
        ALERT_STYLES[variant],
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
      <div className="space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className="text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline">
          {children}
        </div>
      </div>
    </div>
  );
}
