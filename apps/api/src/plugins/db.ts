import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { createDb } from '../db/client'
import { ProductsRepository } from '../repositories/products.repository'
import { env } from '../env'

/**
 * Decorator added to the Fastify instance by {@link dbPlugin}.
 *
 * Routes access it via `fastify.productsRepository` — the concrete repository
 * is created once at startup and shared across all requests.
 */
declare module 'fastify' {
  interface FastifyInstance {
    productsRepository: ProductsRepository
  }
}

/**
 * Registers the database connection and the {@link ProductsRepository} as a
 * singleton decorator on the Fastify instance.
 *
 * The connection string comes from the validated {@link env}. The Drizzle
 * instance and the repository are created once, at plugin registration time
 * (server startup); they are not recreated per request.
 *
 * On close, the underlying `postgres` (postgres-js) connection pool is ended
 * so the process can shut down cleanly.
 *
 * Wrapped in `fastify-plugin` (`fp`) so the decorator escapes Fastify's
 * encapsulation: without `fp`, a decorator added inside a registered plugin
 * is scoped to that plugin's child context and is **not** visible to sibling
 * plugins (e.g. `productsRoutes`), which caused
 * `Cannot read properties of undefined (reading 'getMany')`. `fp` tells
 * Fastify to apply this plugin in the parent scope, so `fastify.productsRepository`
 * is available everywhere.
 */
export const dbPlugin: FastifyPluginAsync = fp(
  async (fastify: FastifyInstance) => {
    const db = createDb(env.DATABASE_URL)
    const productsRepository = new ProductsRepository(db)

    fastify.decorate('productsRepository', productsRepository)

    // Close the postgres connection pool when Fastify shuts down.
    fastify.addHook('onClose', async () => {
      await db.$client.end()
    })
  },
  // Declares the decorator added by this plugin, so Fastify can boot-time check
  // that consumers of `productsRepository` are registered after this plugin.
  { name: 'db', dependencies: [] },
)
