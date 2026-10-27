/** Where a record originated: shipped sample data, or created by the user. */
export type Origin = "demo" | "user";

/** ISO-8601 date or date-time string. */
export type ISODateString = string;

export interface SalaryRange {
  min: number | null;
  max: number | null;
  /** ISO-4217 code, e.g. "USD", "EUR", "GBP". */
  currency: string;
  period: "year" | "month" | "day" | "hour" | null;
}

export interface RecruiterContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
}

/** A single point on an application's status history timeline. */
export interface StatusHistoryEntry {
  id: string;
  from: string | null;
  to: string;
  at: ISODateString;
  note: string | null;
}

/** Generic key/value tag. */
export type Tag = string;
