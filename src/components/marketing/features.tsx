import {
  BarChart3,
  FileText,
  KanbanSquare,
  MessagesSquare,
  Target,
  Upload,
} from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "Import jobs your way",
    description:
      "Add roles manually, paste a description, import from a public URL, or load the curated demo dataset. Duplicates are detected automatically.",
  },
  {
    icon: FileText,
    title: "CV parsing, in the browser",
    description:
      "Drop in a PDF, DOCX or TXT file. Text is extracted locally and turned into editable, structured fields — nothing is uploaded.",
  },
  {
    icon: Target,
    title: "Transparent match score",
    description:
      "A deterministic engine scores required skills, preferred skills, experience and role alignment — with the maths explained, no API key required.",
  },
  {
    icon: KanbanSquare,
    title: "Application pipeline",
    description:
      "Track every application on a drag-and-drop board with a keyboard-accessible alternative and a full status history.",
  },
  {
    icon: MessagesSquare,
    title: "Interview preparation",
    description:
      "Generate role-specific questions, write and save your own answers, and track what you have practised.",
  },
  {
    icon: BarChart3,
    title: "Analytics from real data",
    description:
      "Charts and conversion metrics calculated from the records you actually store — never invented numbers.",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="border-b border-border py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything for the job hunt, in one workspace
          </h2>
          <p className="mt-3 text-muted-foreground">
            Each feature is built to work without a backend, an account, or a
            paid API key.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
