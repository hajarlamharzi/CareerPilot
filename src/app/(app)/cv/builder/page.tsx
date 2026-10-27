"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  BookOpen,
  Briefcase,
  Check,
  Code2,
  Download,
  FileText,
  FolderGit2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { PageSkeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CvPreview } from "@/components/cv/cv-preview";
import { updateCvDocument } from "@/features/cv/cv-store";
import { exportCvPdf } from "@/lib/cv/pdf";
import { createId } from "@/lib/id";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { CV_TEMPLATES } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { CvDocument } from "@/types";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitList(value: string): string[] {
  return value
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EditorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-b pb-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function EntryCard({
  title,
  onRemove,
  onMoveUp,
  onMoveDown,
  children,
}: {
  title: string;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{title || "Untitled"}</p>
        <div className="flex shrink-0 items-center gap-1">
          {onMoveUp && (
            <Button size="sm" variant="ghost" onClick={onMoveUp} aria-label="Move up">
              <ArrowUp className="size-4" aria-hidden />
            </Button>
          )}
          {onMoveDown && (
            <Button size="sm" variant="ghost" onClick={onMoveDown} aria-label="Move down">
              <ArrowDown className="size-4" aria-hidden />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove entry"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function CvBuilderPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CvBuilderContent />
    </Suspense>
  );
}

function CvBuilderContent() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");

  const ready = useStoreReady();
  const cvLibrary = useWorkspaceDomain("cv");

  if (!ready) return <PageSkeleton />;

  const documents = cvLibrary?.documents ?? [];
  const selectedId = requestedId ?? cvLibrary?.activeId ?? documents[0]?.id ?? null;
  const doc = documents.find((entry) => entry.id === selectedId) ?? null;

  if (!doc) {
    return (
      <EmptyState
        icon={FileText}
        title="No CV to edit"
        description="Create or upload a CV first, then edit it here with a live preview."
        action={
          <Button asChild>
            <Link href="/cv">Go to CV library</Link>
          </Button>
        }
      />
    );
  }

  return <BuilderEditor key={doc.id} doc={doc} />;
}

// --------------------------------------------------------------------------
// Editor (keyed by document id; local draft, explicit save)
// --------------------------------------------------------------------------

function BuilderEditor({ doc }: { doc: CvDocument }) {
  const router = useRouter();
  const [draft, setDraft] = useState<CvDocument>(() => structuredClone(doc) as CvDocument);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(doc),
    [draft, doc],
  );

  const setContact = (patch: Partial<CvDocument["contact"]>) =>
    setDraft((current) => ({ ...current, contact: { ...current.contact, ...patch } }));

  const patchSummary = (summary: string) =>
    setDraft((current) => ({ ...current, sections: { ...current.sections, summary } }));

  const patchExperience = (
    index: number,
    patch: Partial<CvDocument["sections"]["experience"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        experience: current.sections.experience.map((entry, i) =>
          i === index ? { ...entry, ...patch } : entry,
        ),
      },
    }));

  const moveExperience = (index: number, delta: number) =>
    setDraft((current) => {
      const list = [...current.sections.experience];
      const target = index + delta;
      if (target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...current, sections: { ...current.sections, experience: list } };
    });

  const patchSkillGroup = (
    index: number,
    patch: Partial<CvDocument["sections"]["skillGroups"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        skillGroups: current.sections.skillGroups.map((group, i) =>
          i === index ? { ...group, ...patch } : group,
        ),
      },
    }));

  const patchEducation = (
    index: number,
    patch: Partial<CvDocument["sections"]["education"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        education: current.sections.education.map((entry, i) =>
          i === index ? { ...entry, ...patch } : entry,
        ),
      },
    }));

  const patchProject = (
    index: number,
    patch: Partial<CvDocument["sections"]["projects"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        projects: current.sections.projects.map((project, i) =>
          i === index ? { ...project, ...patch } : project,
        ),
      },
    }));

  const patchCertification = (
    index: number,
    patch: Partial<CvDocument["sections"]["certifications"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        certifications: current.sections.certifications.map((cert, i) =>
          i === index ? { ...cert, ...patch } : cert,
        ),
      },
    }));

  const patchLanguage = (
    index: number,
    patch: Partial<CvDocument["sections"]["languages"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        languages: current.sections.languages.map((lang, i) =>
          i === index ? { ...lang, ...patch } : lang,
        ),
      },
    }));

  function handleSave() {
    setSaving(true);
    const saved = updateCvDocument(draft.id, draft);
    setSaving(false);
    if (saved) toast.success("CV saved");
    else toast.error("Could not save the CV");
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportCvPdf(draft);
      toast.success("PDF downloaded");
    } catch (error) {
      toast.error("PDF export failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => router.push("/cv")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Library
          </Button>
          <div>
            <p className="text-lg font-semibold leading-tight">{draft.name}</p>
            <p className="text-xs text-muted-foreground">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cv-template" className="text-sm font-medium text-muted-foreground">
            Template
          </label>
          <select
            id="cv-template"
            className={cn(inputClass, "w-44")}
            value={draft.template}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                template: event.target.value as CvDocument["template"],
              }))
            }
          >
            {CV_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {template.charAt(0).toUpperCase() + template.slice(1).replace("-", " ")}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Sparkles className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Export PDF
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <Sparkles className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden xl:order-1">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base">Editor</CardTitle>
            <CardDescription>
              ATS-friendly structure — keep it simple, chronological and factual.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="contact">
              <TabsList className="grid w-full grid-cols-5 rounded-none border-b bg-muted/40">
                <TabsTrigger value="contact" className="gap-1">
                  <User className="size-3.5" aria-hidden /> Contact
                </TabsTrigger>
                <TabsTrigger value="experience" className="gap-1">
                  <Briefcase className="size-3.5" aria-hidden /> Experience
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-1">
                  <Code2 className="size-3.5" aria-hidden /> Skills
                </TabsTrigger>
                <TabsTrigger value="education" className="gap-1">
                  <BookOpen className="size-3.5" aria-hidden /> Education
                </TabsTrigger>
                <TabsTrigger value="more" className="gap-1">
                  <FolderGit2 className="size-3.5" aria-hidden /> More
                </TabsTrigger>
              </TabsList>

              <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto p-4">
                <TabsContent value="contact" className="mt-0 space-y-4">
                  <EditorSection title="Who are you?">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name">
                        <Input
                          className={inputClass}
                          value={draft.contact.fullName}
                          onChange={(e) => setContact({ fullName: e.target.value })}
                        />
                      </Field>
                      <Field label="Professional title">
                        <Input
                          className={inputClass}
                          value={draft.title}
                          onChange={(e) =>
                            setDraft((current) => ({ ...current, title: e.target.value }))
                          }
                          placeholder="e.g. Frontend Developer"
                        />
                      </Field>
                      <Field label="Email">
                        <Input
                          className={inputClass}
                          type="email"
                          value={draft.contact.email ?? ""}
                          onChange={(e) => setContact({ email: e.target.value || null })}
                        />
                      </Field>
                      <Field label="Phone">
                        <Input
                          className={inputClass}
                          value={draft.contact.phone ?? ""}
                          onChange={(e) => setContact({ phone: e.target.value || null })}
                        />
                      </Field>
                      <Field label="Location">
                        <Input
                          className={inputClass}
                          value={draft.contact.location ?? ""}
                          onChange={(e) => setContact({ location: e.target.value || null })}
                        />
                      </Field>
                      <Field label="Website">
                        <Input
                          className={inputClass}
                          type="url"
                          value={draft.contact.website ?? ""}
                          onChange={(e) => setContact({ website: e.target.value || null })}
                        />
                      </Field>
                      <Field label="LinkedIn">
                        <Input
                          className={inputClass}
                          value={draft.contact.linkedin ?? ""}
                          onChange={(e) => setContact({ linkedin: e.target.value || null })}
                        />
                      </Field>
                      <Field label="GitHub">
                        <Input
                          className={inputClass}
                          value={draft.contact.github ?? ""}
                          onChange={(e) => setContact({ github: e.target.value || null })}
                        />
                      </Field>
                    </div>
                  </EditorSection>

                  <EditorSection title="Summary">
                    <Textarea
                      rows={5}
                      className="text-sm"
                      value={draft.sections.summary}
                      onChange={(e) => patchSummary(e.target.value)}
                      placeholder="Two or three sentences about what you do and the value you bring."
                    />
                  </EditorSection>
                </TabsContent>

                <TabsContent value="experience" className="mt-0 space-y-4">
                  <EditorSection
                    title="Work experience"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              experience: [
                                ...current.sections.experience,
                                {
                                  id: createId("exp"),
                                  role: "",
                                  company: "",
                                  location: null,
                                  startDate: null,
                                  endDate: null,
                                  current: false,
                                  description: "",
                                  highlights: [],
                                  skills: [],
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </Button>
                    }
                  >
                    {draft.sections.experience.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No experience entries yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {draft.sections.experience.map((entry, index) => (
                          <EntryCard
                            key={entry.id}
                            title={entry.role || "New role"}
                            onRemove={() =>
                              setDraft((current) => ({
                                ...current,
                                sections: {
                                  ...current.sections,
                                  experience: current.sections.experience.filter((_, i) => i !== index),
                                },
                              }))
                            }
                            onMoveUp={index === 0 ? undefined : () => moveExperience(index, -1)}
                            onMoveDown={
                              index === draft.sections.experience.length - 1
                                ? undefined
                                : () => moveExperience(index, 1)
                            }
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Role">
                                <Input
                                  className={inputClass}
                                  value={entry.role}
                                  onChange={(e) => patchExperience(index, { role: e.target.value })}
                                />
                              </Field>
                              <Field label="Company">
                                <Input
                                  className={inputClass}
                                  value={entry.company}
                                  onChange={(e) => patchExperience(index, { company: e.target.value })}
                                />
                              </Field>
                              <Field label="Start">
                                <Input
                                  className={inputClass}
                                  type="month"
                                  value={entry.startDate ?? ""}
                                  onChange={(e) => patchExperience(index, { startDate: e.target.value || null })}
                                />
                              </Field>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">End</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    className={inputClass}
                                    type="month"
                                    value={entry.endDate ?? ""}
                                    disabled={entry.current}
                                    onChange={(e) => patchExperience(index, { endDate: e.target.value || null })}
                                  />
                                  <label className="flex shrink-0 items-center gap-1.5 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={entry.current}
                                      onChange={(e) =>
                                        patchExperience(index, {
                                          current: e.target.checked,
                                          endDate: e.target.checked ? null : entry.endDate,
                                        })
                                      }
                                    />
                                    Current
                                  </label>
                                </div>
                              </div>
                            </div>
                            <Field label="Description">
                              <Textarea
                                className="text-sm"
                                rows={2}
                                value={entry.description}
                                onChange={(e) => patchExperience(index, { description: e.target.value })}
                              />
                            </Field>
                            <Field label="Highlights — one per line">
                              <Textarea
                                className="text-sm"
                                rows={3}
                                value={entry.highlights.join("\n")}
                                onChange={(e) => patchExperience(index, { highlights: splitLines(e.target.value) })}
                              />
                            </Field>
                            <Field label="Skills used — comma separated">
                              <Input
                                className={inputClass}
                                value={entry.skills.join(", ")}
                                onChange={(e) => patchExperience(index, { skills: splitList(e.target.value) })}
                              />
                            </Field>
                          </EntryCard>
                        ))}
                      </div>
                    )}
                  </EditorSection>
                </TabsContent>

                <TabsContent value="skills" className="mt-0 space-y-4">
                  <EditorSection
                    title="Skill groups"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              skillGroups: [
                                ...current.sections.skillGroups,
                                { id: createId("group"), label: "New group", skills: [] },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add group
                      </Button>
                    }
                  >
                    {draft.sections.skillGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No skill groups. Skills drive the match score, so add at least one.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {draft.sections.skillGroups.map((group, index) => (
                          <div key={group.id} className="space-y-3 rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <Input
                                className={cn(inputClass, "max-w-56")}
                                value={group.label}
                                onChange={(e) => patchSkillGroup(index, { label: e.target.value })}
                                aria-label="Group label"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    sections: {
                                      ...current.sections,
                                      skillGroups: current.sections.skillGroups.filter((_, i) => i !== index),
                                    },
                                  }))
                                }
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </div>
                            <Field label="Skills — comma or newline separated">
                              <Textarea
                                className="text-sm"
                                rows={3}
                                value={group.skills.join(", ")}
                                onChange={(e) => patchSkillGroup(index, { skills: splitList(e.target.value) })}
                              />
                            </Field>
                          </div>
                        ))}
                      </div>
                    )}
                  </EditorSection>
                </TabsContent>

                <TabsContent value="education" className="mt-0 space-y-4">
                  <EditorSection
                    title="Education"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              education: [
                                ...current.sections.education,
                                {
                                  id: createId("edu"),
                                  degree: "",
                                  institution: "",
                                  location: null,
                                  startDate: null,
                                  endDate: null,
                                  description: null,
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </Button>
                    }
                  >
                    {draft.sections.education.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No education entries yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {draft.sections.education.map((entry, index) => (
                          <EntryCard
                            key={entry.id}
                            title={entry.degree || "New degree"}
                            onRemove={() =>
                              setDraft((current) => ({
                                ...current,
                                sections: {
                                  ...current.sections,
                                  education: current.sections.education.filter((_, i) => i !== index),
                                },
                              }))
                            }
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Degree">
                                <Input
                                  className={inputClass}
                                  value={entry.degree}
                                  onChange={(e) => patchEducation(index, { degree: e.target.value })}
                                />
                              </Field>
                              <Field label="Institution">
                                <Input
                                  className={inputClass}
                                  value={entry.institution}
                                  onChange={(e) => patchEducation(index, { institution: e.target.value })}
                                />
                              </Field>
                              <Field label="Start">
                                <Input
                                  className={inputClass}
                                  type="month"
                                  value={entry.startDate ?? ""}
                                  onChange={(e) => patchEducation(index, { startDate: e.target.value || null })}
                                />
                              </Field>
                              <Field label="End">
                                <Input
                                  className={inputClass}
                                  type="month"
                                  value={entry.endDate ?? ""}
                                  onChange={(e) => patchEducation(index, { endDate: e.target.value || null })}
                                />
                              </Field>
                            </div>
                          </EntryCard>
                        ))}
                      </div>
                    )}
                  </EditorSection>
                </TabsContent>

                <TabsContent value="more" className="mt-0 space-y-4">
                  <EditorSection
                    title="Projects"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              projects: [
                                ...current.sections.projects,
                                {
                                  id: createId("prj"),
                                  name: "",
                                  description: "",
                                  url: null,
                                  startDate: null,
                                  endDate: null,
                                  highlights: [],
                                  skills: [],
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </Button>
                    }
                  >
                    {draft.sections.projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No projects yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {draft.sections.projects.map((project, index) => (
                          <EntryCard
                            key={project.id}
                            title={project.name || "New project"}
                            onRemove={() =>
                              setDraft((current) => ({
                                ...current,
                                sections: {
                                  ...current.sections,
                                  projects: current.sections.projects.filter((_, i) => i !== index),
                                },
                              }))
                            }
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Name">
                                <Input
                                  className={inputClass}
                                  value={project.name}
                                  onChange={(e) => patchProject(index, { name: e.target.value })}
                                />
                              </Field>
                              <Field label="URL">
                                <Input
                                  className={inputClass}
                                  type="url"
                                  value={project.url ?? ""}
                                  onChange={(e) => patchProject(index, { url: e.target.value || null })}
                                />
                              </Field>
                            </div>
                            <Field label="Description">
                              <Textarea
                                className="text-sm"
                                rows={2}
                                value={project.description}
                                onChange={(e) => patchProject(index, { description: e.target.value })}
                              />
                            </Field>
                            <Field label="Skills — comma separated">
                              <Input
                                className={inputClass}
                                value={project.skills.join(", ")}
                                onChange={(e) => patchProject(index, { skills: splitList(e.target.value) })}
                              />
                            </Field>
                          </EntryCard>
                        ))}
                      </div>
                    )}
                  </EditorSection>

                  <EditorSection
                    title="Certifications"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              certifications: [
                                ...current.sections.certifications,
                                { id: createId("cert"), name: "", issuer: null, date: null, url: null },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </Button>
                    }
                  >
                    {draft.sections.certifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No certifications yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {draft.sections.certifications.map((cert, index) => (
                          <div
                            key={index}
                            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
                          >
                            <Input
                              className={inputClass}
                              value={cert.name}
                              onChange={(e) => patchCertification(index, { name: e.target.value })}
                              placeholder="Certification"
                              aria-label="Certification name"
                            />
                            <Input
                              className={inputClass}
                              value={cert.issuer ?? ""}
                              onChange={(e) => patchCertification(index, { issuer: e.target.value || null })}
                              placeholder="Issuer"
                              aria-label="Issuer"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  sections: {
                                    ...current.sections,
                                    certifications: current.sections.certifications.filter((_, i) => i !== index),
                                  },
                                }))
                              }
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </EditorSection>

                  <EditorSection
                    title="Languages"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              languages: [
                                ...current.sections.languages,
                                { id: createId("lang"), name: "", level: "" },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </Button>
                    }
                  >
                    {draft.sections.languages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No languages yet.</p>
                    ) : (
                      <div className="max-h-72 space-y-3 overflow-y-auto">
                        {draft.sections.languages.map((lang, index) => (
                          <div
                            key={lang.id}
                            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
                          >
                            <Input
                              className={inputClass}
                              value={lang.name}
                              onChange={(e) => patchLanguage(index, { name: e.target.value })}
                              placeholder="Language"
                              aria-label="Language"
                            />
                            <Input
                              className={inputClass}
                              value={lang.level}
                              onChange={(e) => patchLanguage(index, { level: e.target.value })}
                              placeholder="Level (e.g. Native)"
                              aria-label="Level"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  sections: {
                                    ...current.sections,
                                    languages: current.sections.languages.filter((_, i) => i !== index),
                                  },
                                }))
                              }
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </EditorSection>

                  <EditorSection
                    title="Achievements"
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sections: {
                              ...current.sections,
                              achievements: [
                                ...current.sections.achievements,
                                { id: createId("ach"), text: "" },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="size-3.5" aria-hidden /> Add
                      </Button>
                    }
                  >
                    {draft.sections.achievements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No achievements yet. Only add real ones — the app never invents them.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {draft.sections.achievements.map((item, index) => (
                          <div key={item.id} className="flex gap-2">
                            <Input
                              className={inputClass}
                              value={item.text}
                              onChange={(e) =>
                                setDraft((current) => ({
                                  ...current,
                                  sections: {
                                    ...current.sections,
                                    achievements: current.sections.achievements.map((a, i) =>
                                      i === index ? { ...a, text: e.target.value } : a,
                                    ),
                                  },
                                }))
                              }
                              placeholder="An achievement"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  sections: {
                                    ...current.sections,
                                    achievements: current.sections.achievements.filter((_, i) => i !== index),
                                  },
                                }))
                              }
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </EditorSection>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-3 xl:order-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Award className="size-4" aria-hidden />
              Live preview
            </p>
            <Badge variant="outline">
              {draft.template.charAt(0).toUpperCase() + draft.template.slice(1).replace("-", " ")}
            </Badge>
          </div>
          <div className="overflow-hidden rounded-xl bg-neutral-200/60 p-4 dark:bg-neutral-800/60">
            <CvPreview doc={draft} />
          </div>
          <p className="text-xs text-muted-foreground">
            <Check className="mr-1 inline size-3.5 text-emerald-600" aria-hidden />
            Single-column layouts parse more reliably with ATS software.
          </p>
        </div>
      </div>
    </div>
  );
}