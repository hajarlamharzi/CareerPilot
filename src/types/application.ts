import type {
  ISODateString,
  Origin,
  RecruiterContact,
  SalaryRange,
  StatusHistoryEntry,
} from "./common";

export type ApplicationStatus =
  | "interested"
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "assessment"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface ApplicationNote {
  id: string;
  at: ISODateString;
  body: string;
}

export interface Application {
  id: string;
  jobId: string | null;
  company: string;
  position: string;
  status: ApplicationStatus;
  appliedAt: ISODateString | null;
  sourceUrl: string | null;
  sourceName: string | null;
  contact: RecruiterContact;
  notes: ApplicationNote[];
  followUpAt: ISODateString | null;
  interviewAt: ISODateString | null;
  salary: SalaryRange | null;
  history: StatusHistoryEntry[];
  origin: Origin;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ApplicationDraft = Omit<
  Application,
  "id" | "history" | "createdAt" | "updatedAt" | "origin"
> & {
  notes?: ApplicationNote[];
};
