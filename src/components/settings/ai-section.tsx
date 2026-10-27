"use client";

import { ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InlineAlert } from "@/components/shared/error-state";
import { useStoreReady, useWorkspaceDomain } from "@/hooks/use-workspace";
import {
  readPreferences,
  setAiNoticeAcknowledged,
  updatePreferences,
} from "@/features/workspace/preferences";
import type { AiProviderId } from "@/types";

const PROVIDERS: { value: AiProviderId; label: string; modelsHint: string }[] = [
  {
    value: "gemini",
    label: "Google Gemini",
    modelsHint: "e.g. gemini-2.5-flash",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    modelsHint: "e.g. anthropic/claude-3.5-sonnet",
  },
];

/**
 * AI configuration.
 *
 * CareerPilot currently performs every analysis locally, so this section is
 * deliberately honest: it stores the configuration you would use, but states
 * plainly that no request is made and no API key is collected yet. The stored
 * values travel with an export so they survive a device move.
 */
export function AiSection() {
  const ready = useStoreReady();
  const preferences = useWorkspaceDomain("preferences");
  const meta = useWorkspaceDomain("meta");

  if (!ready) {
    return (
      <section id="ai" className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading AI settings…</p>
      </section>
    );
  }

  const current = preferences ?? readPreferences();
  const acknowledged = meta?.aiNoticeAcknowledged ?? false;

  return (
    <section id="ai" className="scroll-mt-20 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">AI configuration</h2>
        <p className="text-sm text-muted-foreground">
          Where an AI provider would be used, and how your data is protected.
        </p>
      </header>

      <InlineAlert variant="info" icon={ShieldCheck} title="Nothing is sent today">
        This build performs every analysis in your browser. CareerPilot makes no
        network requests to an AI provider and does not ask for an API key yet.
        The settings below are stored locally (and included in your exports) so
        they apply as soon as AI features ship.
      </InlineAlert>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-provider" className="text-xs">
              Provider
            </Label>
            <select
              id="ai-provider"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={current.aiProvider ?? "none"}
              onChange={(event) =>
                updatePreferences({
                  aiProvider:
                    event.target.value === "none"
                      ? null
                      : (event.target.value as AiProviderId),
                })
              }
            >
              <option value="none">No provider selected</option>
              {PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-model" className="text-xs">
              Model
            </Label>
            <Input
              id="ai-model"
              value={current.aiModel}
              placeholder={
                PROVIDERS.find((provider) => provider.value === current.aiProvider)
                  ?.modelsHint ?? "Choose a provider first"
              }
              onChange={(event) =>
                updatePreferences({ aiModel: event.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="ai-store-key" className="text-sm font-medium">
                Remember the API key on this device
              </Label>
              <p className="text-xs text-muted-foreground">
                When keys are supported, this decides whether the key is written
                to this browser or kept in memory for the session only. Leaving
                it off is safer on a shared computer.
              </p>
            </div>
            <Switch
              id="ai-store-key"
              checked={current.storeApiKey}
              onCheckedChange={(checked) =>
                updatePreferences({ storeApiKey: checked })
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="ai-confirm" className="text-sm font-medium">
                Confirm before the first transmission
              </Label>
              <p className="text-xs text-muted-foreground">
                Show a summary of exactly what would leave your device before any
                personal data is sent to a provider.
              </p>
            </div>
            <Switch
              id="ai-confirm"
              checked={current.confirmBeforeAiSend}
              onCheckedChange={(checked) =>
                updatePreferences({ confirmBeforeAiSend: checked })
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="ai-acknowledged" className="text-sm font-medium">
                Data-sharing notice acknowledged
              </Label>
              <p className="text-xs text-muted-foreground">
                {acknowledged
                  ? "Recorded. You can switch this off to be asked again."
                  : "You will be shown what a provider would receive before anything is sent."}
              </p>
            </div>
            <Switch
              id="ai-acknowledged"
              checked={acknowledged}
              onCheckedChange={(checked) => setAiNoticeAcknowledged(checked)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
