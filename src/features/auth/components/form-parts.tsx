"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { AuthFormState } from "../types";

/** Banner rendered above a form for both failures and confirmations. */
export function AuthAlert({ state }: { state: AuthFormState }) {
  if (!state.message) return null;

  const isSuccess = state.status === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        isSuccess
          ? "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{state.message}</p>
    </div>
  );
}

interface AuthFieldProps extends React.ComponentProps<"input"> {
  name: string;
  label: string;
  errors?: string[];
  hint?: React.ReactNode;
}

/** Labelled input wired to its error message for screen readers. */
export function AuthField({
  name,
  label,
  errors,
  hint,
  id,
  ...props
}: AuthFieldProps) {
  const fieldId = id ?? `auth-${name}`;
  const error = errors?.[0];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error ? (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface AuthSubmitProps {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
}

/** Full-width submit button with an in-line pending state. */
export function AuthSubmit({ pending, children, pendingLabel }: AuthSubmitProps) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel ?? "Traitement…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
