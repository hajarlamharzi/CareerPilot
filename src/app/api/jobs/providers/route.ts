import { withErrorHandling } from "@/lib/auth/errors";
import { getAiStatus } from "@/lib/ai";
import { listProviders } from "@/lib/jobs/live/search-service";

/**
 * Provider status endpoint — `GET /api/jobs/providers`.
 *
 * Powers the settings/status panel: which job sources exist, which are
 * configured, which credentials they need, which markets they document, plus
 * the AI provider status. Public on purpose: the information is deployment
 * configuration, never a secret, and guests need it to understand why a
 * source is unavailable.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const ai = getAiStatus();
  const jobs = listProviders();

  return Response.json({
    jobs: jobs.map((provider) => ({
      id: provider.id,
      label: provider.label,
      configured: provider.configured,
      requiredEnvVars: provider.requiredEnvVars,
      countries: provider.capabilities.countries,
      geoFilter: provider.capabilities.geoFilter,
      remoteOnly: provider.capabilities.remoteOnly,
      salary: provider.capabilities.salary,
      publicationDates: provider.capabilities.publicationDates,
      maxResults: provider.capabilities.maxResults,
      coverageNote: provider.capabilities.coverageNote,
    })),
    ai: {
      configured: ai.configured,
      provider: ai.provider,
      providerLabel: ai.providerLabel,
      model: ai.model,
      keyUrl: ai.keyUrl,
      quotaNote: ai.quotaNote,
      reason: ai.reason,
    },
  });
});
