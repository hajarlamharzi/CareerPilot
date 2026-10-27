import type { Metadata } from "next";

import { FindJobsView } from "@/features/jobs/live/find-jobs-view";

export const metadata: Metadata = {
  title: "Trouver des offres — CareerPilot",
  description:
    "Recherche en direct dans les sources d'offres publiques configurées (Adzuna, Jobicy), avec provenance et liens d'origine.",
};

export default function FindJobsPage() {
  return <FindJobsView />;
}
