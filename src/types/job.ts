import type { ISODateString, Origin, SalaryRange, Tag } from "./common";

export type WorkMode = "remote" | "hybrid" | "onsite";

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship"
  | "temporary";

export type Seniority =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "principal";

/** Lifecycle status of a saved job (independent of application tracking). */
export type JobStatus = "saved" | "shortlisted" | "applied" | "archived";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  logo: string | null;
  description: string | null;
  industry: string | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyWebsite: string | null;
  companyLogo: string | null;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  seniority: Seniority | null;
  salary: SalaryRange | null;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number | null;
  education: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  publishedAt: ISODateString | null;
  deadline: ISODateString | null;
  addedAt: ISODateString;
  status: JobStatus;
  notes: string | null;
  tags: Tag[];
  origin: Origin;
}

/** Fields the user supplies when creating a job; the rest are defaulted. */
export type JobDraft = Omit<
  Job,
  "id" | "addedAt" | "origin" | "status" | "tags"
> & {
  status?: JobStatus;
  tags?: Tag[];
};

export type JobSortKey =
  | "addedAt"
  | "publishedAt"
  | "deadline"
  | "title"
  | "company"
  | "matchScore";

export interface JobFilters {
  query: string;
  workMode: WorkMode | "all";
  seniority: Seniority | "all";
  employmentType: EmploymentType | "all";
  sourceName: string | "all";
  status: JobStatus | "all";
  tag: string | "all";
  sort: JobSortKey;
  direction: "asc" | "desc";
}
