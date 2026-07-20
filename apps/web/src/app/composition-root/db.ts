import { createDb } from '@panda-lavanda/db'

import { env } from '#/shared/lib/env.server'

/**
 * Composition root for the database connection.
 *
 * `env.DATABASE_URL` is validated by zod at module scope in
 * `shared/lib/env.server.ts`, so a missing/malformed value fails the server
 * at startup with a clear error rather than mid-request inside a DB call.
 *
 * The `Db` is shared across all repository providers (each repository takes
 * it via its constructor) so the underlying postgres-js connection pool is
 * created exactly once for the whole app.
 */
export const db = createDb(env.DATABASE_URL)
