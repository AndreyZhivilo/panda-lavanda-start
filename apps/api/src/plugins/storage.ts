import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import type { IFileStorageService } from '@panda-lavanda/domain'

import { env } from '../env'
import { LocalFileStorageService } from '../storage/local-file-storage.service'

/**
 * Decorator added to the Fastify instance by {@link storagePlugin}.
 *
 * Routes access it via `fastify.fileStorage` — the concrete storage is created
 * once at startup and shared across all requests, mirroring the other
 * decorators.
 */
declare module 'fastify' {
  interface FastifyInstance {
    fileStorage: IFileStorageService
  }
}

/**
 * Registers the file-storage service as a singleton decorator on the Fastify
 * instance.
 *
 * Reads `UPLOAD_DIR` and `PUBLIC_UPLOAD_PATH` from the validated {@link env}
 * and constructs the local-filesystem adapter once, at plugin registration
 * time. The decorator is then available to every route via
 * `fastify.fileStorage` (used today by the `POST /uploads` route).
 *
 * Wrapped in `fastify-plugin` (`fp`) so the decorator escapes Fastify's
 * encapsulation (same reason the db/notifier plugins are wrapped).
 */
export const storagePlugin: FastifyPluginAsync = fp(
  async (fastify: FastifyInstance) => {
    const fileStorage = new LocalFileStorageService({
      storageDir: env.UPLOAD_DIR,
      publicPath: env.PUBLIC_UPLOAD_PATH,
    })

    fastify.decorate('fileStorage', fileStorage)
  },
  { name: 'storage', dependencies: [] },
)
