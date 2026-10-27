"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  workspaceStore,
  type StoreDomain,
  type StoreShape,
} from "@/lib/storage";

/**
 * `true` once the workspace store has loaded (and seeded on first run) on the
 * client. Always `false` during server rendering and the first client render, so
 * components can avoid hydration mismatches by rendering a skeleton until ready.
 */
export function useStoreReady(): boolean {
  return useSyncExternalStore(
    workspaceStore.subscribeReady,
    workspaceStore.getReadySnapshot,
    workspaceStore.getServerReadySnapshot,
  );
}

/**
 * Subscribe to a single storage domain. Returns `null` until the store is ready
 * or when the domain has no value. The snapshot reference is stable between
 * writes, which is what `useSyncExternalStore` requires.
 */
export function useWorkspaceDomain<D extends StoreDomain>(
  domain: D,
): StoreShape[D] | null {
  const subscribe = useCallback(
    (listener: () => void) => workspaceStore.subscribe(domain, listener),
    [domain],
  );
  const getSnapshot = useCallback(
    () => workspaceStore.getSnapshot(domain),
    [domain],
  );
  const getServerSnapshot = useCallback(
    () => null as StoreShape[D] | null,
    [],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
