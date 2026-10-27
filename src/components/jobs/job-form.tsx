"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LinkIcon, Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatSalaryPeriod } from "@/lib/format";
import type { Job } from "@/types";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SENIORITIES,
  WORK_MODES,
} from "@/config/constants";

import {
  emptyJobFormValues,
  jobFormLabels,
  jobFormSchema,
  jobFormToJob,
  jobToFormValues,
  SALARY_PERIODS,
  type JobFormValues,
} from "@/features/jobs/job-form-schema";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const selectClass = `${inputClass} pr-8`;

const optionList = (
  values: readonly string[] | readonly (string | "")[],
  labels: Record<string, string>,
  includeEmpty = false,
) => {
  const options = values.map((value) => ({
    value,
    label: value === "" ? "Not specified" : (labels[value] ?? value),
  }));
  if (includeEmpty && !values.includes("")) {
    options.unshift({ value: "", label: "Not specified" });
  }
  return options;
};

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface JobFormProps {
  initial?: Job;
  busy?: boolean;
  onSubmit: (values: JobFormValues) => void;
}

/**
 * Create/edit form for a job. Skills, responsibilities and tags are entered
 * one per line. Validation runs against `jobFormSchema` via zodResolver.
 */
export function JobForm({ initial, busy, onSubmit }: JobFormProps) {
  const idPrefix = useId().replace(/:/g, "");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: initial ? jobToFormValues(initial) : emptyJobFormValues(),
  });

  const submit = handleSubmit((values) => {
    onSubmit(values);
  });

  const fieldId = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Job title" htmlFor={fieldId("title")} error={errors.title?.message}>
          <Input
            id={fieldId("title")}
            placeholder="e.g. Junior Full Stack Developer"
            {...register("title")}
          />
        </Field>

        <Field label="Company" htmlFor={fieldId("company")} error={errors.company?.message}>
          <Input id={fieldId("company")} placeholder="e.g. Northwind Labs" {...register("company")} />
        </Field>

        <Field
          label="Location"
          htmlFor={fieldId("location")}
          error={errors.location?.message}
        >
          <Input id={fieldId("location")} placeholder="e.g. Remote (EU)" {...register("location")} />
        </Field>

        <Field
          label="Company website"
          htmlFor={fieldId("companyWebsite")}
          hint="Optional – used for the applicant contact flow."
        >
          <Input
            id={fieldId("companyWebsite")}
            placeholder="https://example.com"
            type="url"
            {...register("companyWebsite")}
          />
        </Field>

        <Field label="Work mode" htmlFor={fieldId("workMode")}>
          <select
            id={fieldId("workMode")}
            className={selectClass}
            {...register("workMode")}
          >
            {optionList(WORK_MODES, jobFormLabels.workMode).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Employment type" htmlFor={fieldId("employmentType")}>
          <select
            id={fieldId("employmentType")}
            className={selectClass}
            {...register("employmentType")}
          >
            {optionList(EMPLOYMENT_TYPES, jobFormLabels.employmentType).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Seniority" htmlFor={fieldId("seniority")}>
          <select id={fieldId("seniority")} className={selectClass} {...register("seniority")}>
            {optionList(SENIORITIES, jobFormLabels.seniority, true).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" htmlFor={fieldId("status")}>
          <select id={fieldId("status")} className={selectClass} {...register("status")}>
            {optionList(JOB_STATUSES, jobFormLabels.status).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="rounded-lg border p-4 space-y-4">
        <legend className="px-1 text-sm font-medium">Salary</legend>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Minimum" htmlFor={fieldId("salaryMin")}>
            <Input id={fieldId("salaryMin")} inputMode="numeric" placeholder="8000" {...register("salaryMin")} />
          </Field>
          <Field label="Maximum" htmlFor={fieldId("salaryMax")}>
            <Input id={fieldId("salaryMax")} inputMode="numeric" placeholder="13000" {...register("salaryMax")} />
          </Field>
          <Field label="Currency" htmlFor={fieldId("currency")}>
            <Input id={fieldId("currency")} placeholder="MAD, EUR, USD…" {...register("currency")} />
          </Field>
          <Field label="Period" htmlFor={fieldId("period")}>
            <select id={fieldId("period")} className={selectClass} {...register("period")}>
              {optionList(SALARY_PERIODS, {}, true).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === "" ? "Non précisé" : formatSalaryPeriod(option.value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <Field
        label="Description"
        htmlFor={fieldId("description")}
        hint="Paste the advert description so matching can compare it against your CV."
      >
        <Textarea id={fieldId("description")} rows={5} placeholder="What the role involves…" {...register("description")} />
      </Field>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field
          label="Responsibilities"
          htmlFor={fieldId("responsibilities")}
          hint="One per line."
        >
          <Textarea id={fieldId("responsibilities")} rows={5} placeholder={"Build React features\nWrite tests"} {...register("responsibilities")} />
        </Field>

        <Field label="Notes" htmlFor={fieldId("notes")}>
          <Textarea id={fieldId("notes")} rows={5} placeholder="Your private notes about this listing…" {...register("notes")} />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field
          label="Required skills"
          htmlFor={fieldId("requiredSkills")}
          error={errors.requiredSkills?.message}
          hint="One per line. These drive the deterministic match score."
        >
          <Textarea id={fieldId("requiredSkills")} rows={6} placeholder={"React\nTypeScript\nNode.js"} {...register("requiredSkills")} />
        </Field>
        <Field
          label="Preferred skills"
          htmlFor={fieldId("preferredSkills")}
          hint="One per line. Worth less than required skills in matching."
        >
          <Textarea id={fieldId("preferredSkills")} rows={6} placeholder={"Docker\nGraphQL"} {...register("preferredSkills")} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Experience (years)" htmlFor={fieldId("experienceYears")}>
          <Input id={fieldId("experienceYears")} inputMode="numeric" placeholder="2" {...register("experienceYears")} />
        </Field>
        <Field label="Education" htmlFor={fieldId("education")}>
          <Input id={fieldId("education")} placeholder="e.g. Degree in Computer Science" {...register("education")} />
        </Field>
        <Field label="Published" htmlFor={fieldId("publishedAt")}>
          <Input id={fieldId("publishedAt")} type="date" {...register("publishedAt")} />
        </Field>
        <Field label="Deadline" htmlFor={fieldId("deadline")}>
          <Input id={fieldId("deadline")} type="date" {...register("deadline")} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Source link"
          htmlFor={fieldId("sourceUrl")}
          hint={
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="size-3" aria-hidden /> Paste the URL where you found it.
            </span>
          }
        >
          <Input id={fieldId("sourceUrl")} type="url" placeholder="https://…" {...register("sourceUrl")} />
        </Field>
        <Field label="Source name" htmlFor={fieldId("sourceName")}>
          <Input id={fieldId("sourceName")} placeholder="e.g. LinkedIn Jobs" {...register("sourceName")} />
        </Field>
      </div>

      <Field label="Tags" htmlFor={fieldId("tags")} hint="One per line. Used for filtering and analytics.">
        <Textarea id={fieldId("tags")} rows={3} placeholder={"frontend\nremote"} {...register("tags")} />
      </Field>

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button type="submit" disabled={busy}>
          {busy ? (
            <Sparkles className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {initial ? "Save changes" : "Add job"}
        </Button>
      </div>
    </form>
  );
}

export { jobFormToJob, jobFormSchema };
export type { JobFormValues } from "@/features/jobs/job-form-schema";