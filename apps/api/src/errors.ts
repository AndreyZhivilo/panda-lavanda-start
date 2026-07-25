/**
 * Local HTTP error hierarchy for the API.
 *
 * The backend is a thin persistence/HTTP adapter (see `architecture.md`): it
 * may only import `@panda-lavanda/domain` as **types**, so we can't lean on the
 * domain `AppError` hierarchy with `instanceof` (that needs a value import).
 * Instead the API owns this small HTTP-shaped hierarchy and a single global
 * error handler (`server.ts`) maps it to responses.
 *
 * Mirrors the shape of `packages/domain/src/errors.ts` for consistency, but
 * each error carries a `statusCode` and a stable machine `code` for clients.
 */
export abstract class HttpError extends Error {
  /** HTTP status code to send. Implemented by concrete subclasses. */
  abstract statusCode: number
  /** Stable machine-readable code, used as the response `error` field. */
  abstract code: string

  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = this.constructor.name
  }
}

/** The requested resource does not exist (HTTP 404). */
export class NotFoundError extends HttpError {
  readonly statusCode = 404
  readonly code = 'NotFoundError'

  /**
   * @param resource Human-readable resource name, e.g. `"Product"`.
   * @param id       Optional identifier — when present, the message includes it
   *                 (e.g. `Product "<id>" not found`).
   */
  constructor(resource: string, id?: string) {
    super(id ? `${resource} "${id}" not found` : `${resource} not found`)
  }
}

/** The request input failed validation (HTTP 422). */
export class ValidationError extends HttpError {
  readonly statusCode = 422
  readonly code = 'ValidationError'

  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

/** Authentication is required or has failed (HTTP 401). */
export class AuthError extends HttpError {
  readonly statusCode = 401
  readonly code = 'AuthError'

  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

/** The authenticated user may not perform this action (HTTP 403). */
export class PermissionError extends HttpError {
  readonly statusCode = 403
  readonly code = 'PermissionError'

  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}

/** The request conflicts with the current state of the resource (HTTP 409). */
export class ConflictError extends HttpError {
  readonly statusCode = 409
  readonly code = 'ConflictError'

  constructor(message: string, cause?: unknown) {
    super(message, cause)
  }
}
