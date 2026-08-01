import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Minus, Plus, ShoppingCart, Trash } from 'lucide-react'

import { cartSubtotal, sizeLabel } from '@panda-lavanda/domain'
import type { ICartItem, IExemplar, IProduct } from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'

import { getProducts } from '#/app/server-functions'
import { Button } from '#/shared/components/button'
import { useCart } from '#/shared/hooks'

/**
 * Cart page — client-rendered (the route sets `ssr: false` and a `noindex`
 * robots directive, so search engines neither index it nor receive server
 * HTML for it).
 *
 * The cart lines live in LocalStorage via {@link useCart}; we load the
 * matching products through the existing `getProducts` server function
 * (passing the distinct product ids referenced by the lines). Product data
 * (name, image, exemplar price/size) is always read fresh from the backend —
 * the cart itself only stores ids + quantity, so there is no stale-price
 * drift. A TanStack Query `useQuery` keys off the ids array, so the page
 * refreshes automatically whenever the cart changes (`useCart` invalidates
 * the `['cart']` query, and this query's key changes when the ids change).
 *
 * Subtotals are computed with the pure {@link cartSubtotal} domain function,
 * using a resolver built from the loaded exemplars (lines whose exemplar no
 * longer exists are skipped in the total but still listed, with a note).
 */
export function CartPage() {
  const {
    items,
    isLoading: isCartLoading,
    setQuantity,
    removeItem,
    isPending,
  } = useCart()

  // Distinct product ids referenced by the cart lines (a product may have
  // several exemplars in the cart as separate lines).
  const productIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.productId))),
    [items],
  )

  const { data, isLoading: areProductsLoading, error } = useQuery({
    queryKey: ['cart-products', productIds] as const,
    queryFn: () =>
      getProducts({ data: { ids: productIds, pageSize: productIds.length || 1 } }),
    // Don't fire until we actually have ids; otherwise we'd load every product.
    enabled: productIds.length > 0,
  })

  // Index products and exemplars for O(1) lookup while rendering lines.
  const { productsById, exemplarById } = useMemo(() => {
    const productsById = new Map<UniqueId, IProduct>()
    const exemplarById = new Map<UniqueId, IExemplar>()
    if (data?.ok) {
      for (const product of data.products) {
        productsById.set(product.id, product)
        for (const exemplar of product.exemplars) {
          exemplarById.set(exemplar.id, exemplar)
        }
      }
    }
    return { productsById, exemplarById }
  }, [data])

  // Resolver for cartSubtotal: exemplar id → current unit price (or undefined
  // when the exemplar was deleted, which makes cartSubtotal skip that line).
  const priceOf = (exemplarId: UniqueId) => exemplarById.get(exemplarId)?.price

  if (isCartLoading) {
    return <Status text="Загрузка корзины…" />
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border bg-background p-8 text-center">
          <h1 className="text-xl font-semibold">Корзина пуста</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Добавьте товары из каталога — они появятся здесь.
          </p>
          <Link
            to="/catalog"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Перейти в каталог →
          </Link>
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

  const subtotal = cartSubtotal({ items }, priceOf)

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Корзина</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} позиций(я)
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <CartLine
              key={item.exemplarId}
              item={item}
              product={productsById.get(item.productId)}
              exemplar={exemplarById.get(item.exemplarId)}
              isPending={isPending}
              onIncrement={() => setQuantity(item.exemplarId, item.quantity + 1)}
              onDecrement={() => setQuantity(item.exemplarId, item.quantity - 1)}
              onRemove={() => removeItem(item.exemplarId)}
            />
          ))}
        </ul>

        <aside className="lg:sticky lg:top-4 h-fit rounded-lg border bg-background p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Итого</h2>
          <p className="mt-1 text-2xl font-semibold">{formatPrice(subtotal)}</p>
          <Button type="button" size="lg" className="mt-4 w-full" asChild>
            <Link to="/checkout">
              <ShoppingCart />
              Оформить заказ
            </Link>
          </Button>
          <Link
            to="/catalog"
            className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Продолжить покупки
          </Link>
        </aside>
      </div>
    </div>
  )
}

interface CartLineProps {
  item: ICartItem
  product: IProduct | undefined
  exemplar: IExemplar | undefined
  isPending: boolean
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
}

function CartLine({
  item,
  product,
  exemplar,
  isPending,
  onIncrement,
  onDecrement,
  onRemove,
}: CartLineProps) {
  const image = product?.images[0]
  const lineTotal = exemplar ? exemplar.price * item.quantity : undefined
  const missing = !product || !exemplar

  return (
    <li className="flex gap-3 rounded-lg border bg-background p-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {image ? (
          <img
            src={image}
            alt={product?.name ?? ''}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          {product ? (
            <Link
              to="/products/$productSlug"
              params={{ productSlug: product.slug }}
              className="min-w-0 truncate font-medium hover:underline"
            >
              {product.name}
            </Link>
          ) : (
            <span className="min-w-0 truncate font-medium">Товар недоступен</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Удалить из корзины"
            disabled={isPending}
            onClick={onRemove}
          >
            <Trash className="size-4" />
          </Button>
        </div>

        {exemplar ? (
          <p className="text-xs text-muted-foreground">
            Размер: {sizeLabel(exemplar.size)} · {formatPrice(exemplar.price)} / шт
          </p>
        ) : null}

        {missing ? (
          <p className="text-xs font-medium text-destructive">
            Этого варианта больше нет в продаже.
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <QuantityStepper
            quantity={item.quantity}
            disabled={isPending || missing}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
          {lineTotal !== undefined ? (
            <span className="font-semibold">{formatPrice(lineTotal)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </li>
  )
}

interface QuantityStepperProps {
  quantity: number
  disabled: boolean
  onIncrement: () => void
  onDecrement: () => void
}

function QuantityStepper({
  quantity,
  disabled,
  onIncrement,
  onDecrement,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Уменьшить количество"
        disabled={disabled}
        onClick={onDecrement}
      >
        <Minus className="size-4" />
      </Button>
      <span
        className="min-w-8 text-center text-sm tabular-nums"
        aria-label="Количество"
      >
        {quantity}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Увеличить количество"
        disabled={disabled}
        onClick={onIncrement}
      >
        <Plus className="size-4" />
      </Button>
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

function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
