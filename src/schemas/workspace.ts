import { z } from "zod";

import type { AppPreferences, WorkspaceMeta } from "@/types";

export const appPreferencesSchema: z.ZodType<AppPreferences> = z.object({
  theme: z.enum(["light", "dark", "system"]),
  locale: z.enum(["en", "fr"]),
  aiProvider: z.enum(["gemini", "openrouter"]).nullable(),
  aiModel: z.string(),
  storeApiKey: z.boolean(),
  confirmBeforeAiSend: z.boolean(),
});

export const workspaceMetaSchema: z.ZodType<WorkspaceMeta> = z.object({
  schemaVersion: z.number().int().positive(),
  workspaceMode: z.enum(["demo", "personal"]),
  seededAt: z.string().nullable(),
  lastModified: z.string().nullable(),
  onboarded: z.boolean(),
  aiNoticeAcknowledged: z.boolean(),
});
