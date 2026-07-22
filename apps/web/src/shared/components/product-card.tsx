import { Heart } from 'lucide-react'

import { isInStock, minPrice } from '@panda-lavanda/domain'
import type { IProduct } from '@panda-lavanda/domain'

import { Button } from '#/shared/components/button'
import { cn } from '#/shared/lib/utils'

interface ProductCardProps {
  product: IProduct
  /** Whether the product is currently in the user's favorites. */
  isFavorite: boolean
  /** Toggle the product's favorite state. */
  onToggleFavorite: () => void
  /** Disables the heart toggle (e.g. while a toggle mutation is in flight). */
  isTogglingFavorite?: boolean
}

/**
 * Catalog product card with a favorite (heart) toggle.
 *
 * Extracted from `catalog-page.tsx` so both the catalog and the favorites page
 * render the same card. The card is a pure presentational component: the
 * parent owns the favorite state (via {@link useFavorites}) and passes it in.
 */
export function ProductCard({
  product,
  isFavorite,
  onToggleFavorite,
  isTogglingFavorite = false,
}: ProductCardProps) {
  const price = minPrice(product)
  const inStock = isInStock(product)
  const image = product.images[0]

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-background">
      <div className="relative aspect-[4/3] bg-muted">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 bg-background/80 backdrop-blur-sm"
          aria-label={
            isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'
          }
          aria-pressed={isFavorite}
          disabled={isTogglingFavorite}
          onClick={onToggleFavorite}
        >
          <Heart
            className={cn(isFavorite && 'fill-current text-destructive')}
          />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-medium leading-snug">{product.name}</h2>

        <div className="mt-auto flex items-center justify-between">
          {price !== null ? (
            <span className="font-semibold">от {formatPrice(price)}</span>
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
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
