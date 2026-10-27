"use client";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CvDocument } from "@/types";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 border-b-2 border-foreground/20 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-foreground">
      {children}
    </h3>
  );
}

function DateRange({
  start,
  end,
  current,
}: {
  start: string | null;
  end: string | null;
  current: boolean;
}) {
  if (!start && !end) return null;
  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {start ? formatDate(start, { month: "short", year: "numeric" }) : "—"}
      {" – "}
      {current ? "Present" : end ? formatDate(end, { month: "short", year: "numeric" }) : "—"}
    </span>
  );
}

/**
 * Pure visual rendering of a CV document. A4-styled for preview and print;
 * the same data powers the PDF export.
 */
export function CvPreview({ doc, className }: { doc: CvDocument; className?: string }) {
  const { contact, title, sections } = doc;
  const contactItems = [
    contact.email,
    contact.phone,
    contact.location,
    contact.website,
    contact.linkedin,
    contact.github,
  ].filter(Boolean);

  const twoColumn = doc.template === "two-column";

  return (
    <div
      data-template={doc.template}
      className={cn(
        "mx-auto w-full max-w-[210mm] bg-white text-neutral-900 shadow-sm ring-1 ring-border print:shadow-none",
        className,
      )}
    >
      <div
        className={cn(
          "space-y-5 p-8 text-sm leading-relaxed",
          doc.template === "technical" && "font-mono",
          twoColumn && "grid grid-cols-[1fr_2fr] gap-6 p-8",
        )}
      >
        <div className={cn(twoColumn && "col-span-2", doc.template === "modern" && "border-b-4 border-primary")}>
          <h1 className="text-2xl font-bold tracking-tight">{contact.fullName}</h1>
          {title ? (
            <p
              className={cn(
                "mt-0.5 font-medium",
                doc.template === "classic" ? "text-center" : "text-primary",
              )}
            >
              {title}
            </p>
          ) : null}
          {contactItems.length > 0 && (
            <p
              className={cn(
                "mt-2 text-xs text-neutral-600",
                doc.template === "classic" && "text-center",
              )}
            >
              {contactItems.join("  ·  ")}
            </p>
          )}
        </div>

        {twoColumn ? (
          <>
            <div className="space-y-5">
              {sections.skillGroups.length > 0 && (
                <section>
                  <SectionHeading>Skills</SectionHeading>
                  <ul className="space-y-1 text-xs">
                    {sections.skillGroups.map((group) => (
                      <li key={group.id}>
                        <span className="font-semibold">{group.label}: </span>
                        {group.skills.join(", ")}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {sections.certifications.length > 0 && (
                <section>
                  <SectionHeading>Certifications</SectionHeading>
                  <ul className="space-y-1 text-xs">
                    {sections.certifications.map((cert, index) => (
                      <li key={cert.name + index}>
                        {cert.name}
                        {cert.issuer ? ` — ${cert.issuer}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {sections.languages.length > 0 && (
                <section>
                  <SectionHeading>Languages</SectionHeading>
                  <ul className="space-y-1 text-xs">
                    {sections.languages.map((lang) => (
                      <li key={lang.name}>
                        {lang.name}
                        {lang.level ? ` (${lang.level})` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {sections.achievements.length > 0 && (
                <section>
                  <SectionHeading>Achievements</SectionHeading>
                  <p className="whitespace-pre-line text-xs">
                    {sections.achievements.map((item) => item.text).join("\n")}
                  </p>
                </section>
              )}
            </div>
            <div className="space-y-5">
              {sections.summary && (
                <section>
                  <SectionHeading>Summary</SectionHeading>
                  <p className="whitespace-pre-line">{sections.summary}</p>
                </section>
              )}
              <ExperienceContent doc={doc} />
              {sections.education.length > 0 && <EducationContent doc={doc} />}
              {sections.projects.length > 0 && <ProjectsContent doc={doc} />}
            </div>
          </>
        ) : (
          <>
            {sections.summary && (
              <section>
                <SectionHeading>Summary</SectionHeading>
                <p className="whitespace-pre-line">{sections.summary}</p>
              </section>
            )}
            <ExperienceContent doc={doc} />
            {sections.skillGroups.length > 0 && (
              <section>
                <SectionHeading>Skills</SectionHeading>
                <ul className="space-y-1">
                  {sections.skillGroups.map((group) => (
                    <li key={group.id}>
                      <span className="font-semibold">{group.label}: </span>
                      {group.skills.join(", ")}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {sections.education.length > 0 && <EducationContent doc={doc} />}
            {sections.projects.length > 0 && <ProjectsContent doc={doc} />}
            {sections.certifications.length > 0 && (
              <section>
                <SectionHeading>Certifications</SectionHeading>
                <ul className="space-y-1">
                  {sections.certifications.map((cert, index) => (
                    <li key={cert.name + index}>
                      {cert.name}
                      {cert.issuer ? ` — ${cert.issuer}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {sections.languages.length > 0 && (
              <section>
                <SectionHeading>Languages</SectionHeading>
                <p>
                  {sections.languages
                    .map((lang) => (lang.level ? `${lang.name} (${lang.level})` : lang.name))
                    .join(", ")}
                </p>
              </section>
            )}
            {sections.achievements.length > 0 && (
              <section>
                <SectionHeading>Achievements</SectionHeading>
                <p className="whitespace-pre-line">
                  {sections.achievements.map((item) => item.text).join("\n")}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ExperienceContent({ doc }: { doc: CvDocument }) {
  const { experience } = doc.sections;
  if (experience.length === 0) return null;
  return (
    <section>
      <SectionHeading>Experience</SectionHeading>
      <ul className="space-y-3">
        {experience.map((entry) => (
          <li key={entry.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-semibold">{entry.role}</p>
              <DateRange start={entry.startDate} end={entry.endDate} current={entry.current} />
            </div>
            {entry.company && <p className="text-xs font-medium text-primary">{entry.company}</p>}
            {entry.description && (
              <p className="mt-0.5 text-xs text-neutral-700">{entry.description}</p>
            )}
            {entry.highlights.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {entry.highlights.map((highlight, index) => (
                  <li key={index}>{highlight}</li>
                ))}
              </ul>
            )}
            {entry.skills.length > 0 && (
              <p className="mt-1 text-xs text-neutral-600">
                <span className="font-medium">Skills:</span> {entry.skills.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EducationContent({ doc }: { doc: CvDocument }) {
  const { education } = doc.sections;
  return (
    <section>
      <SectionHeading>Education</SectionHeading>
      <ul className="space-y-2">
        {education.map((entry) => (
          <li key={entry.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-semibold">{entry.degree}</p>
              <DateRange start={entry.startDate} end={entry.endDate} current={false} />
            </div>
            {entry.institution && (
              <p className="text-xs text-muted-foreground">{entry.institution}</p>
            )}
            {entry.description && (
              <p className="text-xs text-neutral-700">{entry.description}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectsContent({ doc }: { doc: CvDocument }) {
  const { projects } = doc.sections;
  return (
    <section>
      <SectionHeading>Projects</SectionHeading>
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-semibold">{project.name}</p>
              <DateRange start={project.startDate} end={project.endDate} current={false} />
            </div>
            {project.url && (
              <a href={project.url} className="text-xs text-primary underline underline-offset-2">
                {project.url}
              </a>
            )}
            {project.description && (
              <p className="mt-0.5 text-xs text-neutral-700">{project.description}</p>
            )}
            {project.skills.length > 0 && (
              <p className="mt-0.5 text-xs text-neutral-600">
                <span className="font-medium">Skills:</span> {project.skills.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}