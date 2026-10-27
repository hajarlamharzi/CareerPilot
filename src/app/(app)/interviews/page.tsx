import type { Metadata } from "next";

import { InterviewsView } from "@/components/interviews/interviews-view";

export const metadata: Metadata = { title: "Interviews" };

export default function InterviewsPage() {
  return <InterviewsView />;
}
