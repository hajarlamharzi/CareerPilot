"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { JobForm } from "@/components/jobs/job-form";
import { createJob } from "@/features/jobs/job-store";
import {
  jobFormSchema,
  jobFormToJob,
  type JobFormValues,
} from "@/features/jobs/job-form-schema";

export default function NewJobPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function handleSubmit(values: JobFormValues) {
    const parsed = jobFormSchema.safeParse(values);
    if (!parsed.success) return;
    setBusy(true);
    const job = createJob(jobFormToJob(parsed.data));
    toast.success("Job added", {
      description: `${job.title} at ${job.company} is now in your tracker.`,
    });
    router.push(`/jobs/${job.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => router.push("/jobs")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to jobs
        </Button>
        <PageHeader
          title="Add a job"
          description="Save a listing so you can track it, match it against your CV and apply."
        />
      </div>

      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <JobForm busy={busy} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}