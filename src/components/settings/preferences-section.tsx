"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import { readPreferences, updatePreferences } from "@/features/workspace/preferences";
import { updateProfile } from "@/features/workspace/profile";
import type { CandidateProfile, Locale, ThemePreference } from "@/types";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

/**
 * Profile and preferences.
 *
 * The profile is the same record the CV builder can prefill from, and the theme
 * control writes both to `next-themes` (which paints the page) and to the stored
 * preferences (which travel with an export).
 */
export function PreferencesSection() {
  const ready = useStoreReady();
  const profileDomain = useWorkspaceDomain("profile");
  const preferences = useWorkspaceDomain("preferences");
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  // The stored profile is the source of truth; edits live in a local draft so the
  // form can be saved explicitly. When the store changes underneath us (after a
  // save, an import, or a workspace reset) the draft is re-synced during render
  // instead of in an effect, which avoids a cascading re-render.
  const [draft, setDraft] = useState<CandidateProfile | null>(profileDomain);
  const [syncedFrom, setSyncedFrom] = useState<CandidateProfile | null>(
    profileDomain,
  );
  const [saving, setSaving] = useState(false);

  if (profileDomain !== syncedFrom) {
    setSyncedFrom(profileDomain);
    setDraft(profileDomain);
  }

  if (!ready || !draft) {
    return (
      <section
        id="profile"
        className="rounded-xl border border-border bg-card p-5"
        aria-busy="true"
      >
        <p className="text-sm text-muted-foreground">
          Loading your profile…
        </p>
      </section>
    );
  }

  const current = preferences ?? readPreferences();
  const activeTheme: ThemePreference = mounted
    ? ((theme as ThemePreference | undefined) ?? current.theme)
    : current.theme;

  function setField<K extends keyof CandidateProfile>(
    key: K,
    value: CandidateProfile[K],
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSaveProfile() {
    if (!draft) return;
    setSaving(true);
    const saved = updateProfile({
      fullName: draft.fullName,
      headline: draft.headline,
      email: draft.email,
      phone: draft.phone,
      location: draft.location,
      website: draft.website,
      linkedin: draft.linkedin,
      github: draft.github,
      summary: draft.summary,
    });
    setSaving(false);
    if (saved) toast.success("Profile saved.");
    else toast.error("Your profile could not be saved.");
  }

  function handleTheme(next: ThemePreference) {
    setTheme(next);
    updatePreferences({ theme: next });
  }

  return (
    <section id="profile" className="scroll-mt-20 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Profile &amp; preferences</h2>
        <p className="text-sm text-muted-foreground">
          Your details stay in this browser. They are used to prefill the CV
          builder and are included in any export you make.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Your details</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            id="profile-name"
            value={draft.fullName}
            onChange={(value) => setField("fullName", value)}
          />
          <Field
            label="Headline"
            id="profile-headline"
            placeholder="Frontend developer"
            value={draft.headline ?? ""}
            onChange={(value) => setField("headline", value || null)}
          />
          <Field
            label="Email"
            id="profile-email"
            type="email"
            value={draft.email ?? ""}
            onChange={(value) => setField("email", value || null)}
          />
          <Field
            label="Phone"
            id="profile-phone"
            value={draft.phone ?? ""}
            onChange={(value) => setField("phone", value || null)}
          />
          <Field
            label="Location"
            id="profile-location"
            placeholder="Paris, France"
            value={draft.location ?? ""}
            onChange={(value) => setField("location", value || null)}
          />
          <Field
            label="Website"
            id="profile-website"
            value={draft.website ?? ""}
            onChange={(value) => setField("website", value || null)}
          />
          <Field
            label="LinkedIn"
            id="profile-linkedin"
            value={draft.linkedin ?? ""}
            onChange={(value) => setField("linkedin", value || null)}
          />
          <Field
            label="GitHub"
            id="profile-github"
            value={draft.github ?? ""}
            onChange={(value) => setField("github", value || null)}
          />
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="profile-summary" className="text-xs">
            Summary
          </Label>
          <Textarea
            id="profile-summary"
            rows={4}
            value={draft.summary ?? ""}
            onChange={(event) => setField("summary", event.target.value || null)}
            placeholder="A short paragraph about what you do and what you are looking for."
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving}>
            <Save className="size-4" aria-hidden="true" />
            Save profile
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs">Appearance</Label>
            <div className="inline-flex rounded-lg bg-muted p-1">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTheme(option.value)}
                  aria-pressed={activeTheme === option.value}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    activeTheme === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pref-locale" className="text-xs">
              Language
            </Label>
            <select
              id="pref-locale"
              className="h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={current.locale}
              onChange={(event) =>
                updatePreferences({ locale: event.target.value as Locale })
              }
            >
              {LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only English content is available today. Your choice is stored and
              comes back with an export, so it applies as soon as translations
              ship.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="pref-confirm-ai" className="text-sm font-medium">
                Confirm before sending personal data to AI
              </Label>
              <p className="text-xs text-muted-foreground">
                Ask for confirmation the first time a feature would transmit your
                data to an AI provider. Recommended.
              </p>
            </div>
            <Switch
              id="pref-confirm-ai"
              checked={current.confirmBeforeAiSend}
              onCheckedChange={(checked) =>
                updatePreferences({ confirmBeforeAiSend: checked })
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
