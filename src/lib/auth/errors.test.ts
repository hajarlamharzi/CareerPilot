import { describe, expect, it, vi } from "vitest";

import {
  AppError,
  conflict,
  forbidden,
  invalidInput,
  notConfigured,
  notFound,
  notOwned,
  providerError,
  toErrorResponse,
  unauthenticated,
  withErrorHandling,
  type ErrorBody,
} from "./errors";

/**
 * Every route handler returns its failures through this module, so it is the one
 * place that can leak (or withhold) internals. The tests below pin both the
 * status mapping and the fact that unexpected errors stay opaque.
 */

async function bodyOf(response: Response): Promise<ErrorBody> {
  return (await response.json()) as ErrorBody;
}

describe("toErrorResponse", () => {
  const cases: ReadonlyArray<[AppError, number, string]> = [
    [unauthenticated(), 401, "unauthenticated"],
    [forbidden(), 403, "forbidden"],
    [notFound(), 404, "not_found"],
    [invalidInput(), 400, "invalid_input"],
    [conflict(), 409, "conflict"],
    [notConfigured(), 503, "not_configured"],
    [providerError(), 502, "provider_error"],
  ];

  it("maps each error code to its HTTP status and keeps a French message", async () => {
    for (const [error, status, code] of cases) {
      const response = toErrorResponse(error);
      expect(response.status).toBe(status);
      const body = await bodyOf(response);
      expect(body.error.code).toBe(code);
      expect(body.error.message.length).toBeGreaterThan(0);
    }
  });

  it("preserves the message the caller supplied", async () => {
    const body = await bodyOf(toErrorResponse(forbidden("Réservé aux administrateurs.")));
    expect(body.error.message).toBe("Réservé aux administrateurs.");
  });

  it("carries field-level details for validation failures", async () => {
    const body = await bodyOf(
      toErrorResponse(invalidInput("Formulaire invalide.", { email: ["Adresse invalide."] })),
    );
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.details).toEqual({ email: ["Adresse invalide."] });
  });

  it("treats an ownership failure as forbidden", async () => {
    const body = await bodyOf(toErrorResponse(notOwned()));
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toContain("autre compte");
  });

  it("turns an unexpected error into an opaque 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "postgres://user:p4ssw0rd@db.internal:5432/postgres";
    const body = await bodyOf(toErrorResponse(new Error(secret)));

    expect(body.error.code).toBe("internal");
    // The original message must never reach the client.
    expect(body.error.message).not.toContain("p4ssw0rd");
    expect(body.error.message).not.toContain("db.internal");
    expect(JSON.stringify(body)).not.toContain("p4ssw0rd");
    // ...but it must be logged server-side.
    expect(spy).toHaveBeenCalled();
  });
});

describe("withErrorHandling", () => {
  it("returns the handler's response untouched on success", async () => {
    const handler = withErrorHandling(async () => Response.json({ ok: true }));
    const response = await handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("forwards arguments to the handler", async () => {
    const handler = withErrorHandling(async (request: Request) =>
      Response.json({ url: request.url }),
    );
    const response = await handler(new Request("https://careerpilot.test/api"));
    expect(await response.json()).toEqual({ url: "https://careerpilot.test/api" });
  });

  it("converts a thrown AppError into its envelope", async () => {
    const handler = withErrorHandling(async () => {
      throw forbidden("Accès refusé.");
    });
    const response = await handler();
    expect(response.status).toBe(403);
    const body = await bodyOf(response);
    expect(body.error).toMatchObject({ code: "forbidden", message: "Accès refusé." });
  });

  it("converts any other throw into an opaque 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling(async () => {
      throw new Error("ECONNREFUSED 10.0.0.5:5432");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    const body = await bodyOf(response);
    expect(body.error.code).toBe("internal");
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });

  it("recognises a subclass-like AppError as an AppError", async () => {
    const handler = withErrorHandling(async () => {
      throw new AppError("not_found", "Offre introuvable.");
    });
    const response = await handler();
    expect(response.status).toBe(404);
  });
});
