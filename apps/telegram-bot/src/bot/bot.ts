import { conversations, createConversation } from '@grammyjs/conversations'
import { Bot, session } from 'grammy'

import type { AppDependencies } from '#/app/composition-root/composition-root'
import { env } from '#/env'
import type { BotContext, BotSession } from './context'
import { createProduct } from './conversations/create-product.conversation'
import { updateProduct } from './conversations/update-product.conversation'

/** Initial (empty) session value — required by grammy's `session()`. */
function initialSession(): BotSession {
  return {}
}

/**
 * Builds and configures the grammy `Bot`.
 *
 * Wiring order matters:
 *
 * 1. `session()` — installs `ctx.session` (must run before conversations, which
 *    read/write session state).
 * 2. `conversations()` — installs `ctx.conversation` (enter/manage conversations).
 * 3. Admin guard — drops every update not coming from the configured admin chat.
 *    This runs **before** the command handlers, so a non-admin can never start a
 *    conversation. (The API itself is still unauthenticated today; the guard is
 *    the bot's own access control.)
 * 4. Dependency injection — installs `ctx.deps` from the wired {@link
 *    AppDependencies}, so handlers and conversations reach the use cases /
 *    repositories without importing the composition root directly.
 * 5. Conversation builders + command handlers.
 *
 * Long polling (`bot.start()`) is used for dev; for production a webhook can be
 * wired by calling `bot.api.setWebhook()` and running `bot.startWebhook(...)`
 * instead — see the entry point (`src/index.ts`).
 */
export function createBot(deps: AppDependencies): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN)

  // 1. Session storage (in-memory by default; swap adapter for persistence).
  bot.use(session({ initial: initialSession }))

  // 2. Conversations plugin.
  bot.use(conversations())

  // 3. Admin guard: only the configured admin chat may proceed. Every other
  //    update is dropped silently (no reply) to avoid leaking that a bot exists.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id !== env.TELEGRAM_ADMIN_CHAT_ID) return
    return next()
  })

  // 4. Dependency injection: expose the wired deps on the context.
  bot.use(async (ctx, next) => {
    ctx.deps = deps
    return next()
  })

  // 5. Conversation builders (registered after the conversations plugin).
  bot.use(createConversation(createProduct))
  bot.use(createConversation(updateProduct))

  // --- Commands -------------------------------------------------------------

  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Здравствуйте! Это бот управления каталогом Panda Lavanda.\n\n' +
      'Доступные команды:\n' +
      '/newproduct — создать новый товар\n' +
      '/editproduct — изменить существующий товар\n' +
      '/cancel — отменить текущее действие',
    )
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Команды:\n' +
      '/newproduct — создать новый товар\n' +
      '/editproduct — изменить товар (цена, остатки, фото, название, описание)\n' +
      '/cancel — отменить текущее действие',
    )
  })

  // Start a conversation. `enter` resolves by builder function name.
  bot.command('newproduct', async (ctx) => {
    await ctx.conversation.enter('createProduct')
  })
  bot.command('editproduct', async (ctx) => {
    await ctx.conversation.enter('updateProduct')
  })

  // `/cancel` is handled inside conversations via `hasCommand('cancel')` at each
  // wait; outside a conversation it is a no-op (nothing to cancel).
  bot.command('cancel', async (ctx) => {
    await ctx.reply('Нечего отменять.')
  })

  bot.catch(({ error, ctx }) => {
    console.error('[telegram-bot] Handler error:', error)
    // Best-effort user-facing notice; swallow send failures.
    void ctx.reply('Произошла ошибка. Попробуйте ещё раз или /cancel.')
  })

  return bot
}
