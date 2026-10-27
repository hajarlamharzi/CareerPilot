/**
 * Result of a profile form submission.
 *
 * Mirrors the authentication form state so both features can share the same
 * presentation habits (a message above the form, field errors below inputs).
 */
export interface ProfileFormState {
  status: "idle" | "error" | "success";
  message: string | null;
  /** Field-level messages keyed by input `name`. */
  fieldErrors: Record<string, string[]>;
}

export const INITIAL_PROFILE_FORM_STATE: ProfileFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
