"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/config/constants";
import type { Job } from "@/types";
import {
  applicationFormSchema,
  emptyApplicationFormValues,
  type ApplicationFormValues,
} from "@/features/applications/application-form-schema";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const selectClass = `${inputClass} pr-8`;

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ApplicationFormProps {
  jobs: Job[];
  initialJobId?: string | null;
  onSubmit: (values: ApplicationFormValues) => void;
}

/**
 * Create/quick-edit form for an application. The linked job is optional, so
 * applications can be tracked without a saved listing.
 */
export function ApplicationForm({
  jobs,
  initialJobId = null,
  onSubmit,
}: ApplicationFormProps) {
  const idPrefix = useId().replace(/:/g, "");
  const initialJob = jobs.find((job) => job.id === initialJobId) ?? null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: emptyApplicationFormValues(initialJob),
  });

  const submit = handleSubmit(onSubmit);
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Position"
          htmlFor={fieldId("position")}
          error={errors.position?.message}
        >
          <Input
            id={fieldId("position")}
            placeholder="e.g. Frontend Developer"
            {...register("position")}
          />
        </Field>
        <Field
          label="Company"
          htmlFor={fieldId("company")}
          error={errors.company?.message}
        >
          <Input
            id={fieldId("company")}
            placeholder="e.g. Acme Corp"
            {...register("company")}
          />
        </Field>

        <Field label="Linked job" htmlFor={fieldId("jobId")}>
          <select
            id={fieldId("jobId")}
            className={selectClass}
            {...register("jobId")}
          >
            <option value="">Not linked to a job listing</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} — {job.company}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor={fieldId("status")}>
          <select
            id={fieldId("status")}
            className={selectClass}
            {...register("status")}
          >
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APPLICATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Applied on" htmlFor={fieldId("appliedAt")}>
          <Input id={fieldId("appliedAt")} type="date" {...register("appliedAt")} />
        </Field>
        <Field label="Source link" htmlFor={fieldId("sourceUrl")}>
          <Input
            id={fieldId("sourceUrl")}
            type="url"
            placeholder="https://…"
            {...register("sourceUrl")}
          />
        </Field>

        <Field label="Source name" htmlFor={fieldId("sourceName")}>
          <Input
            id={fieldId("sourceName")}
            placeholder="e.g. LinkedIn Jobs"
            {...register("sourceName")}
          />
        </Field>
        <Field label="Contact name" htmlFor={fieldId("contactName")}>
          <Input
            id={fieldId("contactName")}
            placeholder="Recruiter or hiring manager"
            {...register("contactName")}
          />
        </Field>

        <Field label="Contact email" htmlFor={fieldId("contactEmail")}>
          <Input
            id={fieldId("contactEmail")}
            type="email"
            placeholder="name@company.com"
            {...register("contactEmail")}
          />
        </Field>
        <Field label="Contact phone" htmlFor={fieldId("contactPhone")}>
          <Input
            id={fieldId("contactPhone")}
            placeholder="+1 …"
            {...register("contactPhone")}
          />
        </Field>
      </div>

      <Field label="First note" htmlFor={fieldId("notes")}>
        <Textarea
          id={fieldId("notes")}
          rows={3}
          placeholder="Anything worth remembering…"
          {...register("notes")}
        />
      </Field>

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button type="submit">
          <Send className="size-4" aria-hidden />
          Save application
        </Button>
      </div>
    </form>
  );
}

export { applicationFormToDraft } from "@/features/applications/application-form-schema";
export type { ApplicationFormValues } from "@/features/applications/application-form-schema";