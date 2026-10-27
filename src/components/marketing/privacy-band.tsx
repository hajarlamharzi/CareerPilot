import Link from "next/link";
import { Cpu, HardDrive, KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const POINTS = [
  {
    icon: HardDrive,
    title: "Stored in your browser",
    description:
      "Jobs, CVs and applications are saved to your browser's local storage on this device. There is no central account or database.",
  },
  {
    icon: Cpu,
    title: "Processed on your device",
    description:
      "PDF and DOCX text extraction and PDF generation run in the browser. Your documents are never uploaded to a CareerPilot server.",
  },
  {
    icon: KeyRound,
    title: "You control the API key",
    description:
      "AI features are optional. You supply your own Gemini or OpenRouter key, and choose whether to remember it on this device.",
  },
  {
    icon: ShieldCheck,
    title: "Honest about limits",
    description:
      "When AI is enabled, the text you analyse is sent to the provider you choose. We say so clearly, and we never fake a response.",
  },
] as const;

export function PrivacyBand() {
  return (
    <section id="privacy" className="border-b border-border py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-5">
            <h2 className="text-3xl font-semibold tracking-tight">
              Private by design, not by marketing
            </h2>
            <p className="text-muted-foreground">
              CareerPilot has no backend. That makes the privacy story simple:
              your data stays on your device until you explicitly choose to send
              something to an AI provider.
            </p>
            <Button asChild variant="outline">
              <Link href="/privacy">Read the full privacy page</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {POINTS.map((point) => (
              <div
                key={point.title}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <point.icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">{point.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
