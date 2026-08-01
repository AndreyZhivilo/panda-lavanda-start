import { z } from 'zod'

/**
 * Centralized, validated access to `process.env` for the API backend.
 *
 * The schema runs `process.env` through zod at module scope, so a missing or
 * invalid variable fails the server at startup with a clear error rather than
 * mid-request.
 *
 * ## How env gets here
 * `DATABASE_URL`, `PORT`, `CORS_ORIGIN` are read from `apps/api/.env`, which is
 * loaded by Node's `--env-file-if-exists=.env` flag set in the `dev`/`start`/
 * `seed` npm scripts. (The seed script loads the same file.) When running in a
 * container, these are injected by the orchestrator (e.g. docker-compose).
 *
 * ## Convention
 * - **Always** import from here: `import { env } from '#/env'`.
 * - **Never** read `process.env.X` directly in app code (`scripts/seed.ts` and
 *   `drizzle.config.ts` are the only exceptions — they run as standalone
 *   processes and keep their own minimal env access).
 * - Add new variables to `envSchema` below — once declared, they are typed on
 *   `env` and validated at startup.
 */
const envSchema = z.object({
  /**
   * PostgreSQL connection string. Required.
   * Not validated as a URL: postgres connection strings (e.g. with
   * `postgresql+postgres://` or socket paths) don't always pass `z.string().url()`.
   */
  DATABASE_URL: z.string().min(1),

  /** Port the Fastify server listens on. Optional; defaults to 4000. */
  PORT: z.coerce.number().int().positive().default(4000),

  /**
   * Comma-separated list of allowed CORS origins (the web app's origin).
   * Optional; defaults to the local dev frontend.
   */
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  /** Application environment. Optional; defaults to 'development'. */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .default('development'),

  /**
   * Telegram bot token (from @BotFather). Used by the order notifier to send
   * admin notifications when an order is placed. Required.
   */
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  /**
   * Numeric Telegram chat id that receives order notifications (the admin's
   * chat — discoverable via @userinfobot). Coerced from a string env var.
   */
  TELEGRAM_ADMIN_CHAT_ID: z.coerce.number().int(),

  /**
   * Absolute filesystem directory where uploaded product photos are stored.
   * Served at `PUBLIC_UPLOAD_PATH` by `@fastify/static`. Defaults to a local
   * `uploads` folder; set explicitly in production.
   */
  UPLOAD_DIR: z.string().default('./uploads'),

  /**
   * Public URL path under which uploaded files are served (mounted by
   * `@fastify/static`). The upload route returns URLs of the form
   * `${PUBLIC_UPLOAD_PATH}/<filename>`.
   */
  PUBLIC_UPLOAD_PATH: z.string().default('/uploads'),
})

/**
 * Validated environment for the API backend.
 *
 * Usage: `env.DATABASE_URL`, `env.PORT`, `env.CORS_ORIGIN`, `env.NODE_ENV`.
 */
export const env = envSchema.parse(process.env)

/** Type of the validated env — exported for typing helpers that take env as a parameter. */
export type Env = z.infer<typeof envSchema>
