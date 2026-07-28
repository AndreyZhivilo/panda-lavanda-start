import { Heart, ShoppingCart } from 'lucide-react'
import { Link } from '@tanstack/react-router'

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
  /**
   * Add the product's primary exemplar to the cart. When omitted, no add-to-cart
   * button is rendered (e.g. on a page that does not support quick-add).
   */
  onAddToCart?: () => void
  /** Disables the add-to-cart button (e.g. while the add mutation is in flight). */
  isAddingToCart?: boolean
}

/**
 * Catalog product card with a favorite (heart) toggle and an optional
 * add-to-cart button.
 *
 * Extracted from `catalog-page.tsx` so the catalog and the favorites page
 * render the same card. The card is a pure presentational component: the
 * parent owns the favorite/cart state (via {@link useFavorites} /
 * {@link useCart}) and passes it in.
 *
 * The whole card links to the product's detail page (`/products/$productId`)
 * via a "stretched link": the `<Link>` is absolutely positioned to cover the
 * entire card (`z-0`), so any empty area navigates on click. The interactive
 * controls (heart + cart) sit in the normal flow but carry `relative z-10`,
 * which lifts them above the link so their clicks are handled instead of
 * navigating. This keeps the markup valid — no nested `<a>` / `<button>` —
 * while preserving the "whole card is clickable" affordance.
 */
export function ProductCard({
  product,
  isFavorite,
  onToggleFavorite,
  isTogglingFavorite = false,
  onAddToCart,
  isAddingToCart = false,
}: ProductCardProps) {
  const price = minPrice(product)
  const inStock = isInStock(product)
  const image = product.images[0]

  return (
    <li className="relative flex flex-col overflow-hidden rounded-lg border bg-background">
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
          className="absolute right-2 top-2 z-10 bg-background/80 backdrop-blur-sm"
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

        <div className="relative z-10 mt-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
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
                  ? 'ml-2 text-xs text-muted-foreground'
                  : 'ml-2 text-xs font-medium text-destructive'
              }
            >
              {inStock
                ? `вариантов: ${product.exemplars.length}`
                : 'нет в наличии'}
            </span>
          </div>

          {onAddToCart ? (
            <Button
              type="button"
              size="icon"
              aria-label={`Добавить в корзину: ${product.name}`}
              disabled={isAddingToCart || !inStock}
              onClick={onAddToCart}
            >
              <ShoppingCart />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stretched link covering the whole card. Sits below the controls
          (z-0) so clicks on the heart / cart buttons are not hijacked. */}
      <Link
        to="/products/$productId"
        params={{ productId: product.id }}
        aria-label={`Открыть товар: ${product.name}`}
        className="absolute inset-0 z-0 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </li>
  )
}

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
