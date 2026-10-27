import { z } from "zod";

import { APPLICATION_STATUSES } from "@/config/constants";
import { createId } from "@/lib/id";
import type { Application, ApplicationDraft, Job } from "@/types";

export const applicationFormSchema = z.object({
  position: z.string().trim().min(1, "Position is required").max(160),
  company: z.string().trim().min(1, "Company is required").max(160),
  jobId: z.string(),
  status: z.enum(APPLICATION_STATUSES),
  appliedAt: z.string(),
  sourceUrl: z.string().trim(),
  sourceName: z.string().trim(),
  contactName: z.string().trim(),
  contactEmail: z.string().trim(),
  contactPhone: z.string().trim(),
  contactRole: z.string().trim(),
  notes: z.string().trim(),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export function emptyApplicationFormValues(
  job: Job | null = null,
): ApplicationFormValues {
  return {
    position: job?.title ?? "",
    company: job?.company ?? "",
    jobId: job?.id ?? "",
    status: "applied",
    appliedAt: "",
    sourceUrl: job?.sourceUrl ?? "",
    sourceName: job?.sourceName ?? "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactRole: "",
    notes: "",
  };
}

export function applicationToFormValues(
  app: Application,
): ApplicationFormValues {
  return {
    position: app.position,
    company: app.company,
    jobId: app.jobId ?? "",
    status: app.status,
    appliedAt: app.appliedAt ? app.appliedAt.slice(0, 10) : "",
    sourceUrl: app.sourceUrl ?? "",
    sourceName: app.sourceName ?? "",
    contactName: app.contact.name ?? "",
    contactEmail: app.contact.email ?? "",
    contactPhone: app.contact.phone ?? "",
    contactRole: app.contact.role ?? "",
    notes: app.notes[0]?.body ?? "",
  };
}

/** Convert validated form values into a persistence-ready draft. */
export function applicationFormToDraft(
  values: ApplicationFormValues,
): ApplicationDraft {
  const now = new Date().toISOString();
  const notesBody = values.notes.trim();
  return {
    jobId: values.jobId || null,
    company: values.company,
    position: values.position,
    status: values.status,
    appliedAt: values.appliedAt
      ? `${values.appliedAt}T00:00:00.000Z`
      : null,
    sourceUrl: values.sourceUrl || null,
    sourceName: values.sourceName || null,
    contact: {
      name: values.contactName || null,
      email: values.contactEmail || null,
      phone: values.contactPhone || null,
      role: values.contactRole || null,
    },
    notes: notesBody
      ? [{ id: createId("note"), at: now, body: notesBody }]
      : [],
    followUpAt: null,
    interviewAt: null,
    salary: null,
  };
}