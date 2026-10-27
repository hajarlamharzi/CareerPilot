import { logActivity } from "@/features/activity/logger";
import { workspaceStore } from "@/lib/storage";
import type { CvDocument, CvLibrary } from "@/types";

function readLibrary(): CvLibrary {
  return workspaceStore.read("cv") ?? { documents: [], activeId: null };
}

function writeLibrary(library: CvLibrary): void {
  workspaceStore.set("cv", library);
}

/** Insert (or replace by id) a CV document in the library. */
export function upsertCvDocument(document: CvDocument): CvDocument {
  const library = readLibrary();
  const exists = library.documents.some((doc) => doc.id === document.id);
  const documents = exists
    ? library.documents.map((doc) =>
        doc.id === document.id ? document : doc,
      )
    : [document, ...library.documents];
  const next: CvLibrary = {
    documents,
    activeId: library.activeId ?? document.id,
  };
  writeLibrary(next);
  logActivity({
    type: "cv-updated",
    message: exists
      ? `Saved changes to CV "${document.name}".`
      : `Added CV "${document.name}" to your library.`,
    entityId: document.id,
  });
  return document;
}

export function updateCvDocument(
  id: string,
  patch: Partial<CvDocument>,
): CvDocument | null {
  const library = readLibrary();
  const index = library.documents.findIndex((doc) => doc.id === id);
  if (index === -1) return null;
  const updated: CvDocument = {
    ...library.documents[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const documents = [...library.documents];
  documents[index] = updated;
  writeLibrary({ ...library, documents });
  logActivity({
    type: "cv-updated",
    message: `Saved changes to CV "${updated.name}".`,
    entityId: id,
  });
  return updated;
}

export function deleteCvDocument(id: string): void {
  const library = readLibrary();
  const target = library.documents.find((doc) => doc.id === id);
  const documents = library.documents.filter((doc) => doc.id !== id);
  writeLibrary({
    documents,
    activeId: library.activeId === id ? documents[0]?.id ?? null : library.activeId,
  });
  if (target) {
    logActivity({
      type: "cv-updated",
      message: `Deleted CV "${target.name}".`,
      entityId: null,
    });
  }
}

export function setActiveCv(id: string): void {
  const library = readLibrary();
  if (!library.documents.some((doc) => doc.id === id)) return;
  writeLibrary({ ...library, activeId: id });
  const doc = library.documents.find((entry) => entry.id === id);
  if (doc) {
    logActivity({
      type: "cv-updated",
      message: `"${doc.name}" is now your active CV.`,
      entityId: id,
    });
  }
}