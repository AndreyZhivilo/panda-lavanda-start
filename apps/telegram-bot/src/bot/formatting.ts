import type { ICategory, IProduct } from '@panda-lavanda/domain'
import { isInStock, minPrice, sizeLabel } from '@panda-lavanda/domain'

/**
 * Formatting helpers for bot messages.
 *
 * Pure functions over domain entities — kept in one place so the chat-facing
 * wording has a single definition and reuses the domain's own helpers
 * (`minPrice`, `isInStock`, `sizeLabel`) to stay consistent with the storefront.
 */

/** Renders a short product summary for lists / search results. */
export function formatProductShort(product: IProduct): string {
  const price = product.exemplars.length
    ? `${minPrice(product)} ₽`
    : '—'
  const stock = isInStock(product) ? '✅ в наличии' : '❌ нет в наличии'
  return `📦 <b>${escapeHtml(product.name)}</b>\n   ${price} · ${stock}\n   /show_${product.slug}`
}

/** Renders the full product detail (description, exemplars, photos count). */
export function formatProductFull(product: IProduct): string {
  const lines: string[] = []
  lines.push(`📦 <b>${escapeHtml(product.name)}</b>`)
  lines.push(`Категория: ${product.category}`)
  lines.push(`Slug: <code>${escapeHtml(product.slug)}</code>`)
  lines.push('')
  lines.push(escapeHtml(product.description))
  lines.push('')
  lines.push('Варианты:')

  if (product.exemplars.length === 0) {
    lines.push('  (нет вариантов)')
  } else {
    for (const ex of product.exemplars) {
      const stock = ex.inStock ? '✅' : '❌'
      lines.push(`  ${stock} ${sizeLabel(ex.size)} — ${ex.price} ₽  <code>${ex.id}</code>`)
    }
  }

  lines.push('')
  lines.push(`Фото: ${product.images.length}`)
  lines.push(`ID: <code>${product.id}</code>`)
  return lines.join('\n')
}

/** Renders a numbered category list with inline-friendly format. */
export function formatCategoryList(categories: ICategory[]): string {
  if (categories.length === 0) return 'Категории не найдены.'
  return categories
    .map((c, i) => `${i + 1}. ${escapeHtml(c.name)} (<code>${c.id}</code>)`)
    .join('\n')
}

/** HTML-escapes a string for safe interpolation inside an HTML-parsed message. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
