const STEPS = [
  {
    step: "01",
    title: "Import or create a job",
    description:
      "Paste a job description, add a public URL, or start from one of the fictional demo listings. Every field stays editable.",
  },
  {
    step: "02",
    title: "Upload your CV",
    description:
      "PDF, DOCX or TXT is parsed in your browser. Review and correct the extracted contact details, skills and experience.",
  },
  {
    step: "03",
    title: "Analyse the match",
    description:
      "See a transparent score, matching skills, gaps and concrete CV improvements. Optionally add an AI second opinion.",
  },
  {
    step: "04",
    title: "Tailor, export and track",
    description:
      "Generate an ATS-friendly CV, export a real PDF, then move the application through your pipeline to offer.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            How the CV matching workflow works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Four steps from a job posting to a tailored, exportable CV.
          </p>
        </div>

        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <li
              key={item.step}
              className="relative rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="text-sm font-semibold text-primary">
                {item.step}
              </span>
              <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
