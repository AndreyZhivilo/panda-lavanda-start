import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import type { INotifierService } from '@panda-lavanda/domain'

import { env } from '../env'
import { TelegramNotifier } from '../notifiers/telegram.notifier'

/**
 * Decorator added to the Fastify instance by {@link notifierPlugin}.
 *
 * Routes access it via `fastify.notifier` — the concrete notifier is created
 * once at startup and shared across all requests, mirroring the repository
 * decorators added by the db plugin. The name is generic (`notifier`, not
 * `orderNotifier`) because the port covers every admin notification, not just
 * order events.
 */
declare module 'fastify' {
  interface FastifyInstance {
    notifier: INotifierService
  }
}

/**
 * Registers the notifier as a singleton decorator on the Fastify instance.
 *
 * Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` from the validated
 * {@link env} (so a missing/invalid value fails the server at startup with a
 * clear zod error) and constructs the Telegram-backed adapter once, at plugin
 * registration time. The notifier is then available to every route via
 * `fastify.notifier`.
 *
 * Wrapped in `fastify-plugin` (`fp`) so the decorator escapes Fastify's
 * encapsulation (same reason the db plugin is wrapped — without `fp` a
 * decorator added inside a registered plugin is scoped to that plugin's child
 * context and is invisible to sibling route plugins).
 *
 * Register this **after** the db plugin and **before** the route plugins so the
 * notifier is in place before the first request can create an order.
 */
export const notifierPlugin: FastifyPluginAsync = fp(
  async (fastify: FastifyInstance) => {
    const notifier = new TelegramNotifier({
      botToken: env.TELEGRAM_BOT_TOKEN,
      adminChatId: env.TELEGRAM_ADMIN_CHAT_ID,
    })

    fastify.decorate('notifier', notifier)
  },
  { name: 'notifier', dependencies: [] },
)
