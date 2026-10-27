import { z } from "zod";

import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  SENIORITIES,
  SENIORITY_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
} from "@/config/constants";
import type { Job, SalaryRange, Seniority, WorkMode } from "@/types";

/** Line-based fields (skills, responsibilities, tags) are entered one per line. */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export const SALARY_PERIODS = ["year", "month", "day", "hour", ""] as const;

export const jobFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  company: z.string().trim().min(1, "Company is required").max(160),
  companyWebsite: z.string().trim(),
  location: z.string().trim().min(1, "Location is required").max(160),
  workMode: z.enum(WORK_MODES),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  seniority: z.enum(SENIORITIES).or(z.literal("")),
  salaryMin: z.string(),
  salaryMax: z.string(),
  currency: z.string().trim().max(8),
  period: z.enum(SALARY_PERIODS),
  description: z.string(),
  responsibilities: z.string(),
  requiredSkills: z.string().min(1, "Add at least one required skill"),
  preferredSkills: z.string(),
  experienceYears: z.string(),
  education: z.string(),
  sourceUrl: z.string().trim(),
  sourceName: z.string().trim(),
  publishedAt: z.string(),
  deadline: z.string(),
  status: z.enum(JOB_STATUSES),
  notes: z.string(),
  tags: z.string(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const jobFormLabels = {
  workMode: WORK_MODE_LABELS,
  employmentType: EMPLOYMENT_TYPE_LABELS,
  seniority: SENIORITY_LABELS,
  status: JOB_STATUS_LABELS,
};

export function emptyJobFormValues(): JobFormValues {
  return {
    title: "",
    company: "",
    companyWebsite: "",
    location: "",
    workMode: "onsite",
    employmentType: "full-time",
    seniority: "",
    salaryMin: "",
    salaryMax: "",
    currency: "MAD",
    period: "month",
    description: "",
    responsibilities: "",
    requiredSkills: "",
    preferredSkills: "",
    experienceYears: "",
    education: "",
    sourceUrl: "",
    sourceName: "",
    publishedAt: "",
    deadline: "",
    status: "saved",
    notes: "",
    tags: "",
  };
}

/** Pre-fill the form from an existing job (for editing). */
export function jobToFormValues(job: Job): JobFormValues {
  const skills = (list: string[]) => list.join("\n");
  return {
    title: job.title,
    company: job.company,
    companyWebsite: job.companyWebsite ?? "",
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    seniority: job.seniority ?? "",
    salaryMin: job.salary?.min?.toString() ?? "",
    salaryMax: job.salary?.max?.toString() ?? "",
    currency: job.salary?.currency ?? "MAD",
    period: job.salary?.period ?? "month",
    description: job.description,
    responsibilities: skills(job.responsibilities),
    requiredSkills: skills(job.requiredSkills),
    preferredSkills: skills(job.preferredSkills),
    experienceYears: job.experienceYears?.toString() ?? "",
    education: job.education ?? "",
    sourceUrl: job.sourceUrl ?? "",
    sourceName: job.sourceName ?? "",
    publishedAt: job.publishedAt ?? "",
    deadline: job.deadline ?? "",
    status: job.status,
    notes: job.notes ?? "",
    tags: skills(job.tags),
  };
}

/** Convert validated form values into a Job (or the editable parts of one). */
export function jobFormToJob(values: JobFormValues): Omit<Job, "id"> {
  const salaryMin = toNullableNumber(values.salaryMin);
  const salaryMax = toNullableNumber(values.salaryMax);
  const salary: SalaryRange | null =
    salaryMin !== null || salaryMax !== null
      ? {
          min: salaryMin,
          max: salaryMax,
          currency: values.currency || "MAD",
          period: values.period === "" ? null : (values.period as SalaryRange["period"]),
        }
      : null;

  return {
    title: values.title.trim(),
    company: values.company.trim(),
    companyWebsite: toNull(values.companyWebsite),
    companyLogo: null,
    location: values.location.trim(),
    workMode: values.workMode as WorkMode,
    employmentType: values.employmentType,
    seniority: (values.seniority === "" ? null : values.seniority) as Seniority | null,
    salary,
    description: values.description.trim(),
    responsibilities: splitLines(values.responsibilities),
    requiredSkills: splitLines(values.requiredSkills),
    preferredSkills: splitLines(values.preferredSkills),
    experienceYears: values.experienceYears.trim() === "" ? null : toNullableNumber(values.experienceYears),
    education: toNull(values.education),
    sourceUrl: toNull(values.sourceUrl),
    sourceName: toNull(values.sourceName),
    publishedAt: values.publishedAt === "" ? null : `${values.publishedAt}T00:00:00.000Z`,
    deadline: values.deadline === "" ? null : `${values.deadline}T00:00:00.000Z`,
    addedAt: new Date().toISOString(),
    status: values.status,
    notes: toNull(values.notes),
    tags: splitLines(values.tags),
    origin: "user" as const,
  };
}