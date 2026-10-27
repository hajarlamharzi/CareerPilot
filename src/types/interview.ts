import type { ISODateString, Origin } from "./common";

export type InterviewCategory =
  | "technical"
  | "behavioral"
  | "role-specific"
  | "cv-based"
  | "skill-gap"
  | "questions-to-ask";

export type InterviewDifficulty = "easy" | "medium" | "hard";

export type InterviewType =
  | "phone-screen"
  | "technical"
  | "behavioral"
  | "system-design"
  | "take-home"
  | "final";

export interface InterviewQuestion {
  id: string;
  jobId: string | null;
  applicationId: string | null;
  category: InterviewCategory;
  difficulty: InterviewDifficulty;
  type: InterviewType;
  question: string;
  /** STAR-format guidance generated locally or by the AI. */
  guidance: string | null;
  /** The candidate's own answer. Never auto-filled with fabricated facts. */
  userAnswer: string;
  practiced: boolean;
  origin: Origin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
