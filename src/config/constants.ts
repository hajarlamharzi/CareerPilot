import type {
  ApplicationStatus,
  EmploymentType,
  InterviewCategory,
  InterviewDifficulty,
  InterviewType,
  JobStatus,
  Seniority,
  WorkMode,
} from "@/types";

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote: "Télétravail",
  hybrid: "Hybride",
  onsite: "Sur site",
};

export const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
  "temporary",
] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  "full-time": "Temps plein",
  "part-time": "Temps partiel",
  contract: "Contrat",
  internship: "Stage",
  temporary: "Intérim",
};

export const SENIORITIES = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
] as const;

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: "Stagiaire",
  junior: "Junior",
  mid: "Confirmé",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
};

export const JOB_STATUSES = [
  "saved",
  "shortlisted",
  "applied",
  "archived",
] as const;

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Enregistrée",
  shortlisted: "Présélectionnée",
  applied: "Postulée",
  archived: "Archivée",
};

/**
 * Application pipeline. Order defines the Kanban column order.
 * `terminal` statuses stop the "active" pipeline count.
 */
export const APPLICATION_STATUSES = [
  "interested",
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
] as const satisfies readonly ApplicationStatus[];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "Intéressé",
  saved: "Enregistrée",
  applied: "Postulée",
  screening: "Présélection",
  interview: "Entretien",
  assessment: "Évaluation",
  offer: "Offre",
  rejected: "Refusée",
  withdrawn: "Retirée",
};

/** Tailwind classes for status pills. Kept here so all views agree. */
export const APPLICATION_STATUS_STYLES: Record<ApplicationStatus, string> = {
  interested:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25",
  saved:
    "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25",
  applied:
    "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25",
  screening:
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25",
  interview:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25",
  assessment:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25",
  offer:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25",
  rejected:
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25",
  withdrawn:
    "bg-stone-100 text-stone-600 ring-stone-200 dark:bg-stone-500/15 dark:text-stone-300 dark:ring-stone-500/25",
};

/** Statuses that end the pipeline (no longer "in progress"). */
export const TERMINAL_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "rejected",
  "withdrawn",
];

/** Statuses considered a positive response from the employer. */
export const RESPONSE_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "screening",
  "interview",
  "assessment",
  "offer",
];

export const MATCH_MODES = ["baseline", "ai"] as const;

export const MATCH_CATEGORIES = ["strong", "moderate", "low"] as const;

export const INTERVIEW_CATEGORIES = [
  "technical",
  "behavioral",
  "role-specific",
  "cv-based",
  "skill-gap",
  "questions-to-ask",
] as const;

export const INTERVIEW_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const INTERVIEW_TYPES = [
  "phone-screen",
  "technical",
  "behavioral",
  "system-design",
  "take-home",
  "final",
] as const;

export const INTERVIEW_CATEGORY_LABELS: Record<InterviewCategory, string> = {
  technical: "Technique",
  behavioral: "Comportemental",
  "role-specific": "Spécifique au poste",
  "cv-based": "Basé sur le CV",
  "skill-gap": "Lacune de compétences",
  "questions-to-ask": "Questions à poser",
};

export const INTERVIEW_DIFFICULTY_LABELS: Record<InterviewDifficulty, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  "phone-screen": "Téléphonique",
  technical: "Technique",
  behavioral: "Comportemental",
  "system-design": "Conception de système",
  "take-home": "Exercice à domicile",
  final: "Entretien final",
};

/**
 * Pipeline progress order used by the analytics funnel. `rejected` and
 * `withdrawn` are intentionally absent: they are outcomes, not progress, so an
 * application that was rejected at interview still counts as reaching interview.
 */
export const PIPELINE_PROGRESS = [
  "interested",
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
] as const satisfies readonly ApplicationStatus[];

/** Funnel steps shown on the analytics page, in order. */
export const FUNNEL_STAGES = [
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
] as const satisfies readonly ApplicationStatus[];

export const CV_TEMPLATES = [
  "classic",
  "modern",
  "technical",
  "two-column",
] as const;

export const AI_PROVIDERS = ["gemini", "openrouter"] as const;

export const LOCALES = ["en", "fr"] as const;
