import { createDependencies } from '#/app/composition-root/composition-root'
import { createBot } from '#/bot/bot'
import { env } from '#/env'

/**
 * Telegram bot entry point.
 *
 * Wires the composition root, builds the bot, and starts long polling.
 * Graceful shutdown: on `SIGINT`/`SIGTERM` the bot stops polling and the process
 * exits cleanly (mirrors `apps/api/src/server.ts`).
 *
 * ## Running
 *
 * `npm run dev` / `npm run start` — both load `.env` via Node's
 * `--env-file-if-exists=.env` (see `package.json` scripts) before this module
 * runs, so `env` (which parses `process.env` at import time) sees the variables.
 *
 * ## Production webhooks
 *
 * For production you may prefer webhooks over long polling. Replace
 * `bot.start()` with `bot.startWebhook(...)`, and set the webhook with
 * `bot.api.setWebhook(url)` once on deploy. The conversation/session plugins
 * work identically under both transports.
 */
async function start(): Promise<void> {
  const deps = createDependencies()
  const bot = createBot(deps)

  // The bot is the only authorized operator; confirm its identity at startup so
  // a bad token fails fast rather than on the first update.
  const me = await bot.api.getMe()
  console.log(`[telegram-bot] Authorized as @${me.username} (id ${me.id})`)
  console.log(
    `[telegram-bot] Accepting commands from chat ${env.TELEGRAM_ADMIN_CHAT_ID}`,
  )

  bot.start({
    onStart: (botInfo) => {
      console.log(`[telegram-bot] @${botInfo.username} started — polling…`)
    },
  })

  const shutdown = (signal: string) => {
    console.log(`[telegram-bot] Received ${signal}, shutting down...`)
    bot.stop()
    // grammy's bot.stop() is sync-ish; give it a tick then exit.
    setTimeout(() => process.exit(0), 200)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

await start().catch((error) => {
  console.error('[telegram-bot] Fatal startup error:', error)
  process.exit(1)
})
