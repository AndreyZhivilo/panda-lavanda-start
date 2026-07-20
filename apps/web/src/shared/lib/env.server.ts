import { z } from 'zod'

/**
 * Centralized, validated access to `process.env`.
 *
 * The `.server.ts` suffix is **required**: TanStack Start's import-protection
 * (default rule matches files with a `.server.` segment in their name) keeps
 * this module out of the client bundle, so secrets never leak. Importing it
 * from client code is a build violation.
 *
 * ## Why centralize
 * Reading `process.env.SOMETHING` ad-hoc scatters knowledge of which env
 * vars the app needs, and a missing variable fails late and cryptically
 * (e.g. inside a DB call). Validating everything here, at module scope,
 * makes the schema a single source of truth and turns missing/invalid env
 * into a clear startup error.
 *
 * ## How env gets here
 * TanStack Start's `loadEnvPlugin` calls Vite's `loadEnv(mode, config.root,
 * '')` with `config.root = apps/web/`, so it reads `apps/web/.env` and
 * assigns every variable (not only `VITE_`-prefixed ones) into `process.env`
 * before any server module runs. (Root-repo `.env` is for drizzle-kit / seed
 * — they load it themselves; see `.env.example`.)
 *
 * ## Convention
 * - **Always** import from here: `import { env } from '#/shared/lib/env.server'`.
 * - **Never** read `process.env.X` directly in app code (vite.config.ts and
 *   Vite-specific entry code are the only exceptions).
 * - Add new variables to `envSchema` below — once declared, they are typed
 *   on `env` and validated at startup.
 *
 * ## Edge runtimes note
 * Module-scope `process.env` reads are correct for this project (Node +
 * Vite SSR), where env is stable across the process. On Cloudflare Workers
 * / other edge runtimes env is injected per-request and would need to be
 * read inside a handler — not our case.
 */
const envSchema = z.object({
  /**
   * PostgreSQL connection string. Required.
   * Not validated as a URL: postgres connection strings (e.g. with
   * `postgresql+postgres://` or socket paths) don't always pass `z.string().url()`.
   */
  DATABASE_URL: z.string().min(1),

  /** Application environment. Optional; defaults to 'development'. */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .default('development'),
})

/**
 * Validated environment for the web app.
 *
 * Usage: `env.DATABASE_URL`, `env.NODE_ENV`.
 */
export const env = envSchema.parse(process.env)

/** Type of the validated env — exported for typing helpers that take env as a parameter. */
export type Env = z.infer<typeof envSchema>
