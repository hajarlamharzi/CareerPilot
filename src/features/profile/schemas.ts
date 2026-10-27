import { z } from "zod";

/**
 * Profile form schema.
 *
 * Field names follow the database columns (`bio`, `websiteUrl`, …) so the action
 * can map them without a lookup table. The one place they differ is the local
 * workspace store, whose profile uses `summary` for the same content; that
 * mapping lives where the local write happens, not here.
 *
 * URLs are accepted only over `http`/`https`. That is a security control, not a
 * style preference: these values are stored, then rendered inside `href`
 * attributes across the app and in exported documents. A `javascript:` or
 * `data:` URL saved here would be a stored-XSS vector rather than a typo, so
 * every other scheme is rejected at the boundary.
 */
function isHttpUrl(value: string): boolean {
  if (value.length === 0) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(isHttpUrl, "Adresse invalide : elle doit commencer par http:// ou https://.")
  .optional()
  .default("");

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Le nom complet est requis.")
    .max(120, "Ce nom est trop long (120 caractères maximum)."),
  headline: optionalText(160),
  location: optionalText(160),
  phone: optionalText(40),
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  bio: optionalText(4000),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const EMPTY_PROFILE: ProfileUpdateInput = {
  fullName: "",
  headline: "",
  location: "",
  phone: "",
  websiteUrl: "",
  linkedinUrl: "",
  githubUrl: "",
  bio: "",
};
