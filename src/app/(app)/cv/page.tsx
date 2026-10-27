"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CloudUpload,
  FileText,
  FileType2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/loading";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logActivity } from "@/features/activity/logger";
import {
  deleteCvDocument,
  setActiveCv,
  upsertCvDocument,
} from "@/features/cv/cv-store";
import {
  blankCvDocument,
  cvDocumentFromExtraction,
  extractTextFromFile,
  structureCvText,
} from "@/lib/cv/parse";
import { cvFileStore } from "@/lib/storage/idb";
import { ACCEPTED_CV_EXTENSIONS, ACCEPTED_CV_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/config/app";
import { formatDate } from "@/lib/format";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

export default function CvLibraryPage() {
  const router = useRouter();
  const ready = useStoreReady();
  const cvLibrary = useWorkspaceDomain("cv");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);

  if (!ready) return <PageSkeleton />;

  const documents = cvLibrary?.documents ?? [];
  const activeId = cvLibrary?.activeId ?? null;

  async function handleFile(file: File) {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_CV_EXTENSIONS.includes(extension as (typeof ACCEPTED_CV_EXTENSIONS)[number])) {
      toast.error("Unsupported file type", {
        description: "Please upload a PDF, DOCX or TXT file.",
      });
      return;
    }
    if (file.type && !file.type.startsWith("text/") && !ACCEPTED_CV_MIME_TYPES.includes(file.type as (typeof ACCEPTED_CV_MIME_TYPES)[number])) {
      toast.error("Unsupported file type", {
        description: "The file doesn't look like a PDF, DOCX or TXT document.",
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File too large", {
        description: `Maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      });
      return;
    }

    setParsing(true);
    try {
      const { text, warnings } = await extractTextFromFile(file);
      const extraction = structureCvText(text);
      const doc = cvDocumentFromExtraction(extraction, {
        name: `${extraction.contact.fullName} — imported CV`,
      });
      doc.sourceFileName = file.name;

      await cvFileStore.put(doc.id, file, {
        id: doc.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: doc.updatedAt,
      });
      upsertCvDocument(doc);
      logActivity({
        type: "cv-uploaded",
        message: `Uploaded "${file.name}" and extracted ${text.length} characters in the browser.`,
        entityId: doc.id,
      });

      setParsing(false);
      toast.success("CV uploaded & extracted locally", {
        description:
          warnings.length > 0
            ? `${warnings.length} review note${warnings.length === 1 ? "" : "s"} — review the extracted fields.`
            : `Detected ${extraction.skills.length} skills, ${extraction.experience.length} roles and ${extraction.education.length} education entries.`,
      });
      router.push(`/cv/builder?id=${doc.id}`);
    } catch (error) {
      setParsing(false);
      toast.error("Extraction failed", {
        description:
          error instanceof Error ? error.message : "The document could not be read.",
      });
    }
  }

  function createBlank() {
    const doc = blankCvDocument();
    upsertCvDocument(doc);
    logActivity({
      type: "cv-generated",
      message: `Created a blank CV "${doc.name}".`,
      entityId: doc.id,
    });
    router.push(`/cv/builder?id=${doc.id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CV library"
        description="Upload a CV to extract it locally, or build one from scratch. Manage multiple profiles and pick the active document used for matching."
        actions={
          <>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
              {parsing ? (
                <Sparkles className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {parsing ? "Extracting…" : "Upload CV"}
            </Button>
            <Button onClick={createBlank}>
              <Plus className="size-4" aria-hidden />
              Create blank
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_CV_EXTENSIONS.join(",")}
        className="hidden"
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF, DOCX or TXT CV"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/50",
        )}
      >
        <CloudUpload className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">
          {parsing ? "Extracting text in your browser…" : "Drag & drop your CV here"}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX or TXT · up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB · never leaves your device
        </p>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No CV documents yet"
          description="Upload an existing CV to have it parsed locally, or create a blank one in the builder."
          action={
            <Button onClick={createBlank}>
              <FileType2 className="size-4" aria-hidden />
              Create blank CV
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const isActive = doc.id === activeId;
            return (
              <Card key={doc.id} className={cn(isActive && "border-primary/50")}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="size-4 text-muted-foreground" aria-hidden />
                      {doc.name}
                    </CardTitle>
                    {isActive && <Badge>Active</Badge>}
                  </div>
                  <CardDescription className="space-y-1">
                    <span>{doc.template} template</span>
                    {" · "}
                    <span>updated {formatDate(doc.updatedAt)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    {doc.sections.experience.length} experience ·{" "}
                    {doc.sections.skillGroups.reduce(
                      (sum, group) => sum + group.skills.length,
                      0,
                    )}{" "}
                    skills
                    {doc.sourceFileName ? ` · from ${doc.sourceFileName}` : ""}
                  </p>
                  {isActive && (
                    <p className="flex items-center gap-1 text-xs text-primary">
                      <Star className="size-3.5" aria-hidden />
                      Used for matching and tailoring
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/cv/builder?id=${doc.id}`}>
                        <Pencil className="size-3.5" aria-hidden />
                        Open builder
                      </Link>
                    </Button>
                    {!isActive && (
                      <Button size="sm" variant="outline" onClick={() => setActiveCv(doc.id)}>
                        Set active
                      </Button>
                    )}
                    <ConfirmDialog
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Delete
                        </Button>
                      }
                      title="Delete this CV?"
                      description={`"${doc.name}" and its stored source file will be removed from this browser.`}
                      confirmLabel="Delete CV"
                      onConfirm={() => {
                        deleteCvDocument(doc.id);
                        void cvFileStore.remove(doc.id);
                        toast.success("CV deleted");
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p>
            Uploaded documents are parsed entirely in your browser and stored as
            extracted text plus a copy of the original file in your browser&apos;s
            IndexedDB storage. Nothing is uploaded to a server. You can delete a
            document at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}