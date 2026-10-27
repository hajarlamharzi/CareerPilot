"use client";

import { useState } from "react";
import Link from "next/link";
import { Rocket, Sparkles, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { completeOnboarding, startEmptyWorkspace } from "@/features/workspace/actions";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";

/**
 * First-run experience. Shown until the user picks a starting point:
 * explore the bundled demo workspace, or begin with an empty one.
 */
export function WelcomeDialog() {
  const ready = useStoreReady();
  const meta = useWorkspaceDomain("meta");
  const [dismissed, setDismissed] = useState(false);

  const show = ready && meta !== null && !meta.onboarded && !dismissed;

  function chooseDemo() {
    completeOnboarding();
  }

  function chooseEmpty() {
    startEmptyWorkspace();
  }

  return (
    <Dialog open={show} onOpenChange={(open) => setDismissed(!open)}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg"
        aria-describedby="welcome-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to CareerPilot</DialogTitle>
          <DialogDescription id="welcome-description">
            Everything you save stays in this browser — there is no account and
            no server. Choose how you would like to start.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={chooseDemo}
            className="group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <span className="text-base font-semibold">Explore the demo</span>
            <span className="text-sm text-muted-foreground">
              22 sample jobs, a ready-made CV, match reports and a full
              application pipeline — everything pre-filled so you can look
              around instantly.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
              <Rocket className="size-4" aria-hidden />
              Try it now
            </span>
          </button>

          <button
            type="button"
            onClick={chooseEmpty}
            className="group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <span className="text-base font-semibold">Start from scratch</span>
            <span className="text-sm text-muted-foreground">
              Begin with a blank workspace and build it up with your own jobs
              and applications. Your data never leaves this device.
            </span>
            <span className="mt-1 text-sm font-medium text-muted-foreground group-hover:text-foreground">
              Blank workspace
            </span>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can switch or reset your workspace at any time in{" "}
          <Link href="/settings" className="font-medium underline underline-offset-2">
            Settings
          </Link>
          . Read the{" "}
          <Link href="/privacy" className="font-medium underline underline-offset-2">
            privacy page
          </Link>{" "}
          for details.
        </p>
      </DialogContent>
    </Dialog>
  );
}