import type { ISODateString, Origin } from "./common";

export type ActivityType =
  | "job-added"
  | "job-imported"
  | "job-updated"
  | "job-deleted"
  | "cv-uploaded"
  | "cv-updated"
  | "cv-generated"
  | "match-run"
  | "application-added"
  | "application-status"
  | "application-note"
  | "interview-saved"
  | "data-imported"
  | "data-exported"
  | "workspace-reset";

export interface ActivityEvent {
  id: string;
  at: ISODateString;
  type: ActivityType;
  message: string;
  entityId: string | null;
  origin: Origin;
}
