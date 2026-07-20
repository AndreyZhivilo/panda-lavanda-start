/**
 * Computes the page numbers (and ellipses) to render in a pagination control.
 *
 * Pure function — no React — so it can be unit-tested in isolation.
 *
 * Rules:
 * - Always show the first and last page.
 * - If the range fits in `maxVisible` slots, show everything.
 * - Otherwise show a window around `current`, with `'…'` separators where
 *   a contiguous run was elided.
 *
 * @example pageRange(5, 20) → [1, '…', 4, 5, 6, '…', 20]
 * @example pageRange(2, 4)  → [1, 2, 3, 4]
 */
export type PageItem = number | '…'

export function pageRange(
  current: number,
  total: number,
  maxVisible = 7,
): PageItem[] {
  if (total <= 0) return []
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const items: PageItem[] = [1]

  // Window half-size around `current` (excluding current itself).
  const half = Math.max(1, Math.floor((maxVisible - 4) / 2))
  const windowStart = Math.max(2, current - half)
  const windowEnd = Math.min(total - 1, current + half)

  if (windowStart > 2) items.push('…')
  for (let p = windowStart; p <= windowEnd; p++) items.push(p)
  if (windowEnd < total - 1) items.push('…')

  items.push(total)
  return items
}
