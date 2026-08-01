import { z } from 'zod'

/**
 * Centralized, validated access to `process.env` for the Telegram bot.
 *
 * The schema runs `process.env` through zod at module scope, so a missing or
 * invalid variable fails the bot at startup with a clear error rather than
 * mid-run. Mirrors the pattern used by `apps/api/src/env.ts` and
 * `apps/web/src/shared/lib/env.server.ts`.
 *
 * ## How env gets here
 *
 * `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `BACKEND_URL` are read from
 * `apps/telegram-bot/.env`, which is loaded by Node's `--env-file-if-exists=.env`
 * flag set in the `dev`/`start` npm scripts.
 *
 * ## Convention
 *
 * - **Always** import from here: `import { env } from '#/env'`.
 * - **Never** read `process.env.X` directly in app code.
 * - Add new variables to `envSchema` below.
 */
const envSchema = z.object({
  /**
   * Telegram bot token from @BotFather. Authenticates the bot's calls to the
   * Telegram Bot API. Required.
   */
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  /**
   * Numeric Telegram chat id of the admin who operates the bot (the shop
   * owner). The bot accepts commands **only** from this chat — every other
   * update is dropped by the admin guard. Discoverable via @userinfobot.
   */
  TELEGRAM_ADMIN_CHAT_ID: z.coerce.number().int(),

  /**
   * The backend API origin (e.g. `http://localhost:4000`). The bot's
   * HTTP-backed repositories and the photo upload helper call it over `fetch`.
   * Same value as the web app's `BACKEND_URL`.
   */
  BACKEND_URL: z.string().url(),

  /** Application environment. Optional; defaults to 'development'. */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .default('development'),
})

/**
 * Validated environment for the Telegram bot.
 *
 * Usage: `env.TELEGRAM_BOT_TOKEN`, `env.TELEGRAM_ADMIN_CHAT_ID`, `env.BACKEND_URL`.
 */
export const env = envSchema.parse(process.env)

/** Type of the validated env. */
export type Env = z.infer<typeof envSchema>
