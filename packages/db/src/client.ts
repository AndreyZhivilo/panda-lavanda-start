import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * Creates a Drizzle ORM instance connected to PostgreSQL via the `postgres`
 * (postgres-js) driver. Pass the connection string from your environment
 * (e.g. `process.env.DATABASE_URL`).
 *
 * @example
 * const db = createDb(process.env.DATABASE_URL!)
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString)
  return drizzle(client, { schema })
}

/** The Drizzle database instance type, schema-aware. */
export type Db = ReturnType<typeof createDb>
