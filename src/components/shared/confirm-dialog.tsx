"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface ConfirmDialogProps {
  /**
   * Element that opens the dialog. Optional, because a caller may drive the
   * dialog themselves with `open` / `onOpenChange` (for example after a file
   * input resolves and there is nothing sensible to attach a trigger to).
   */
  trigger?: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  /** Controlled open state. When provided, `trigger` is not rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Reusable confirmation dialog. Thin wrapper so importers do not re-wire the
 * destructive-action pattern each time. The action is prevented from closing
 * automatically so callers control when the dialog dismisses.
 *
 * Works uncontrolled (pass a `trigger`) or controlled (pass `open` and
 * `onOpenChange`).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const controlled = open !== undefined;

  function setOpen(next: boolean) {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <AlertDialog open={controlled ? open : internalOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
              setOpen(false);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Convenience wrapper for destructive confirmations. */
export function DestructiveConfirmButton({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: Omit<ConfirmDialogProps, "variant" | "cancelLabel">) {
  return (
    <ConfirmDialog
      trigger={trigger}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="destructive"
      onConfirm={onConfirm}
    />
  );
}
