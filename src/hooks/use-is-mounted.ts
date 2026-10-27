"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns `false` during server rendering and the first client render, then
 * `true` after hydration. Use this to defer rendering of client-only values
 * (theme, storage reads) without causing a hydration mismatch, and without
 * calling `setState` inside an effect.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
