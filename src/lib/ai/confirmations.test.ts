import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/auth/errors";

import { __testing, createConfirmationToken, verifyConfirmationToken } from "./confirmations";

/**
 * Confirmation tokens are the boundary between "the model proposed something"
 * and "the user authorised it". The tests below attack the boundary: forged
 * signatures, replay by another account, and stale dialogs.
 */

const USER = "user-1";

function expectAppError(run: () => unknown, code: string): AppError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.code).toBe(code);
    return appError;
  }
  throw new Error("expected the call to throw AppError, but it returned");
}

describe("confirmation tokens", () => {
  it("round-trips the validated arguments", () => {
    const { token, expiresAt, nonce } = createConfirmationToken({
      tool: "create_application",
      args: { companyName: "Acme", jobTitle: "Développeur front-end" },
      userId: USER,
    });

    const action = verifyConfirmationToken(token, USER);
    expect(action.tool).toBe("create_application");
    expect(action.args).toEqual({ companyName: "Acme", jobTitle: "Développeur front-end" });
    expect(action.userId).toBe(USER);
    expect(action.expiresAt).toBe(expiresAt);
    expect(action.nonce).toBe(nonce);
  });

  it("produces a distinct nonce per token, even for identical actions", () => {
    const action = { tool: "save_job", args: { jobId: "job-1" }, userId: USER };
    const first = createConfirmationToken(action);
    const second = createConfirmationToken(action);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.token).not.toBe(second.token);
  });

  it("rejects a token whose payload was tampered with", () => {
    const { token } = createConfirmationToken({
      tool: "create_application",
      args: { companyName: "Acme", jobTitle: "Initial" },
      userId: USER,
    });
    const [payloadPart, signature] = token.split(".") as [string, string];

    // Re-encode different arguments but keep the original signature: the model
    // must not be able to change what the user approves.
    const forgedPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        tool: "create_application",
        args: { companyName: "Autre", jobTitle: "Autre" },
        userId: USER,
        expiresAt: Date.now() + 60_000,
        nonce: "forged",
      }),
    ).toString("base64url");

    expect(payloadPart).toBeTruthy();
    expectAppError(
      () => verifyConfirmationToken(`${forgedPayload}.${signature}`, USER),
      "forbidden",
    );
  });

  it("cannot be presented by another account", () => {
    const { token } = createConfirmationToken({
      tool: "save_job",
      args: { jobId: "job-1" },
      userId: USER,
    });
    expectAppError(() => verifyConfirmationToken(token, "user-2"), "forbidden");
  });

  it("expires", () => {
    const { token, expiresAt } = createConfirmationToken({
      tool: "save_job",
      args: { jobId: "job-1" },
      userId: USER,
      ttlMs: 1_000,
    });

    // Still valid one millisecond before the deadline...
    expect(() => verifyConfirmationToken(token, USER, expiresAt - 1)).not.toThrow();
    // ...and refused at the deadline.
    expectAppError(() => verifyConfirmationToken(token, USER, expiresAt), "invalid_input");
    expectAppError(() => verifyConfirmationToken(token, USER, expiresAt + 1), "invalid_input");
  });

  it("uses a ten-minute lifetime by default", () => {
    const now = Date.now();
    const { expiresAt } = createConfirmationToken({
      tool: "save_job",
      args: { jobId: "job-1" },
      userId: USER,
    });
    const lifetime = expiresAt - now;
    expect(lifetime).toBeGreaterThan(__testing.TOKEN_TTL_MS - 5_000);
    expect(lifetime).toBeLessThanOrEqual(__testing.TOKEN_TTL_MS);
  });

  it("rejects malformed tokens without throwing an unexpected error", () => {
    for (const malformed of ["", ".", "no-dot", "a.b.c", "..", "payload."]) {
      expectAppError(() => verifyConfirmationToken(malformed, USER), "invalid_input");
    }
  });

  it("keeps tokens minted for different users independent", () => {
    const forA = createConfirmationToken({
      tool: "save_job",
      args: { jobId: "job-a" },
      userId: "user-a",
    });
    const forB = createConfirmationToken({
      tool: "save_job",
      args: { jobId: "job-b" },
      userId: "user-b",
    });

    expect(verifyConfirmationToken(forA.token, "user-a").args).toEqual({ jobId: "job-a" });
    expect(verifyConfirmationToken(forB.token, "user-b").args).toEqual({ jobId: "job-b" });
    // Cross-use is refused in both directions.
    expectAppError(() => verifyConfirmationToken(forA.token, "user-b"), "forbidden");
    expectAppError(() => verifyConfirmationToken(forB.token, "user-a"), "forbidden");
  });
});
