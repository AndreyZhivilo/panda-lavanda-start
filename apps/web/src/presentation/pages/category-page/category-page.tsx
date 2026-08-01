import { useState } from 'react'
import type { ICategory, IProduct } from '@panda-lavanda/domain'
import { primaryExemplar } from '@panda-lavanda/domain'
import { useLoaderData, useRouter, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'

import { Button } from '#/shared/components/button'
import { Input } from '#/shared/components/input'
import { ProductCard } from '#/shared/components/product-card'
import { useCart, useDebouncedCallback, useFavorites } from '#/shared/hooks'

import { pageRange, type PageItem } from '../catalog-page/page-range'

/** Page size — must match the repository default (see products.repository.ts). */
const PAGE_SIZE = 20

/** How long the search input waits before committing the query to the URL. */
const SEARCH_DEBOUNCE_MS = 300

/** Discriminated-union shape of the category server function result on the wire. */
type CategoryResult =
  | { ok: true; category: ICategory | null }
  | { ok: false; message: string }

/** Discriminated-union shape of the products server function result on the wire. */
type ProductsResult =
  | { ok: true; products: IProduct[]; total: number; page: number }
  | { ok: false; message: string }

/**
 * Loader data for the category route.
 *
 * The route resolves the category first (by slug); only when it exists does it
 * also load the filtered products page. So `products` is present exactly when
 * the category was found — the page treats its absence as "category not found".
 * The flat shape keeps narrowing simple (no discriminated-union acrobatics).
 */
type CategoryLoaderData = {
  category: CategoryResult
  products?: ProductsResult
}

/**
 * Category page: lists the products of a single category, with free-text
 * search and pagination — mirroring the catalog page.
 *
 * Three states:
 *  - category failed to load → error panel with a retry button;
 *  - category not found (`null`) → "not found" panel;
 *  - category loaded → header with the category name + the products grid.
 *
 * Search and pagination are URL-driven (`?q=` / `?page=`), exactly like the
 * catalog, so the view survives reload, is shareable, and works with
 * back/forward.
 */
export function CategoryPage() {
  const data = useLoaderData({
    from: '/categories/$categorySlug',
  }) as CategoryLoaderData
  const router = useRouter()
  const { q } = useSearch({ from: '/categories/$categorySlug' })
  const { isFavorite, toggle, isToggling } = useFavorites()
  const { addItem, isPending: isCartPending } = useCart()

  // Category failed to load.
  if (!data.category.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive">
            Не удалось загрузить категорию
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.category.message}
          </p>
          <Button className="mt-4" onClick={() => router.invalidate()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  // Category not found.
  if (data.category.category === null) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold">Категория не найдена</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Возможно, ссылка устарела или была удалена.
          </p>
        </div>
      </div>
    )
  }

  const category = data.category.category

  // The products branch is only present when the category was found; the route
  // guarantees this. Distinguish an error from the success payload below.
  const productsData = data.products!

  // Local input value, seeded once from the URL so a shared link shows the
  // query in the field on first paint. After that the field is user-owned; only
  // the debounce writes back to the URL (avoids the round-trip that used to
  // erase the last typed character).
  const [query, setQuery] = useState(q ?? '')

  const commitSearch = useDebouncedCallback((value: string) => {
    router.navigate({
      to: '/categories/$categorySlug',
      params: { categorySlug: category.slug },
      search: (prev) => ({ ...prev, q: value.trim() || undefined, page: 1 }),
    })
  }, SEARCH_DEBOUNCE_MS)

  if (!productsData.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive">
            Не удалось загрузить товары
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {productsData.message}
          </p>
          <Button className="mt-4" onClick={() => router.invalidate()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const { products, total, page } = productsData
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    return router.navigate({
      to: '/categories/$categorySlug',
      params: { categorySlug: category.slug },
      search: (prev) => ({ ...prev, page: clamped }),
    })
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{category.name}</h1>

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
          {q ? <>Ничего не найдено по запросу «{q}».</> : 'Товаров в этой категории пока нет.'}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
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
