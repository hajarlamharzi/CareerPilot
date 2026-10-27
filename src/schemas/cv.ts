import { z } from "zod";

import type {
  CertificationEntry,
  ContactDetails,
  CvDocument,
  CvLibrary,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  ProjectEntry,
} from "@/types";
import { isoDateStringSchema, originSchema } from "./common";

export const contactDetailsSchema: z.ZodType<ContactDetails> = z.object({
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
});

export const experienceEntrySchema: z.ZodType<ExperienceEntry> = z.object({
  id: z.string().min(1),
  role: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  current: z.boolean(),
  description: z.string(),
  highlights: z.array(z.string()),
  skills: z.array(z.string()),
});

export const educationEntrySchema: z.ZodType<EducationEntry> = z.object({
  id: z.string().min(1),
  degree: z.string(),
  institution: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  description: z.string().nullable(),
});

export const projectEntrySchema: z.ZodType<ProjectEntry> = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  url: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  highlights: z.array(z.string()),
  skills: z.array(z.string()),
});

export const certificationEntrySchema: z.ZodType<CertificationEntry> = z.object({
  id: z.string().min(1),
  name: z.string(),
  issuer: z.string().nullable(),
  date: z.string().nullable(),
  url: z.string().nullable(),
});

export const languageEntrySchema: z.ZodType<LanguageEntry> = z.object({
  id: z.string().min(1),
  name: z.string(),
  level: z.string(),
});

export const cvSectionContentSchema = z.object({
  summary: z.string(),
  skillGroups: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string(),
      skills: z.array(z.string()),
    }),
  ),
  experience: z.array(experienceEntrySchema),
  education: z.array(educationEntrySchema),
  projects: z.array(projectEntrySchema),
  certifications: z.array(certificationEntrySchema),
  languages: z.array(languageEntrySchema),
  achievements: z.array(
    z.object({ id: z.string().min(1), text: z.string() }),
  ),
});

export const cvDocumentSchema: z.ZodType<CvDocument> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  template: z.enum(["classic", "modern", "technical", "two-column"]),
  contact: contactDetailsSchema,
  title: z.string(),
  sections: cvSectionContentSchema,
  sourceText: z.string().nullable(),
  sourceFileName: z.string().nullable(),
  origin: originSchema,
  updatedAt: isoDateStringSchema,
});

export const cvLibrarySchema: z.ZodType<CvLibrary> = z.object({
  documents: z.array(cvDocumentSchema),
  activeId: z.string().nullable(),
});
