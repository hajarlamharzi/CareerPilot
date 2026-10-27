"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for local debugging without shipping it anywhere.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      description="This is likely a browser-side error. You can try again — your saved data is unaffected."
      action={
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      }
    />
  );
}
