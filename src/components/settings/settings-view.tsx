"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { PreferencesSection } from "@/components/settings/preferences-section";
import { AiSection } from "@/components/settings/ai-section";
import { StorageSection } from "@/components/settings/storage-section";
import { DataSection } from "@/components/settings/data-section";

const SECTIONS = [
  { id: "profile", label: "Profile & preferences" },
  { id: "ai", label: "AI configuration" },
  { id: "storage", label: "Storage" },
  { id: "data", label: "Your data" },
] as const;

/**
 * Settings workspace.
 *
 * Each section owns its own reads and writes, so one broken section never blocks
 * the rest of the page. `refreshKey` is bumped whenever a data action could have
 * changed what is stored, which tells the storage section to re-measure.
 */
export function SettingsView() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Your profile, how AI would be used, what is stored in this browser, and how to take it with you."
      />

      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <PreferencesSection />
      <AiSection />
      <StorageSection refreshKey={refreshKey} />
      <DataSection onDataChanged={() => setRefreshKey((key) => key + 1)} />
    </div>
  );
}
