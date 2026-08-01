import type { Conversation } from '@grammyjs/conversations'
import type { Context } from 'grammy'
import type {
  CreateExemplarData,
  ICategory,
} from '@panda-lavanda/domain'
import { Size } from '@panda-lavanda/domain'

import type { BotContext } from '#/bot/context'
import { escapeHtml } from '#/bot/formatting'

/** Type alias for a conversation builder bound to the bot's context. */
type BotConversation = Conversation<BotContext, BotContext>

/** Shape collected during the create-product flow. */
interface DraftProduct {
  name: string
  description: string
  category: ICategory
  images: string[]
  exemplars: CreateExemplarData[]
}

/**
 * The create-product conversation.
 *
 * Walks the admin through creating a catalog entry step by step:
 *
 * 1. Pick a category (from the backend's `GET /categories`).
 * 2. Enter the product name.
 * 3. Enter the description.
 * 4. Send one or more photos (each is uploaded to the backend's `/uploads`).
 * 5. Add variants (size p9/p11, price, in-stock) — at least one.
 * 6. Confirm, then call `CreateProductUseCase`.
 *
 * Every `conversation.wait()` is a resumable checkpoint: if the bot restarts or
 * the admin takes a long time to answer, the conversation resumes from the last
 * wait. `/cancel` aborts at any point.
 *
 * Errors from the backend (a thrown `AppError` wrapped into `Either.Left` by the
 * use case) are surfaced as a chat message rather than silently failing.
 *
 * Multi-step building blocks (`pickCategory`, `collectPhotos`, `collectExemplars`,
 * `confirmDraft`) are plain helper functions rather than prototype extensions —
 * easier to reason about under `verbatimModuleSyntax` and keeps `ctx.deps`
 * correctly typed.
 */
export async function createProduct(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<void> {
  const { deps } = ctx

  // --- 1. Category -----------------------------------------------------------
  const categoriesResult = await deps.getCategories.execute()
  if (categoriesResult.isLeft()) {
    await ctx.reply('❌ Не удалось загрузить категории. Попробуйте позже или /cancel.')
    return
  }
  const categories = categoriesResult.value
  if (categories.length === 0) {
    await ctx.reply('❌ В каталоге нет категорий. Сначала создайте категорию.')
    return
  }

  const category = await pickCategory(conversation, ctx, categories)
  if (!category) return // aborted

  // --- 2. Name ---------------------------------------------------------------
  await ctx.reply('Введите <b>название</b> товара:', { parse_mode: 'HTML' })
  const nameCtx = await waitForText(conversation, ctx)
  if (!nameCtx) return
  const name = nameCtx.message!.text!.trim()

  // --- 3. Description --------------------------------------------------------
  await ctx.reply('Введите <b>описание</b> товара:', { parse_mode: 'HTML' })
  const descCtx = await waitForText(conversation, ctx)
  if (!descCtx) return
  const description = descCtx.message!.text!.trim()

  // --- 4. Photos -------------------------------------------------------------
  await ctx.reply(
    'Отправьте <b>фотографии</b> товара (по одной или альбомом).\n' +
      'Когда закончите — отправьте /done. Минимум одна фотография.',
    { parse_mode: 'HTML' },
  )
  const images = await collectPhotos(conversation, ctx)
  if (images === null) return // aborted
  if (images.length === 0) {
    await ctx.reply('❌ Нужна хотя бы одна фотография. Начните заново: /newproduct')
    return
  }

  // --- 5. Exemplars ----------------------------------------------------------
  await ctx.reply(
    'Теперь добавим <b>варианты</b> (размер + цена + наличие).\n' +
      `Доступные размеры: <b>p9</b> (горшок 9 см), <b>p11</b> (горшок 11 см).`,
    { parse_mode: 'HTML' },
  )
  const exemplars = await collectExemplars(conversation, ctx)
  if (exemplars === null) return // aborted
  if (exemplars.length === 0) {
    await ctx.reply('❌ Нужен хотя бы один вариант. Начните заново: /newproduct')
    return
  }

  // --- 6. Confirm & create ---------------------------------------------------
  const confirmed = await confirmDraft(conversation, ctx, {
    name,
    description,
    category,
    images,
    exemplars,
  })
  if (confirmed === null) return
  if (!confirmed) {
    await ctx.reply('Создание отменено.')
    return
  }

  const result = await deps.createProduct.execute({
    name,
    description,
    category: category.id,
    images,
    exemplars,
  })

  if (result.isLeft()) {
    await ctx.reply(
      '❌ Не удалось создать товар: ' + escapeHtml(result.value.message),
      { parse_mode: 'HTML' },
    )
    return
  }

  const product = result.value
  await ctx.reply(
    `✅ Товар создан!\n\n<b>${escapeHtml(product.name)}</b>\n` +
      `ID: <code>${product.id}</code>\nSlug: <code>${escapeHtml(product.slug)}</code>`,
    { parse_mode: 'HTML' },
  )
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Waits for the next text message from the same chat.
 *
 * Returns `null` if the admin sends `/cancel` (handled by the cancel command,
 * which halts the conversation). Loops on non-text updates with a nudge.
 */
async function waitForText(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<BotContext | null> {
  void ctx
  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    if (next.message?.text) return next
    await next.reply('Жду текстовое сообщение. /cancel — отменить.')
  }
}

/** Step: pick a category by number. Returns `null` on `/cancel`. */
async function pickCategory(
  conversation: BotConversation,
  ctx: BotContext,
  categories: ICategory[],
): Promise<ICategory | null> {
  const lines = ['Выберите <b>категорию</b> (введите номер):']
  categories.forEach((c, i) => lines.push(`${i + 1}. ${escapeHtml(c.name)}`))
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })

  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    const text = next.message?.text?.trim()
    if (!text) {
      await next.reply('Введите номер категории. /cancel — отменить.')
      continue
    }
    const idx = Number(text) - 1
    if (!Number.isInteger(idx) || idx < 0 || idx >= categories.length) {
      await next.reply('Неверный номер. Попробуйте снова. /cancel — отменить.')
      continue
    }
    return categories[idx]!
  }
}

/**
 * Step: collect photos until `/done`.
 *
 * Returns `null` on `/cancel`, otherwise the collected URL array (possibly
 * empty — the caller enforces a minimum). Each photo is uploaded to the backend
 * as it arrives; failures are reported but do not abort the whole collection.
 */
async function collectPhotos(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<string[] | null> {
  const urls: string[] = []
  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    if (next.hasCommand('done')) return urls

    const photos = next.message?.photo
    if (!photos || photos.length === 0) {
      await next.reply('Это не фото. Отправьте фото или /done.')
      continue
    }
    // `photo` is an array of sizes; pick the largest (last).
    const largest = photos[photos.length - 1]!
    try {
      const url = await ctx.deps.photoUploader.upload(next.api, largest.file_id)
      urls.push(url)
      await next.reply(`✅ Загружено фото ${urls.length}`)
    } catch (error) {
      await next.reply(
        '❌ Не удалось загрузить фото: ' +
          escapeHtml(error instanceof Error ? error.message : String(error)),
        { parse_mode: 'HTML' },
      )
    }
  }
}

/**
 * Step: collect exemplars (size, price, in-stock) until `/done`.
 *
 * Returns `null` on `/cancel`, otherwise the collected array (possibly empty —
 * the caller enforces a minimum).
 */
async function collectExemplars(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<CreateExemplarData[] | null> {
  const exemplars: CreateExemplarData[] = []
  await ctx.reply('Добавим вариант. Введите размер (9 или 11):')

  while (true) {
    // size
    const sizeCtx = await conversation.wait()
    if (sizeCtx.hasCommand('cancel')) return null
    if (sizeCtx.hasCommand('done')) return exemplars
    const size = parseSize(sizeCtx.message?.text)
    if (!size) {
      await sizeCtx.reply('Введите 9 или 11. /done — закончить, /cancel — отмена.')
      continue
    }

    // price
    await sizeCtx.reply('Введите цену в рублях (целое число):')
    const priceCtx = await conversation.wait()
    if (priceCtx.hasCommand('cancel')) return null
    const price = parsePrice(priceCtx.message?.text)
    if (price === null) {
      await priceCtx.reply('Неверная цена. Начните вариант заново — введите размер.')
      continue
    }

    // in stock
    await priceCtx.reply('В наличии? (да/нет):')
    const stockCtx = await conversation.wait()
    if (stockCtx.hasCommand('cancel')) return null
    const inStock = parseBool(stockCtx.message?.text)

    exemplars.push({ size, price, inStock })
    await stockCtx.reply(
      `✅ Добавлен вариант ${size}, ${price} ₽, ` +
        `${inStock ? 'в наличии' : 'нет в наличии'}.\n` +
        `Следующий вариант — введите размер, или /done для завершения.`,
    )
  }
}

/**
 * Step: show a draft summary and ask yes/no.
 *
 * Returns `true`/`false` for the answer, or `null` on `/cancel`.
 */
async function confirmDraft(
  conversation: BotConversation,
  ctx: BotContext,
  draft: DraftProduct,
): Promise<boolean | null> {
  const lines: string[] = []
  lines.push('📋 <b>Проверьте товар:</b>')
  lines.push(`Название: ${escapeHtml(draft.name)}`)
  lines.push(`Категория: ${escapeHtml(draft.category.name)}`)
  lines.push(`Описание: ${escapeHtml(draft.description)}`)
  lines.push(`Фото: ${draft.images.length} шт.`)
  lines.push('Варианты:')
  for (const ex of draft.exemplars) {
    lines.push(`  ${ex.size} — ${ex.price} ₽ (${ex.inStock ? 'в наличии' : 'нет'})`)
  }
  lines.push('\nСоздать? (да/нет):')
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })

  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    const answer = next.message?.text?.trim().toLowerCase()
    if (answer === 'да' || answer === 'yes' || answer === 'y') return true
    if (answer === 'нет' || answer === 'no' || answer === 'n') return false
    await next.reply('Ответьте да или нет. /cancel — отменить.')
  }
}

/** Parses a size input ("9" → p9, "11" → p11); returns `null` otherwise. */
function parseSize(input: string | undefined): CreateExemplarData['size'] | null {
  if (input === '9') return Size.P9
  if (input === '11') return Size.P11
  return null
}

/** Parses a non-negative integer price; returns `null` otherwise. */
function parsePrice(input: string | undefined): number | null {
  if (input === undefined) return null
  const n = Number(input.trim())
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

/** Parses a Russian да/нет (or en yes/no) boolean. Defaults to `false`. */
function parseBool(input: string | undefined): boolean {
  const v = input?.trim().toLowerCase()
  return v === 'да' || v === 'yes' || v === 'true' || v === '1'
}

/** Unused import guard: `Context` is referenced only for clarity of the alias. */
export type { Context }
