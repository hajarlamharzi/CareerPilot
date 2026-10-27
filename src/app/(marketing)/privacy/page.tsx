import type { Metadata } from "next";
import Link from "next/link";
import {
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

import { APP_NAME } from "@/config/app";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineAlert } from "@/components/shared/error-state";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How CareerPilot handles your data: browser-local storage, in-browser document processing, and optional AI provider requests.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 lg:px-6 lg:py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Privacy &amp; data handling
        </h1>
        <p className="text-muted-foreground">
          This page describes exactly what {APP_NAME} does with your data. It is
          written to be accurate about a browser-only application — including
          where the limits are.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <InlineAlert variant="info" icon={ShieldCheck} title="The short version">
          CareerPilot has no backend and no account system. Your records are
          stored in your browser. The only time data leaves your device is when
          you explicitly run an AI feature against a provider you configured
          yourself.
        </InlineAlert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="size-4 text-primary" />
              What is stored, and where
            </CardTitle>
            <CardDescription>
              Local browser storage, not a central database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Jobs, applications, interviews, matches, preferences and the
              profile you create are saved to your browser&apos;s{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                localStorage
              </code>{" "}
              under namespaced keys such as{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                careerpilot:v1:jobs
              </code>
              .
            </p>
            <p>
              Uploaded CV files (binaries) are kept in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                IndexedDB
              </code>
              , which is designed for larger files than localStorage.
            </p>
            <p>
              This data is tied to this browser profile on this device. It is{" "}
              <strong className="font-medium text-foreground">
                not synchronised
              </strong>{" "}
              to any server or across devices.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              Document processing stays local
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              CV text extraction (PDF.js, Mammoth) and PDF export (jsPDF) run
              entirely in your browser. Uploaded documents are never sent to a
              CareerPilot server — because there is no server.
            </p>
            <p>
              If a PDF is a scan or contains only images, text extraction cannot
              work. {APP_NAME} will tell you that plainly instead of pretending
              it succeeded.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              AI providers and your API key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              AI features are{" "}
              <strong className="font-medium text-foreground">optional</strong>.
              To use them you supply your own Google Gemini or OpenRouter API
              key. Requests go directly from your browser to that provider.
            </p>
            <p>
              You choose whether the key is remembered on this device. If you do
              not opt in, it is held in memory for the current session only and
              is lost on refresh. API keys are{" "}
              <strong className="font-medium text-foreground">
                excluded from data exports
              </strong>{" "}
              and are never logged.
            </p>
            <p>
              When you run an AI feature, the relevant CV text and/or job
              description is sent to your chosen provider. Do not run AI features
              on documents you are not comfortable transmitting to that provider.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              What is not collected
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {APP_NAME} does not include third-party analytics, advertising
              trackers, or telemetry about your usage. No personal information is
              transmitted to the project maintainers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-4 text-primary" />
              Export, import and limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              You can export your workspace as JSON and re-import it. Exports
              exclude API keys and binary CV files by default.
            </p>
            <p>
              Clearing your browser&apos;s site data will delete your records —
              that is the trade-off of a backend-free design. Keep exports if the
              data matters to you.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-primary" />
              Deleting your data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Use <strong className="font-medium text-foreground">Settings</strong>{" "}
              to delete individual records, remove a stored CV, clear saved API
              keys, reset the demo workspace, or clear all locally stored data.
            </p>
            <p>
              Browser-local data is not protected from someone who has access to
              the same browser profile. Treat a shared device accordingly.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/settings">Open settings</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to the workspace</Link>
        </Button>
      </div>
    </div>
  );
}
