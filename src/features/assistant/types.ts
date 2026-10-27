/**
 * Client-side view of the assistant contracts.
 *
 * These mirror the server's response shapes (`src/lib/ai/agent.ts`) rather than
 * importing them: the AI modules reach for `server-only` dependencies, and a
 * type-only re-export would still drag the module graph into the browser bundle.
 * The duplication is deliberate and small.
 */

export interface AssistantJobCard {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  seniority: string | null;
  salaryLabel: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  /** Provenance as returned by the server ("Donnée d'exemple", "Source externe en direct"…). */
  provenanceLabel?: string;
  provenanceKind?: string;
  isVerified?: boolean;
  publishedAt?: string | null;
  /** Internal listing page, or the upstream URL for a live listing. */
  href: string;
  matchScore: number | null;
  matchReasons: string[];
  missingRequired: string[];
  isSample: boolean;
  alreadySaved: boolean;
}

export interface PendingConfirmation {
  confirmationId: string;
  tool: string;
  /** What the model wants to do, already phrased in French. */
  summary: string;
  details: Record<string, unknown>;
  expiresAt: number;
  /** `true` when there is no signed identity (local demo mode). */
  localOnly: boolean;
}

export interface ClientAction {
  action: string;
  payload: Record<string, unknown>;
  summary: string;
}

export interface ToolTraceEntry {
  name: string;
  status: "ok" | "error" | "confirmation_required" | "client_action";
  summary: string;
  errorCode?: string;
}

export interface InjectionWarning {
  code: string;
  summary?: string;
  source?: string;
}

export interface AssistantArtifacts {
  jobCards: AssistantJobCard[];
  confirmations: PendingConfirmation[];
  clientActions: ClientAction[];
  toolTrace: ToolTraceEntry[];
  injectionWarnings: InjectionWarning[];
}

export interface AssistantReply {
  text: string;
  blocked: boolean;
  blockReason: string | null;
  artifacts: AssistantArtifacts;
  steps: number;
}

export interface AssistantStatus {
  configured: boolean;
  provider: string | null;
  providerLabel: string | null;
  model: string | null;
  keyUrl: string | null;
  quotaNote: string | null;
  reason: string | null;
  mode: "cloud" | "local";
  authenticated: boolean;
}

export interface ConversationTurnPayload {
  role: "user" | "assistant";
  content: string;
}

/** The subset of `ToolOutcome` the UI needs to render. */
export interface ToolOutcomeView {
  kind: "data" | "client_action" | "confirmation_required" | "error";
  summary?: string;
  action?: string;
  payload?: Record<string, unknown>;
  code?: string;
}

/**
 * The local-demo payload sent with a turn.
 *
 * Validated server-side against the very schemas the storage layer uses, so the
 * shape here only needs to be structurally right — unknown fields are stripped.
 */
export interface WorkspaceSnapshotPayload {
  profile: {
    fullName: string;
    headline: string | null;
    location: string | null;
    summary: string | null;
  };
  skills: string[];
  preferences: Record<string, unknown>;
  jobs: unknown[];
  applications: unknown[];
  savedJobIds: string[];
  cv: unknown;
}
