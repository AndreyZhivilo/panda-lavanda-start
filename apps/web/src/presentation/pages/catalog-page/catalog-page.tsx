import type { IProduct } from '@panda-lavanda/domain'
import { useLoaderData, useRouter } from '@tanstack/react-router'

import { Button } from '#/shared/components/button'

import { pageRange, type PageItem } from './page-range'

/** Page size — must match the repository default (see drizzle-products.repository.ts). */
const PAGE_SIZE = 20

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

/** Smallest exemplar price, or `null` when the product has no exemplars. */
function minPrice(product: IProduct): number | null {
  if (product.exemplars.length === 0) return null
  return Math.min(...product.exemplars.map((e) => e.price))
}

/** A product is in stock if at least one exemplar is in stock. */
function isInStock(product: IProduct): boolean {
  return product.exemplars.some((e) => e.inStock)
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}

/**
 * Minimal catalog prototype with pagination.
 *
 * Purpose: prove the whole stack works (DB → infrastructure → application →
 * web) and exercise URL-driven pagination. The full catalog UI (filters,
 * grid/list toggle, etc.) is specced in design-spec.md §7 and is a separate
 * task.
 */
export function CatalogPage() {
  const data = useLoaderData({ from: '/catalog' }) as CatalogLoaderData
  const router = useRouter()

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
    return router.navigate({
      to: '/catalog',
      search: { page: clamped },
    })
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Каталог</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} товар(ов)
        </p>
      </header>

      {products.length === 0 ? (
        <div className="text-center text-muted-foreground">
          Товаров пока нет.
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const price = minPrice(product)
              const inStock = isInStock(product)
              const image = product.images[0]

              return (
                <li
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-lg border bg-background"
                >
                  <div className="aspect-[4/3] bg-muted">
                    {image ? (
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h2 className="font-medium leading-snug">{product.name}</h2>

                    <div className="mt-auto flex items-center justify-between">
                      {price !== null ? (
                        <span className="font-semibold">
                          от {formatPrice(price)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          цена не задана
                        </span>
                      )}

                      <span
                        className={
                          inStock
                            ? 'text-xs text-muted-foreground'
                            : 'text-xs font-medium text-destructive'
                        }
                      >
                        {inStock
                          ? `вариантов: ${product.exemplars.length}`
                          : 'нет в наличии'}
                      </span>
                    </div>
                  </div>
                </li>
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
