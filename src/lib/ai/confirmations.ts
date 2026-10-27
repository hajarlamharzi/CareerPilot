import "server-only";

import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { forbidden, invalidInput } from "@/lib/auth/errors";
import { ACTION_SIGNING_SECRET } from "@/lib/env.server";

/**
 * Server-signed confirmation tokens for data-changing AI actions.
 *
 * The problem this solves: the language model can *propose* "create an
 * application for this job", but it must not be able to *authorise* it. If the
 * model could simply emit `{ confirmed: true }`, the requirement to ask the user
 * before writing would be decorative.
 *
 * The flow:
 *
 *  1. The model calls a mutating tool (e.g. `create_application`).
 *  2. The server validates the arguments and the caller's permission, then
 *     **does not execute anything**. It mints a signed token containing the
 *     verified arguments, the user id and an expiry, and returns it with a
 *     human-readable summary.
 *  3. The UI renders a confirmation dialog bound to that token.
 *  4. Only when the user presses the button does the client POST the token to
 *     `/api/assistant/confirm`. The server verifies the HMAC, the user id and
 *     the expiry, then executes.
 *
 * Properties that fall out of this design:
 *
 *  * The model cannot forge a token (it never sees the signing secret).
 *  * A token minted for one user cannot be replayed by another (`sub` is bound).
 *  * Tokens expire, so a stale dialog cannot act minutes later.
 *  * Arguments cannot be swapped after the user approves them: they are inside
 *    the signed payload and are re-validated against the same Zod schema.
 */

const TOKEN_TTL_MS = 10 * 60_000;

export interface PendingAction {
  /** Tool to run once confirmed. */
  tool: string;
  /** Validated arguments, exactly as the user will have seen them. */
  args: Record<string, unknown>;
  /** Who approved it. Bound into the signature. */
  userId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Unique id, so the UI can key its dialog and audits can correlate. */
  nonce: string;
}

interface TokenPayload extends PendingAction {
  v: 1;
}

/**
 * The signing secret.
 *
 * Prefers an explicit `ACTION_SIGNING_SECRET`. Falls back to a random
 * per-process value, which is safe (tokens simply stop working after a restart)
 * but logs a warning so an operator notices that multi-instance deployments
 * should set a real secret.
 */
const secret: Buffer = (() => {
  if (ACTION_SIGNING_SECRET && ACTION_SIGNING_SECRET.length >= 32) {
    return Buffer.from(ACTION_SIGNING_SECRET, "utf8");
  }
  if (ACTION_SIGNING_SECRET) {
    console.warn(
      "[careerpilot] ACTION_SIGNING_SECRET is shorter than 32 characters; using it anyway. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
    return Buffer.from(ACTION_SIGNING_SECRET, "utf8");
  }
  console.warn(
    "[careerpilot] ACTION_SIGNING_SECRET is not set; AI action confirmations are signed with a " +
      "per-process random key. Set it in production, otherwise confirming an action after a " +
      "deploy or on another instance will fail.",
  );
  return randomBytes(32);
})();

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64url");

function sign(payloadPart: string): string {
  return createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

/** Mint a token the user can approve. The model never sees this value. */
export function createConfirmationToken(
  action: Omit<PendingAction, "expiresAt" | "nonce"> & { ttlMs?: number },
): { token: string; expiresAt: number; nonce: string } {
  const expiresAt = Date.now() + (action.ttlMs ?? TOKEN_TTL_MS);
  const nonce = randomUUID();

  const payload: TokenPayload = {
    v: 1,
    tool: action.tool,
    args: action.args,
    userId: action.userId,
    expiresAt,
    nonce,
  };

  const payloadPart = base64url(JSON.stringify(payload));
  return { token: `${payloadPart}.${sign(payloadPart)}`, expiresAt, nonce };
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Verify a token and return the action it authorises.
 *
 * Throws a typed error for every failure mode — malformed, wrong signature,
 * expired, or minted for a different user — so callers cannot accidentally treat
 * a failure as success.
 */
export function verifyConfirmationToken(
  token: string,
  expectedUserId: string,
  now: number = Date.now(),
): PendingAction {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw invalidInput("Jeton de confirmation illisible.");
  }

  const [payloadPart, signature] = parts as [string, string];
  if (!safeEqual(sign(payloadPart), signature)) {
    throw forbidden("Ce jeton de confirmation est invalide ou a été modifié.");
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    throw invalidInput("Jeton de confirmation illisible.");
  }

  if (payload.v !== 1 || typeof payload.tool !== "string") {
    throw invalidInput("Jeton de confirmation d'une version inconnue.");
  }
  if (payload.userId !== expectedUserId) {
    // Signature was valid, so this token was minted for somebody else.
    throw forbidden("Ce jeton de confirmation appartient à un autre compte.");
  }
  if (payload.expiresAt <= now) {
    throw invalidInput(
      "Cette confirmation a expiré (10 minutes). Relancez la demande à l'assistant.",
    );
  }

  return {
    tool: payload.tool,
    args: payload.args,
    userId: payload.userId,
    expiresAt: payload.expiresAt,
    nonce: payload.nonce,
  };
}

/** Exposed so tests can exercise signing with a known secret. */
export const __testing = { TOKEN_TTL_MS };
