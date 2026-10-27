"use client";

import { useEffect } from "react";

import { workspaceStore } from "@/lib/storage";

/**
 * Initialises the workspace store exactly once on the client. Wrapping the app
 * in this provider guarantees that by the time any page reads a domain, the
 * store has loaded from localStorage and seeded the demo workspace on first run.
 */
export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  useEffect(() => {
    workspaceStore.init();
  }, []);

  return <>{children}</>;
}
