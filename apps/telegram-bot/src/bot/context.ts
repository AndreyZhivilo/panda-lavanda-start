import type { Context, SessionFlavor } from 'grammy'
import type { ConversationFlavor } from '@grammyjs/conversations'

import type { AppDependencies } from '#/app/composition-root/composition-root'

/**
 * Per-chat session data.
 *
 * grammy's `session()` plugin persists this object between updates from the same
 * chat. Conversations keep their own replay state out of band, so the session
 * only needs fields the **non-conversation** handlers read between updates —
 * currently none beyond an empty placeholder. Kept explicit so adding a field
 * later is a typed change rather than a free-form object.
 */
export interface BotSession {
  // Intentionally empty for now; conversations own their own state.
}

/**
 * The wired {@link AppDependencies}, exposed on every context as `ctx.deps` via
 * the `deps` middleware installed in {@link createBot}. Declared as a flavor so
 * handlers can read `ctx.deps` with full typing.
 */
export interface DepsFlavor {
  deps: AppDependencies
}

/**
 * The bot's full context type — a composition of all installed flavors.
 *
 * grammy v2 flavors are plain object shapes that get intersected with the base
 * {@link Context}. The order here mirrors the middleware installation order in
 * `bot.ts`:
 *
 * - `SessionFlavor<BotSession>` — adds `ctx.session`.
 * - `ConversationFlavor` — adds `ctx.conversation`.
 * - `DepsFlavor` — adds `ctx.deps` (the wired dependencies).
 *
 * `Bot<C extends Context>` is parameterized with this type, so every handler,
 * conversation, and helper receives a correctly-typed context.
 */
export type BotContext = Context &
  SessionFlavor<BotSession> &
  ConversationFlavor<Context> &
  DepsFlavor
