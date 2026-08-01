import type { Either } from '@sweet-monads/either'
import type { Context } from 'grammy'

import { escapeHtml } from '#/bot/formatting'

/**
 * Chat-side reporting helpers for `Either` results.
 *
 * The bot's conversations call use cases / repositories that return
 * `Either<Error, T>` (via `tryCatch`). These helpers turn a result into a chat
 * reply so each conversation does not repeat the `isLeft()` plumbing.
 */

/**
 * Replies with a success message on `Right`, or an error message on `Left`.
 *
 * @returns `true` if the operation succeeded, `false` otherwise — so callers can
 *   branch on the outcome without re-checking the `Either`.
 */
export async function reportEither<T>(
  ctx: Context,
  result: Either<Error, T>,
  successMessage: string,
): Promise<boolean> {
  if (result.isLeft()) {
    await ctx.reply(
      '❌ ' + escapeHtml(result.value.message),
      { parse_mode: 'HTML' },
    )
    return false
  }
  await ctx.reply('✅ ' + successMessage)
  return true
}
