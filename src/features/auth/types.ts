/**
 * Shared shape of an authentication form result.
 *
 * It lives in its own module rather than beside the actions because Client
 * Components import it: a `"use server"` module may only export async
 * functions, so a constant imported from one would fail the build.
 */
export interface AuthFormState {
  status: "idle" | "error" | "success";
  /** A message rendered above the form. `null` when there is nothing to say. */
  message: string | null;
  /** Field-level messages, keyed by input `name`. */
  fieldErrors: Record<string, string[]>;
}

export const INITIAL_AUTH_STATE: AuthFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
