import type { ISODateString, Origin } from "./common";

export type CvTemplate = "classic" | "modern" | "technical" | "two-column";

export interface ContactDetails {
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  description: string;
  highlights: string[];
  skills: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  url: string | null;
  startDate: string | null;
  endDate: string | null;
  highlights: string[];
  skills: string[];
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string | null;
  date: string | null;
  url: string | null;
}

export interface LanguageEntry {
  id: string;
  name: string;
  level: string;
}

export interface CvSectionContent {
  summary: string;
  skillGroups: { id: string; label: string; skills: string[] }[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
  achievements: { id: string; text: string }[];
}

export interface CvDocument {
  id: string;
  name: string;
  template: CvTemplate;
  contact: ContactDetails;
  title: string;
  sections: CvSectionContent;
  /** Plain text extracted from an uploaded file, if any. */
  sourceText: string | null;
  sourceFileName: string | null;
  origin: Origin;
  updatedAt: ISODateString;
}

/** Result of parsing an uploaded CV locally. */
export interface CvExtraction {
  contact: ContactDetails;
  title: string | null;
  summary: string | null;
  skills: string[];
  experience: Omit<ExperienceEntry, "id">[];
  education: Omit<EducationEntry, "id">[];
  projects: Omit<ProjectEntry, "id">[];
  certifications: Omit<CertificationEntry, "id">[];
  languages: Omit<LanguageEntry, "id">[];
  achievements: string[];
  /** Warnings about incomplete/uncertain extraction. */
  warnings: string[];
  /** 0–1 rough confidence in the extraction quality. */
  confidence: number;
  rawText: string;
  charCount: number;
}

/** Lightweight metadata for an uploaded file stored in IndexedDB. */
export interface CvFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: ISODateString;
}

/** The user's CV library: all documents plus the currently active one. */
export interface CvLibrary {
  documents: CvDocument[];
  activeId: string | null;
}

/** A per-field suggestion produced by local tailoring or the AI. */
export interface CvSuggestion {
  id: string;
  target: "summary" | "experience" | "project" | "skills" | "title";
  label: string;
  rationale: string;
  before: string;
  after: string;
  /** True when applying the suggestion requires the user to confirm a fact. */
  requiresConfirmation: boolean;
}
