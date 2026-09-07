/**
 * Typed errors. Every upstream failure is mapped to one of these so pages can decide
 * how to degrade, and so no upstream URL / secret presence / raw body ever leaks into
 * a rendered response. Log the full error to stderr only.
 */

export type ErrorKind =
  | "upstream"
  | "timeout"
  | "not_found"
  | "rate_limited"
  | "missing_secret"
  | "validation"
  | "blocked";

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly source: string;
  readonly status: number | undefined;
  /** Safe to show to a viewer. */
  readonly clientMessage: string;

  constructor(kind: ErrorKind, source: string, message: string, opts: { status?: number; clientMessage?: string } = {}) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.source = source;
    this.status = opts.status;
    this.clientMessage = opts.clientMessage ?? DEFAULT_CLIENT_MESSAGES[kind];
  }
}

const DEFAULT_CLIENT_MESSAGES: Record<ErrorKind, string> = {
  upstream: "Data currently unavailable",
  timeout: "Data source timed out",
  not_found: "Not found",
  rate_limited: "Data source rate limit reached — try again in a few minutes",
  missing_secret: "Not configured on this server",
  validation: "Invalid data",
  blocked: "Blocked by policy",
};

export class UpstreamError extends AppError {
  constructor(source: string, status?: number, message = `${source} upstream failure`) {
    super(status === 429 ? "rate_limited" : "upstream", source, message, { status });
  }
}

export class TimeoutError extends AppError {
  constructor(source: string) {
    super("timeout", source, `${source} timed out`);
  }
}

export class NotFoundError extends AppError {
  constructor(source: string, what = "resource") {
    super("not_found", source, `${source}: ${what} not found`, { status: 404 });
  }
}

export class MissingSecretError extends AppError {
  constructor(source: string, secret: string) {
    super("missing_secret", source, `${source}: ${secret} is not configured`);
  }
}

export class ValidationError extends AppError {
  constructor(source: string, message: string) {
    super("validation", source, message, { clientMessage: message });
  }
}

export class BlockedError extends AppError {
  constructor(source: string, message: string) {
    super("blocked", source, message, { clientMessage: message });
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Message safe for a viewer, whatever was thrown. */
export function safeMessage(e: unknown): string {
  return isAppError(e) ? e.clientMessage : DEFAULT_CLIENT_MESSAGES.upstream;
}

/** One-line description for stderr (never for responses). */
export function describeForLog(e: unknown): string {
  if (isAppError(e)) return `${e.name}[${e.kind}/${e.source}${e.status ? "/" + e.status : ""}]: ${e.message}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}
