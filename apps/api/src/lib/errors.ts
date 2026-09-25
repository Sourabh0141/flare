import { API_ERROR_STATUS, type ApiErrorBody, type ApiErrorCode } from '@flare/contracts';

export interface ApiErrorOptions {
  /** Extra structured context. Only sent to the client when `expose` is true. */
  details?: unknown;
  /** Whether `details` may be included in the HTTP response. Defaults to true for 4xx. */
  expose?: boolean;
  cause?: unknown;
}

/**
 * The single error type routes and services throw. The error handler turns it into the
 * wire format from `@flare/contracts` and picks the HTTP status from the code.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly expose: boolean;

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
  }

  toBody(requestId: string): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        ...(this.expose && this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
