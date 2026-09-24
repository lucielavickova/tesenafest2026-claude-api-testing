import { redact } from '../utils/redact';

const MAX_BODY_LENGTH = 1000;

/**
 * Thrown when the API answers with a non-2xx status.
 * The message holds method, path, status and body, never request headers.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: string;

  constructor(status: number, method: string, path: string, body: string) {
    const safeBody = redact(body);
    const shownBody =
      safeBody.length > MAX_BODY_LENGTH ? `${safeBody.slice(0, MAX_BODY_LENGTH)}...` : safeBody;
    super(`${method} ${path} failed with ${String(status)}: ${shownBody}`);
    this.status = status;
    this.method = method;
    this.path = path;
    this.body = safeBody;
  }
}

/** Thrown when a request gets no response at all (network error, timeout). */
export class RequestFailedError extends Error {
  override readonly name = 'RequestFailedError';

  constructor(method: string, path: string, cause: unknown) {
    // Playwright's call log lists the request headers. The original message is redacted and the
    // original error is not kept as `cause`, so the header cannot reach a log or report.
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`${method} ${path} got no response: ${redact(message)}`);
  }
}
