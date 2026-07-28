import type { IProduct } from '@panda-lavanda/domain'
import { isInStock, minPrice, primaryExemplar } from '@panda-lavanda/domain'
import { Heart, ShoppingCart } from 'lucide-react'
import { Link, useLoaderData, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/shared/components/button'
import { ExemplarSelector } from '#/shared/components/exemplar-selector'
import { ProductGallery } from '#/shared/components/product-gallery'
import { useCart, useFavorites } from '#/shared/hooks'
import { cn } from '#/shared/lib/utils'

/**
 * Loader payload — the folded Either from the `getProduct` server function.
 *
 * `Either`/`Error` don't cross the server→client serialization boundary, so
 * the server function returns this plain discriminated union (same convention
 * as `catalog-page` → `CatalogLoaderData`). A `null` product is a legitimate
 * "not found" case (the backend returned 404), distinct from a load error.
 */
type ProductLoaderData =
  | { ok: true; product: IProduct | null }
  | { ok: false; message: string }

export function ProductPage() {
  const data = useLoaderData({ from: '/products/$productSlug' }) as ProductLoaderData
  const router = useRouter()
  const { isFavorite, toggle, isToggling } = useFavorites()
  const { addItem, isPending: isCartPending } = useCart()

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <h1 className="text-xl font-semibold text-destructive">
            Не удалось загрузить товар
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{data.message}</p>
          <Button className="mt-4" onClick={() => router.invalidate()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const { product } = data

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold">Товар не найден</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Возможно, он был удалён или ссылка устарела.
          </p>
          <Button asChild className="mt-4">
            <Link to="/catalog">Перейти в каталог</Link>
          </Button>
        </div>
      </div>
    )
  }

  const favorite = isFavorite(product.id)
  const price = minPrice(product)
  const inStock = isInStock(product)

  // Lifted selection state: the add-to-cart button below needs to know which
  // exemplar (size) the shopper picked. Defaults to the primary exemplar
  // (first in-stock, else the first) so there is always a sensible selection.
  const [selectedExemplarId, setSelectedExemplarId] = useState(
    primaryExemplar(product)?.id,
  )
  const selectedExemplar = product.exemplars.find(
    (e) => e.id === selectedExemplarId,
  )
  const canAddToCart = Boolean(selectedExemplar?.inStock)

  const handleAddToCart = () => {
    if (!selectedExemplar) return
    addItem({
      exemplarId: selectedExemplar.id,
      productId: product.id,
      quantity: 1,
    })
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <Link
        to="/catalog"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ‹ Назад в каталог
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} />

        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold md:text-3xl">{product.name}</h1>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              aria-pressed={favorite}
              disabled={isToggling}
              onClick={() => toggle(product.id)}
            >
              <Heart className={cn(favorite && 'fill-current text-destructive')} />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {price !== null ? (
              <span className="text-sm text-muted-foreground">
                от {formatPrice(price)}
              </span>
            ) : null}
            <span
              className={cn(
                'text-sm',
                inStock ? 'text-muted-foreground' : 'font-medium text-destructive',
              )}
            >
              {inStock ? 'В наличии' : 'Нет в наличии'}
            </span>
          </div>

          {product.description ? (
            <p className="text-sm leading-relaxed text-foreground/90">
              {product.description}
            </p>
          ) : null}

          <ExemplarSelector
            exemplars={product.exemplars}
            selectedId={selectedExemplarId}
            onSelectChange={setSelectedExemplarId}
          />

          <Button
            type="button"
            size="lg"
            className="mt-1 w-full sm:w-auto"
            disabled={!canAddToCart || isCartPending}
            onClick={handleAddToCart}
          >
            <ShoppingCart />
            В корзину
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
