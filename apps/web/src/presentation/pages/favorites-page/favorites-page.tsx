import { useQuery } from '@tanstack/react-query'

import { getProducts } from '#/app/server-functions'
import { ProductCard } from '#/shared/components/product-card'
import { useFavorites } from '#/shared/hooks'

/**
 * Favorites page — client-rendered (the route sets `ssr: false` and a
 * `noindex` robots directive, so search engines neither index it nor receive
 * server HTML for it).
 *
 * The favorited ids live in LocalStorage via {@link useFavorites}; we load
 * the matching products through the existing `getProducts` server function
 * (passing `ids`). A TanStack Query `useQuery` keys off the ids array, so the
 * grid refreshes automatically whenever a heart is toggled (the underlying
 * `['user']` query is invalidated by `useFavorites`, and this query's key
 * changes when the ids list changes).
 */
export function FavoritesPage() {
  const { user, isLoading: isUserLoading, isFavorite, toggle, isToggling } =
    useFavorites()

  const ids = user?.favoriteProductIds ?? []

  const { data, isLoading: areProductsLoading, error } = useQuery({
    queryKey: ['favorites-products', ids] as const,
    queryFn: () => getProducts({ data: { ids, pageSize: ids.length || 1 } }),
    // Don't fire until we actually have ids; otherwise we'd load every product.
    enabled: ids.length > 0,
  })

  if (isUserLoading) {
    return <Status text="Загрузка избранного…" />
  }

  if (!user || ids.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border bg-background p-8 text-center">
          <h1 className="text-xl font-semibold">В избранном пусто</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Нажмите на сердечко у товара в каталоге, чтобы сохранить его здесь.
          </p>
          <a
            href="/catalog"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Перейти в каталог →
          </a>
        </div>
      </div>
    )
  }

  if (areProductsLoading) {
    return <Status text="Загрузка товаров…" />
  }

  if (error || (data && !data.ok)) {
    return <Status text="Не удалось загрузить товары" />
  }

  const products = data?.ok ? data.products : []

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Избранное</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ids.length} товар(ов)
        </p>
      </header>

      {products.length === 0 ? (
        <div className="text-center text-muted-foreground">
          Сохранённые товары не найдены.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={() => toggle(product.id)}
              isTogglingFavorite={isToggling}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function Status({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-2xl p-8 text-center text-muted-foreground">
      {text}
    </div>
  )
}
