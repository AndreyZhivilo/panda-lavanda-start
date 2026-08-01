import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import type { ICrashReporterService } from '@panda-lavanda/domain'

import { ConsoleCrashReporterService } from '../services/console-crash-reporter.service'

/**
 * Decorator added to the Fastify instance by {@link crashReporterPlugin}.
 *
 * Routes access it via `fastify.crashReporter` — a single crash reporter shared
 * across all requests, mirroring the other decorators. Used for **best-effort**
 * secondary effects (e.g. a swallowed Telegram notification failure in
 * `POST /orders`) so those errors go through the same sink as the rest of the
 * project instead of being lost or duplicated.
 */
declare module 'fastify' {
  interface FastifyInstance {
    crashReporter: ICrashReporterService
  }
}

/**
 * Registers the crash reporter as a singleton decorator on the Fastify instance.
 *
 * Constructs the local `console.error`-backed adapter once, at plugin
 * registration time. When Sentry is wired in, swap the adapter constructed here
 * (or pass an env-selected one); every consumer stays untouched.
 *
 * Wrapped in `fastify-plugin` (`fp`) so the decorator escapes Fastify's
 * encapsulation (same reason the db/notifier/storage plugins are wrapped).
 *
 * Register early — before the route plugins — so every route has it available.
 */
export const crashReporterPlugin: FastifyPluginAsync = fp(
  async (fastify: FastifyInstance) => {
    const crashReporter = new ConsoleCrashReporterService()
    fastify.decorate('crashReporter', crashReporter)
  },
  { name: 'crash-reporter', dependencies: [] },
)
