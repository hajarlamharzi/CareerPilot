/**
 * Typed authorisation errors and the single place that turns them into HTTP
 * responses. Every route handler funnels through `toErrorResponse`, so a caller
 * can never accidentally leak a stack trace, a SQL message or a key.
 */

export type AppErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "rate_limited"
  | "not_configured"
  | "provider_error"
  | "internal";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  rate_limited: 429,
  not_configured: 503,
  provider_error: 502,
  internal: 500,
};

/** Stable, user-displayable messages. French, per the product language. */
const DEFAULT_MESSAGE: Record<AppErrorCode, string> = {
  unauthenticated: "Vous devez être connecté pour effectuer cette action.",
  forbidden: "Vous n'avez pas les droits nécessaires pour cette action.",
  not_found: "Ressource introuvable.",
  invalid_input: "Les données envoyées sont invalides.",
  conflict: "Cette ressource existe déjà.",
  rate_limited: "Trop de requêtes. Merci de réessayer dans quelques instants.",
  not_configured:
    "Cette fonctionnalité n'est pas configurée sur ce déploiement.",
  provider_error:
    "Le fournisseur d'IA n'a pas pu répondre. Réessayez dans un instant.",
  internal: "Une erreur interne est survenue.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Optional field-level details, safe to render next to a form input. */
  readonly details?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message?: string,
    options: { details?: Record<string, string[]>; cause?: unknown } = {},
  ) {
    super(message ?? DEFAULT_MESSAGE[code], { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
  }
}

export const unauthenticated = (message?: string): AppError =>
  new AppError("unauthenticated", message);

export const forbidden = (message?: string): AppError =>
  new AppError("forbidden", message);

export const notFound = (message?: string): AppError =>
  new AppError("not_found", message);

export const invalidInput = (
  message?: string,
  details?: Record<string, string[]>,
): AppError => new AppError("invalid_input", message, { details });

export const conflict = (message?: string): AppError =>
  new AppError("conflict", message);

export const notConfigured = (message?: string): AppError =>
  new AppError("not_configured", message);

export const providerError = (message?: string, cause?: unknown): AppError =>
  new AppError("provider_error", message, { cause });

/** Widely useful: a resource belongs to somebody else (or does not exist). */
export const notOwned = (): AppError =>
  forbidden("Cette ressource appartient à un autre compte.");

export interface ErrorBody {
  error: {
    code: AppErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Convert any thrown value into a JSON `Response`.
 *
 * Unknown errors are logged server-side and reported as a generic 500, so no
 * internal detail escapes.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      } satisfies ErrorBody,
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error("[careerpilot] unhandled error:", message);
  return Response.json(
    { error: { code: "internal", message: DEFAULT_MESSAGE.internal } } satisfies ErrorBody,
    { status: 500 },
  );
}

/** Wrap a route handler so every thrown `AppError` becomes a clean response. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
