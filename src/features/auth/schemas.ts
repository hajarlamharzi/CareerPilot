import { z } from "zod";

/**
 * Authentication form schemas.
 *
 * They validate *shape* only. Whether an address already exists, whether a
 * password is correct, and whether an account is confirmed are all answered by
 * Supabase — guessing on the client would either leak account existence or
 * quietly lie to the user.
 */

/**
 * Deliberately permissive. The authoritative check is the verification e-mail;
 * an over-strict pattern here only rejects addresses that would have worked.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailField = z
  .string()
  .trim()
  .min(1, "L'adresse e-mail est requise.")
  .max(254, "Cette adresse e-mail est trop longue.")
  .regex(EMAIL_PATTERN, "Cette adresse e-mail n'est pas valide.");

/**
 * Matches the Supabase default policy (8+ characters). Supabase also rejects
 * passwords above 72 bytes; we surface that as a validation error rather than a
 * provider failure.
 */
export const passwordField = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(72, "Le mot de passe ne peut pas dépasser 72 caractères.")
  .regex(/[A-Za-z]/, "Ajoutez au moins une lettre au mot de passe.")
  .regex(/[0-9]/, "Ajoutez au moins un chiffre au mot de passe.");

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Le mot de passe est requis."),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Indiquez votre nom complet.")
      .max(160, "Ce nom est trop long."),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
    next: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

export const requestPasswordResetSchema = z.object({ email: emailField });

export const updatePasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type UpdatePasswordValues = z.infer<typeof updatePasswordSchema>;
