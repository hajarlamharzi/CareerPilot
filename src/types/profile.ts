import type { ISODateString } from "./common";

/** The workspace owner's profile. Distinct from an exported CV document. */
export interface CandidateProfile {
  id: string;
  fullName: string;
  headline: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  summary: string | null;
  updatedAt: ISODateString;
}
