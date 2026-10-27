"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { buildWorkspaceSnapshot } from "../snapshot";
import type {
  AssistantJobCard,
  AssistantReply,
  AssistantStatus,
  ClientAction,
  ConversationTurnPayload,
  PendingConfirmation,
  ToolOutcomeView,
} from "../types";

/**
 * The assistant screen.
 *
 * A thin client over `/api/assistant`: validation, tool execution and permission
 * checks all happen server-side. The component's only privileged job is handing
 * the server the *local* workspace snapshot in demo mode — a signed-in caller's
 * data never leaves the server.
 */

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  reply?: AssistantReply;
  error?: string;
}

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  candidate: [
    "Trouve-moi des offres de développeur front-end en télétravail.",
    "Quelles compétences me manquent pour les offres enregistrées ?",
    "Résume mon CV en trois points forts.",
  ],
  admin: [
    "Trouve des offres de data engineer en France pour tester la recherche en direct.",
    "Quelles sources d'offres sont configurées sur ce déploiement ?",
    "Explique-moi ce que couvrent Adzuna et Jobicy, et ce qu'elles ne couvrent pas.",
  ],
};

const EMPTY_ARTIFACTS: AssistantReply["artifacts"] = {
  jobCards: [],
  confirmations: [],
  clientActions: [],
  toolTrace: [],
  injectionWarnings: [],
};

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Minimal, deliberately non-HTML Markdown renderer.
 *
 * Only bold, inline code, bullet lists and headings are interpreted. Links and
 * raw HTML are *not* rendered: assistant output can quote job descriptions from
 * third-party feeds, so nothing from the model is ever turned into markup or a
 * clickable URL. Job links always come from validated cards instead.
 */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={index}
          className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.8em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-inside list-disc space-y-0.5">
        {list.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <p key={`h-${blocks.length}`} className="font-semibold">
          {renderInline(heading[1])}
        </p>,
      );
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-border" />);
      continue;
    }
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  }
  flushList();

  return <div className="space-y-2 text-sm">{blocks}</div>;
}

function JobCardView({ job }: { job: AssistantJobCard }) {
  const external = isExternalHref(job.href);
  const className =
    "block rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40";

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{job.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {job.company} · {job.location}
          </p>
        </div>
        {job.matchScore !== null ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {job.matchScore}%
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {job.salaryLabel ? <span>{job.salaryLabel}</span> : null}
        {job.isSample ? (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
            Exemple de démonstration
          </span>
        ) : job.sourceName ? (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {job.sourceName}
          </span>
        ) : null}
        {job.alreadySaved ? (
          <span>Déjà enregistrée</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            {external ? "Voir l'offre d'origine" : "Ouvrir la fiche"}{" "}
            <ExternalLink className="size-3" aria-hidden="true" />
          </span>
        )}
      </div>
      {job.matchReasons.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
          {job.matchReasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {job.missingRequired.length > 0 ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          À compléter : {job.missingRequired.slice(0, 4).join(", ")}
        </p>
      ) : null}
    </>
  );

  if (external) {
    return (
      <a
        href={job.href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={job.href} className={className}>
      {content}
    </Link>
  );
}


function ConfirmationView({
  confirmation,
  onConfirm,
  pending,
}: {
  confirmation: PendingConfirmation;
  onConfirm: (confirmation: PendingConfirmation) => void;
  pending: boolean;
}) {
  // Expiry is enforced by the server when the token is presented, so the client
  // does not need to read the clock — it only reflects the pending state.
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-sm font-medium">Action à confirmer</p>
      <p className="mt-1 text-sm text-muted-foreground">{confirmation.summary}</p>
      {Object.keys(confirmation.details).length > 0 ? (
        <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {Object.entries(confirmation.details).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="font-medium">{key}</dt>
              <dd className="truncate">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="mt-3"
        disabled={pending}
        onClick={() => onConfirm(confirmation)}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Confirmer
      </Button>
    </div>
  );
}

function ClientActionView({ action }: { action: ClientAction }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm font-medium">{action.summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        À appliquer depuis vos écrans Offres ou Candidatures : l&apos;assistant ne
        modifie jamais vos données sans vous.
      </p>
    </div>
  );
}

function ReplyView({
  reply,
  onConfirm,
  confirmingTool,
}: {
  reply: AssistantReply;
  onConfirm: (confirmation: PendingConfirmation) => void;
  confirmingTool: string | null;
}) {
  return (
    <div className="space-y-3">
      <MarkdownText text={reply.text} />

      {reply.artifacts.jobCards.length > 0 ? (
        <div className="space-y-2">
          {reply.artifacts.jobCards.map((job) => (
            <JobCardView key={job.id} job={job} />
          ))}
        </div>
      ) : null}

      {reply.artifacts.confirmations.map((confirmation) => (
        <ConfirmationView
          key={confirmation.confirmationId || confirmation.tool}
          confirmation={confirmation}
          onConfirm={onConfirm}
          pending={confirmingTool === confirmation.tool}
        />
      ))}

      {reply.artifacts.clientActions.map((action, index) => (
        <ClientActionView key={`${action.action}-${index}`} action={action} />
      ))}

      {reply.artifacts.injectionWarnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-500/5 p-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            Du contenu externe contenait des instructions douteuses ; elles ont été
            ignorées et signalées.
          </p>
        </div>
      ) : null}

      {reply.artifacts.toolTrace.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="inline-flex cursor-pointer items-center gap-1">
            <Wrench className="size-3" aria-hidden="true" />
            Détail des étapes
          </summary>
          <ul className="mt-1 list-inside list-disc">
            {reply.artifacts.toolTrace.map((entry, index) => (
              <li key={`${entry.name}-${index}`}>
                {entry.name} — {entry.summary}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function AssistantChat({ roles = [] }: { roles?: string[] }) {
  const [status, setStatus] = React.useState<AssistantStatus | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<ChatEntry[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [confirmingTool, setConfirmingTool] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const isAdmin = roles.includes("admin");
  const roleLabel = isAdmin ? "Administrateur" : "Candidat";
  const suggestions = isAdmin ? SUGGESTIONS_BY_ROLE.admin : SUGGESTIONS_BY_ROLE.candidate;

  const sequence = React.useRef(0);
  const conversationId = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const nextId = React.useCallback(() => {
    sequence.current += 1;
    return `entry-${sequence.current}`;
  }, []);

  React.useEffect(() => {
    let active = true;
    fetch("/api/assistant", { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) {
          setStatusError(
            body?.error?.message ?? "Impossible de contacter l'assistant.",
          );
          return;
        }
        setStatus(body as AssistantStatus);
      })
      .catch(() => {
        if (active) setStatusError("Impossible de contacter l'assistant.");
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries.length]);

  const send = React.useCallback(
    async (raw: string, historyOverride?: ConversationTurnPayload[]) => {
      const message = raw.trim();
      if (!message) return;

      const history: ConversationTurnPayload[] =
        historyOverride ??
        entries
          .slice(-20)
          .map((entry) => ({ role: entry.role, content: entry.content }));

      setEntries((current) => [
        ...current,
        { id: nextId(), role: "user", content: message },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            conversationId: conversationId.current,
            snapshot: status?.mode === "local" ? buildWorkspaceSnapshot() : null,
          }),
          signal: controller.signal,
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          setEntries((current) => [
            ...current,
            {
              id: nextId(),
              role: "assistant",
              content: "",
              error: body?.error?.message ?? "L'assistant n'a pas pu répondre.",
            },
          ]);
          return;
        }

        if (typeof body?.conversationId === "string") {
          conversationId.current = body.conversationId;
        }

        const reply: AssistantReply = {
          text: body.text ?? "",
          blocked: Boolean(body.blocked),
          blockReason: body.blockReason ?? null,
          artifacts: {
            jobCards: body.artifacts?.jobCards ?? [],
            confirmations: body.artifacts?.confirmations ?? [],
            clientActions: body.artifacts?.clientActions ?? [],
            toolTrace: body.artifacts?.toolTrace ?? [],
            injectionWarnings: body.artifacts?.injectionWarnings ?? [],
          },
          steps: body.steps ?? 0,
        };

        setEntries((current) => [
          ...current,
          { id: nextId(), role: "assistant", content: reply.text, reply },
        ]);
      } catch (error) {
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        setEntries((current) => [
          ...current,
          {
            id: nextId(),
            role: "assistant",
            content: "",
            error: aborted
              ? "Réponse interrompue. Vous pouvez relancer la demande."
              : "Le service n'a pas répondu. Vérifiez votre connexion.",
          },
        ]);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [entries, nextId, status],
  );

  const handleSubmit = React.useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (pending || input.trim() === "") return;
      const value = input;
      setInput("");
      setPending(true);
      try {
        await send(value);
      } finally {
        setPending(false);
      }
    },
    [input, pending, send],
  );

  /** Abort the in-flight request. The partial answer is discarded, and said so. */
  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearConversation = React.useCallback(() => {
    abortRef.current?.abort();
    setEntries([]);
    conversationId.current = null;
    setInput("");
  }, []);

  const copyEntry = React.useCallback(async (entry: ChatEntry) => {
    const text = entry.reply?.text || entry.content;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === entry.id ? null : current));
      }, 1_500);
    } catch {
      // Clipboard permission denied: no copy, no error dialog.
    }
  }, []);

  /**
   * Re-run the last user message with the same preceding history.
   *
   * The failed/interrupted answer and everything after it are dropped first, so
   * retrying does not stack two answers to one question.
   */
  const retry = React.useCallback(async () => {
    if (pending) return;
    let lastUserIndex = -1;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex === -1) return;
    const message = entries[lastUserIndex].content;
    const history = entries
      .slice(0, lastUserIndex)
      .slice(-20)
      .map((entry) => ({ role: entry.role, content: entry.content }));
    setEntries(entries.slice(0, lastUserIndex));
    setPending(true);
    try {
      await send(message, history);
    } finally {
      setPending(false);
    }
  }, [entries, pending, send]);

  const handleConfirm = React.useCallback(
    async (confirmation: PendingConfirmation) => {
      setConfirmingTool(confirmation.tool);
      try {
        const response = await fetch("/api/assistant/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            confirmationId: confirmation.localOnly ? "" : confirmation.confirmationId,
            tool: confirmation.tool,
            args: confirmation.details,
            conversationId: null,
            snapshot: status?.mode === "local" ? buildWorkspaceSnapshot() : null,
          }),
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          setEntries((current) => [
            ...current,
            {
              id: nextId(),
              role: "assistant",
              content: "",
              error: body?.error?.message ?? "L'action n'a pas pu être confirmée.",
            },
          ]);
          return;
        }

        const outcome = (body?.outcome ?? { kind: "data" }) as ToolOutcomeView;
        const text =
          outcome.kind === "error"
            ? "L'action a échoué."
            : (outcome.summary ?? "Action enregistrée.");

        setEntries((current) => [
          ...current,
          {
            id: nextId(),
            role: "assistant",
            content: text,
            reply: {
              text,
              blocked: false,
              blockReason: null,
              steps: 0,
              artifacts: {
                ...EMPTY_ARTIFACTS,
                clientActions:
                  outcome.kind === "client_action"
                    ? [
                        {
                          action: outcome.action ?? "",
                          payload: outcome.payload ?? {},
                          summary: outcome.summary ?? "",
                        },
                      ]
                    : [],
              },
            },
          },
        ]);
      } catch {
        setEntries((current) => [
          ...current,
          {
            id: nextId(),
            role: "assistant",
            content: "",
            error: "Le service n'a pas répondu.",
          },
        ]);
      } finally {
        setConfirmingTool(null);
      }
    },
    [nextId, status],
  );

  if (statusError) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Assistant indisponible</CardTitle>
          <CardDescription>{statusError}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Chargement de l&apos;assistant…
      </div>
    );
  }

  if (!status.configured) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Assistant non configuré</CardTitle>
          <CardDescription>
            {status.reason ??
              "Aucun fournisseur d'IA n'est configuré sur ce déploiement."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Définissez{" "}
            <code className="rounded bg-muted px-1 py-0.5">AI_PROVIDER</code> et la
            clé correspondante (
            <code className="rounded bg-muted px-1 py-0.5">GEMINI_API_KEY</code> ou{" "}
            <code className="rounded bg-muted px-1 py-0.5">OPENROUTER_API_KEY</code>)
            dans les variables d&apos;environnement, puis redémarrez.
          </p>
          {status.keyUrl ? (
            <p>
              Obtenir une clé :{" "}
              <a
                className="text-primary underline underline-offset-4"
                href={status.keyUrl}
                target="_blank"
                rel="noreferrer"
              >
                {status.providerLabel ?? status.keyUrl}
              </a>
            </p>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/settings#ai">Ouvrir les paramètres IA</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Assistant
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              <ShieldCheck className="size-3" aria-hidden="true" />
              {roleLabel}
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardDescription>
              {status.providerLabel ?? "Fournisseur"} ·{" "}
              {status.model ?? "modèle par défaut"}
              {status.mode === "local"
                ? " · vos données locales sont envoyées avec chaque question."
                : ""}
            </CardDescription>
            {entries.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearConversation}
                disabled={pending}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Effacer
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <div
            ref={scrollRef}
            className="max-h-[28rem] space-y-4 overflow-y-auto pr-1"
            aria-live="polite"
          >
            {entries.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Posez une question en français : rechercher des offres, analyser
                  votre CV, préparer une candidature.
                  {isAdmin
                    ? " Les questions d'administration renvoient vers les pages dédiées, sans chiffres inventés."
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border px-3 py-1 text-left text-xs transition-colors hover:bg-accent"
                      disabled={pending}
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex flex-col gap-1",
                  entry.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2",
                    entry.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {entry.error ? (
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {entry.error}
                    </p>
                  ) : entry.reply ? (
                    <ReplyView
                      reply={entry.reply}
                      onConfirm={handleConfirm}
                      confirmingTool={confirmingTool}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
                  )}
                </div>
                {entry.role === "assistant" && (entry.content || entry.reply) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => void copyEntry(entry)}
                  >
                    {copiedId === entry.id ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3" aria-hidden="true" />
                    )}
                    {copiedId === entry.id ? "Copié" : "Copier"}
                  </Button>
                ) : null}
              </div>
            ))}

            {pending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                L&apos;assistant réfléchit…
              </div>
            ) : null}

            {!pending &&
            entries.length > 0 &&
            entries[entries.length - 1].role === "assistant" ? (
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void retry()}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Réessayer
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Écrivez votre question… (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)"
          rows={2}
          className="resize-none"
          aria-label="Message à l'assistant"
        />
        {pending ? (
          <Button type="button" variant="outline" onClick={stop}>
            <Square className="size-4" aria-hidden="true" />
            <span className="sr-only">Arrêter la réponse</span>
          </Button>
        ) : (
          <Button type="submit" disabled={input.trim() === ""}>
            <Send className="size-4" aria-hidden="true" />
            <span className="sr-only">Envoyer</span>
          </Button>
        )}
      </form>
      <p className="text-xs text-muted-foreground">
        Les offres affichées proviennent des sources interrogées : l&apos;assistant
        ne crée jamais d&apos;annonce, d&apos;entreprise, de salaire ni de lien de
        candidature.
      </p>
    </div>
  );
}
