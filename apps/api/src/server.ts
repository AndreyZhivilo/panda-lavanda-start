import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify'
import { resolve } from 'node:path'
import { ZodError } from 'zod'

import { env } from './env'
import { HttpError } from './errors'
import { crashReporterPlugin } from './plugins/crash-reporter'
import { dbPlugin } from './plugins/db'
import { notifierPlugin } from './plugins/notifier'
import { storagePlugin } from './plugins/storage'
import { categoriesRoutes } from './routes/categories'
import { ordersRoutes } from './routes/orders'
import { productsRoutes } from './routes/products'
import { uploadsRoutes } from './routes/uploads'

/**
 * Multipart file-size limit enforced globally by `@fastify/multipart`.
 *
 * Set generously above the per-route validation cap (see `routes/uploads.ts`)
 * so the parser accepts a valid photo and the route applies the precise rule.
 */
const MAX_MULTIPART_FILE_BYTES = 10 * 1024 * 1024

/**
 * Resolves a possibly-relative upload directory to an absolute path.
 *
 * `@fastify/static` requires an absolute `root`. `env.UPLOAD_DIR` may be a
 * relative path (the default is `./uploads`); resolve it against `process.cwd()`
 * so the served folder is predictable regardless of how the process is started.
 */
function resolveAbsolutePath(dir: string): string {
  return resolve(dir)
}

/**
 * Builds and configures the Fastify server instance.
 *
 * Kept as a factory so it can be unit-tested with a different configuration,
 * and so the entry point (`server.ts`) stays focused on wiring + lifecycle.
 */
export async function buildServer() {
  const fastify = Fastify({
    logger: true,
  })

  // Global error handler — translates thrown errors into a uniform JSON shape:
  //   { statusCode, error: <stable code>, message, ...optional details }
  // Zod input failures become 422 (not the default 500), our own HttpError
  // subclasses carry their status/code, and anything else is a 500 with the
  // internals kept out of the response body (full error still reaches logs).
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        statusCode: 422,
        error: 'ValidationError',
        message: 'Invalid request input',
        details: error.issues,
      })
    }

    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.code,
        message: error.message,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      statusCode: 500,
      error: 'InternalServerError',
      message: 'Internal server error',
    })
  })

  // Uniform body for unmatched routes (Fastify's default 404 is plain JSON).
  fastify.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      statusCode: 404,
      error: 'NotFoundError',
      message: 'Route not found',
    })
  })

  // CORS: allow the web app (and any other configured origins) to call the API.
  // `env.CORS_ORIGIN` is a comma-separated list of allowed origins.
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  })

  // Database connection + repository decorator.
  await fastify.register(dbPlugin)

  // Crash reporter decorator. Registered early so every route that has a
  // best-effort secondary effect can route its swallowed errors here (e.g. the
  // Telegram notification failure in `POST /orders`).
  await fastify.register(crashReporterPlugin)

  // Order notifier (Telegram-backed) decorator. Registered after the db plugin
  // and before the route plugins so it is in place before the first order.
  await fastify.register(notifierPlugin)

  // File storage decorator (local-filesystem adapter). Registered before the
  // multipart/static plugins and the upload route that consume it.
  await fastify.register(storagePlugin)

  // Multipart parsing for `POST /uploads`. A global 10 MB limit is set on the
  // field itself in the route; this registers the parser Fastify needs to
  // surface `request.file()`.
  await fastify.register(multipart, {
    limits: { fileSize: MAX_MULTIPART_FILE_BYTES },
  })

  // Serve uploaded product photos (and any other stored files) under the
  // public path so the URLs returned by `POST /uploads` resolve immediately.
  await fastify.register(staticFiles, {
    root: resolveAbsolutePath(env.UPLOAD_DIR),
    prefix: env.PUBLIC_UPLOAD_PATH,
  })

  // REST routes (mounted at the root prefix — endpoints are /products, ...).
  await fastify.register(productsRoutes)
  await fastify.register(ordersRoutes)
  await fastify.register(categoriesRoutes)
  await fastify.register(uploadsRoutes)

  return fastify
}

/**
 * Application entry point.
 *
 * Boots the server, binds to `env.PORT`, and wires graceful shutdown: on
 * `SIGINT`/`SIGTERM` Fastify is closed (which ends the postgres connection
 * pool via the db plugin's `onClose` hook) and the process exits cleanly.
 */
async function start() {
  const fastify = await buildServer()

  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
    fastify.log.info(`API server listening on port ${env.PORT}`)
  } catch (error) {
    fastify.log.error(error)
    process.exit(1)
  }

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down...`)
    try {
      await fastify.close()
      process.exit(0)
    } catch (error) {
      fastify.log.error(error)
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

await start()
