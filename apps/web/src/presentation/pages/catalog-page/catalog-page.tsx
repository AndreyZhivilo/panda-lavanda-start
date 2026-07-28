import { useState } from 'react'
import type { IProduct } from '@panda-lavanda/domain'
import { primaryExemplar } from '@panda-lavanda/domain'
import { useLoaderData, useRouter, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'

import { Button } from '#/shared/components/button'
import { Input } from '#/shared/components/input'
import { ProductCard } from '#/shared/components/product-card'
import { useCart, useDebouncedCallback, useFavorites } from '#/shared/hooks'

import { pageRange, type PageItem } from './page-range'

/** Page size — must match the repository default (see drizzle-products.repository.ts). */
const PAGE_SIZE = 20

/** How long the search input waits for the user to stop typing before
 * committing the query to the URL (and thus triggering a server fetch). */
const SEARCH_DEBOUNCE_MS = 300

/**
 * JSON-serializable shape of what the catalog route loader returns.
 *
 * The use case produces an `Either<Error, Paginated<IProduct>>`, but `Either`
 * (a class with methods) and `Error` do not survive TanStack Start's
 * server→client serialization. The route's server function converts the
 * result into this plain discriminated union on the wire.
 */
type CatalogLoaderData =
  | { ok: true; products: IProduct[]; total: number; page: number }
  | { ok: false; message: string }

/**
 * Minimal catalog prototype with pagination + free-text search.
 *
 * Purpose: prove the whole stack works (DB → infrastructure → application →
 * web) and exercise URL-driven pagination/search. The full catalog UI
 * (filters, grid/list toggle, etc.) is specced in design-spec.md §7 and is a
 * separate task.
 *
 * Search is URL-driven: `?q=` is the single source of truth, so it survives
 * reload, is shareable as a link, and works with back/forward. The input owns
 * its own local state for instant, lag-free typing; each keystroke schedules a
 * debounced navigation that writes the trimmed query back to the URL (which in
 * turn re-runs the route loader). No URL→input sync effect is needed, which
 * avoids the round-trip that used to erase the last typed character.
 */
export function CatalogPage() {
  const data = useLoaderData({ from: '/catalog' }) as CatalogLoaderData
  const router = useRouter()
  const { q } = useSearch({ from: '/catalog' })
  const { isFavorite, toggle, isToggling } = useFavorites()
  const { addItem, isPending: isCartPending } = useCart()

  // Local input value, seeded once from the URL so a shared link like
  // `/catalog?q=monstera` shows the query in the field on first paint. After
  // that the field is user-owned; only the debounce writes back to the URL.
  const [query, setQuery] = useState(q ?? '')

  // Push the query into the URL (debounced): resetting to page 1 keeps the
  // result meaningful after a new query. The functional `search` updater
  // preserves any other search params while only touching `q` and `page`.
  const commitSearch = useDebouncedCallback((value: string) => {
    router.navigate({
      to: '/catalog',
      search: (prev) => ({ ...prev, q: value.trim() || undefined, page: 1 }),
    })
  }, SEARCH_DEBOUNCE_MS)

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive">
            Не удалось загрузить товары
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{data.message}</p>
          <Button className="mt-4" onClick={() => router.invalidate()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const { products, total, page } = data
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    // Functional updater preserves the current search query while paging.
    return router.navigate({
      to: '/catalog',
      search: (prev) => ({ ...prev, page: clamped }),
    })
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Каталог</h1>

        <div className="relative mt-3 max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              commitSearch(e.target.value)
            }}
            placeholder="Поиск по названию…"
            aria-label="Поиск товаров"
            className="pl-9"
          />
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {total} товар(ов)
        </p>
      </header>

      {products.length === 0 ? (
        <div className="text-center text-muted-foreground">
          {q ? <>Ничего не найдено по запросу «{q}».</> : 'Товаров пока нет.'}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              // The catalog card has no size picker; quick-add uses the
              // product's primary exemplar (first in-stock, else the first).
              const primary = primaryExemplar(product)
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  isFavorite={isFavorite(product.id)}
                  onToggleFavorite={() => toggle(product.id)}
                  isTogglingFavorite={isToggling}
                  onAddToCart={
                    primary
                      ? () =>
                          addItem({
                            exemplarId: primary.id,
                            productId: product.id,
                            quantity: 1,
                          })
                      : undefined
                  }
                  isAddingToCart={isCartPending}
                />
              )
            })}
          </ul>

          {totalPages > 1 && (
            <Pagination
              current={page}
              totalPages={totalPages}
              onNavigate={goToPage}
            />
          )}
        </>
      )}
    </div>
  )
}

interface PaginationProps {
  current: number
  totalPages: number
  onNavigate: (page: number) => void | Promise<void>
}

function Pagination({ current, totalPages, onNavigate }: PaginationProps) {
  const items = pageRange(current, totalPages)

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-2"
      aria-label="Пагинация"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={current <= 1}
        onClick={() => onNavigate(current - 1)}
        aria-label="Назад"
      >
        ‹
      </Button>

      {items.map((item, i) =>
        item === '…' ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2 text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === current ? 'default' : 'outline'}
            size="sm"
            onClick={() => onNavigate(item)}
            aria-current={item === current ? 'page' : undefined}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={current >= totalPages}
        onClick={() => onNavigate(current + 1)}
        aria-label="Вперёд"
      >
        ›
      </Button>
    </nav>
  )
}

// Re-export so the page-range helper can be reached from the page barrel if
// ever needed by tests colocated with the page.
export type { PageItem }
