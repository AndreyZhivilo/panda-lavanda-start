import type { Conversation } from '@grammyjs/conversations'
import type { IProduct } from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

import type { BotContext } from '#/bot/context'
import { escapeHtml, formatProductFull } from '#/bot/formatting'
import { reportEither } from '#/bot/report'

/** Type alias for a conversation builder bound to the bot's context. */
type BotConversation = Conversation<BotContext, BotContext>

/**
 * The update-product conversation.
 *
 * Lets the admin change an existing catalog entry:
 *
 * 1. Find the product (by slug, or pick from a name search).
 * 2. Choose what to edit: price / stock / photos / name / description.
 * 3. Run the matching backend call:
 *    - price / stock  → `PATCH /products/:pid/exemplars/:eid` (stable id) — done
 *                       directly on the repository, wrapped in `tryCatch`.
 *    - photos         → upload a new set, `PATCH /products/:id { images }`.
 *    - name / desc    → `PATCH /products/:id { name | description }`.
 *
 * Uses `UpdateProductUseCase` for whole-product patches and the products
 * repository directly for the granular exemplar patch (no exemplar-level use
 * case exists yet). `/cancel` aborts at any wait.
 */
export async function updateProduct(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<void> {
  // --- 1. Find product -------------------------------------------------------
  await ctx.reply(
    'Введите <b>slug</b> товара или его название для поиска:',
    { parse_mode: 'HTML' },
  )
  const product = await findProduct(conversation, ctx)
  if (!product) return

  await ctx.reply(formatProductFull(product), { parse_mode: 'HTML' })

  // --- 2. Choose field -------------------------------------------------------
  const field = await pickField(conversation, ctx)
  if (!field) return

  // --- 3. Apply edit ---------------------------------------------------------
  switch (field) {
    case 'price':
      await editExemplarField(conversation, ctx, product, 'price')
      return
    case 'stock':
      await editExemplarField(conversation, ctx, product, 'stock')
      return
    case 'photos':
      await editPhotos(conversation, ctx, product)
      return
    case 'name':
      await editTextField(conversation, ctx, product, 'name')
      return
    case 'description':
      await editTextField(conversation, ctx, product, 'description')
      return
  }
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Finds a product by slug first, falling back to a name search.
 *
 * Returns `null` on `/cancel` or when the admin gives up.
 */
async function findProduct(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<IProduct | null> {
  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    const query = next.message?.text?.trim()
    if (!query) {
      await next.reply('Введите slug или название. /cancel — отменить.')
      continue
    }

    // Try slug first (exact).
    const bySlug = await ctx.deps.getProductBySlug.execute(query)
    if (bySlug.isRight() && bySlug.value) return bySlug.value

    // Fall back to a name search.
    const search = await ctx.deps.getProducts.execute({ search: query, pageSize: 5 })
    if (search.isLeft()) {
      await next.reply('❌ Ошибка поиска. Попробуйте снова или /cancel.')
      continue
    }
    const matches = search.value.items
    if (matches.length === 0) {
      await next.reply('Ничего не найдено. Введите другой запрос или /cancel.')
      continue
    }
    if (matches.length === 1) return matches[0]!

    // Multiple matches: list them and ask for a number.
    return pickFromList(conversation, next, matches)
  }
}

/** Step: pick a product from a numbered list. Returns `null` on `/cancel`. */
async function pickFromList(
  conversation: BotConversation,
  ctx: BotContext,
  products: IProduct[],
): Promise<IProduct | null> {
  const lines = ['Найдено несколько товаров. Выберите номер:']
  products.forEach((p, i) => lines.push(`${i + 1}. ${escapeHtml(p.name)}`))
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })

  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    const idx = Number(next.message?.text?.trim()) - 1
    if (!Number.isInteger(idx) || idx < 0 || idx >= products.length) {
      await next.reply('Неверный номер. Попробуйте снова. /cancel — отмена.')
      continue
    }
    return products[idx]!
  }
}

/** The editable fields offered to the admin. */
type EditField = 'price' | 'stock' | 'photos' | 'name' | 'description'

/** Step: pick what to edit. Returns `null` on `/cancel`. */
async function pickField(
  conversation: BotConversation,
  ctx: BotContext,
): Promise<EditField | null> {
  const options: { key: EditField; label: string }[] = [
    { key: 'price', label: 'Цена варианта' },
    { key: 'stock', label: 'Наличие варианта' },
    { key: 'photos', label: 'Фотографии' },
    { key: 'name', label: 'Название' },
    { key: 'description', label: 'Описание' },
  ]
  const lines = ['Что редактируем? (введите номер):']
  options.forEach((o, i) => lines.push(`${i + 1}. ${o.label}`))
  await ctx.reply(lines.join('\n'))

  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return null
    const idx = Number(next.message?.text?.trim()) - 1
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      await next.reply('Неверный номер. Попробуйте снова. /cancel — отмена.')
      continue
    }
    return options[idx]!.key
  }
}

/**
 * Edits a price or stock field on a chosen exemplar.
 *
 * Uses the products repository's `updateExemplar` directly (stable exemplar id),
 * wrapped in `tryCatch` to convert a thrown `AppError` into `Either.Left` — the
 * same pattern the application-layer use cases use.
 */
async function editExemplarField(
  conversation: BotConversation,
  ctx: BotContext,
  product: IProduct,
  field: 'price' | 'stock',
): Promise<void> {
  if (product.exemplars.length === 0) {
    await ctx.reply('У товара нет вариантов (exemplars). Нечего редактировать.')
    return
  }

  // Pick exemplar.
  const lines = ['Выберите вариант (номер):']
  product.exemplars.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.size} — ${e.price} ₽ (${e.inStock ? 'в наличии' : 'нет'})`)
  })
  await ctx.reply(lines.join('\n'))

  let exemplar = product.exemplars[0]!
  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return
    const idx = Number(next.message?.text?.trim()) - 1
    if (Number.isInteger(idx) && idx >= 0 && idx < product.exemplars.length) {
      exemplar = product.exemplars[idx]!
      break
    }
    await next.reply('Неверный номер. Попробуйте снова. /cancel — отмена.')
  }

  if (field === 'price') {
    await ctx.reply(`Текущая цена: ${exemplar.price} ₽. Введите новую цену:`)
    const valueCtx = await conversation.wait()
    if (valueCtx.hasCommand('cancel')) return
    const price = Number(valueCtx.message?.text?.trim())
    if (!Number.isInteger(price) || price < 0) {
      await ctx.reply('❌ Неверная цена. Операция отменена.')
      return
    }
    const result = await tryCatch(() =>
      ctx.deps.productsRepository.updateExemplar(product.id, exemplar.id, { price }),
    )
    await reportEither(ctx, result, 'Цена обновлена.')
    return
  }

  // stock toggle
  const nextStock = !exemplar.inStock
  await ctx.reply(
    `Текущее наличие: ${exemplar.inStock ? 'в наличии' : 'нет'}. ` +
      `Установить ${nextStock ? 'в наличии' : 'нет в наличии'}? (да/нет)`,
  )
  const valueCtx = await conversation.wait()
  if (valueCtx.hasCommand('cancel')) return
  const answer = valueCtx.message?.text?.trim().toLowerCase()
  if (answer !== 'да' && answer !== 'yes' && answer !== 'y') {
    await ctx.reply('Оставлено без изменений.')
    return
  }
  const result = await tryCatch(() =>
    ctx.deps.productsRepository.updateExemplar(product.id, exemplar.id, {
      inStock: nextStock,
    }),
  )
  await reportEither(ctx, result, 'Наличие обновлено.')
}

/** Step: replace the product's photos with a freshly uploaded set. */
async function editPhotos(
  conversation: BotConversation,
  ctx: BotContext,
  product: IProduct,
): Promise<void> {
  await ctx.reply(
    `Сейчас фото: ${product.images.length} шт. Отправьте новые фотографии ` +
      '(старые будут заменены). Завершите командой /done. Минимум одна.',
  )
  const urls: string[] = []
  while (true) {
    const next = await conversation.wait()
    if (next.hasCommand('cancel')) return
    if (next.hasCommand('done')) break
    const photos = next.message?.photo
    if (!photos || photos.length === 0) {
      await next.reply('Это не фото. Отправьте фото или /done.')
      continue
    }
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

  if (urls.length === 0) {
    await ctx.reply('❌ Не загружено ни одного фото. Изменения не сохранены.')
    return
  }

  const result = await ctx.deps.updateProduct.execute(product.id, { images: urls })
  await reportEither(ctx, result, 'Фотографии обновлены.')
}

/** Step: edit a text field (name or description) via whole-product PATCH. */
async function editTextField(
  conversation: BotConversation,
  ctx: BotContext,
  product: IProduct,
  field: 'name' | 'description',
): Promise<void> {
  await ctx.reply(
    `Текущее значение: ${escapeHtml(product[field])}\nВведите новое значение:`,
    { parse_mode: 'HTML' },
  )
  const valueCtx = await conversation.wait()
  if (valueCtx.hasCommand('cancel')) return
  const value = valueCtx.message?.text?.trim()
  if (!value) {
    await ctx.reply('❌ Пустое значение. Изменения не сохранены.')
    return
  }
  const result = await ctx.deps.updateProduct.execute(product.id, { [field]: value })
  await reportEither(ctx, result, 'Поле обновлено.')
}
