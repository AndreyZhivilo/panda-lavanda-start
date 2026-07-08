import { left, right } from '@sweet-monads/either'
import type { Either } from '@sweet-monads/either'

import { AppError } from '@domain/errors'
import type { ICrashReporterService } from '@domain/ports/crash-reporter.port'

type LeftValue = Error

/**
 * Wraps an async operation in Either, catching thrown errors as Left.
 *
 * - Already an Error instance → returned as-is.
 * - AppError subclass        → returned as-is (preserves cause chain).
 * - Anything else            → wrapped in AppError with original value as cause.
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  reporter?: ICrashReporterService,
): Promise<Either<LeftValue, T>> {
  try {
    return right(await fn())
  } catch (error) {
    const err = toError(error)
    reporter?.report(err)
    return left(err)
  }
}

/**
 * Wraps a synchronous operation in Either, catching thrown errors as Left.
 */
export function tryCatchSync<T>(
  fn: () => T,
  reporter?: ICrashReporterService,
): Either<LeftValue, T> {
  try {
    return right(fn())
  } catch (error) {
    const err = toError(error)
    reporter?.report(err)
    return left(err)
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error
  return new AppError(String(error), error)
}
