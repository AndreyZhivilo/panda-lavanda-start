import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ShoppingBag } from 'lucide-react'

import {
  ContactMethod,
  cartSubtotal,
  contactMethodLabel,
  sizeLabel,
  type CreateOrderData,
  type CreateOrderItemData,
} from '@panda-lavanda/domain'
import type { IExemplar, IProduct } from '@panda-lavanda/domain'
import {
  normalizePhone,
  ruPhone,
  type PriceInRub,
  type UniqueId,
} from '@panda-lavanda/shared'

import { getProducts } from '#/app/server-functions'
import { Button } from '#/shared/components/button'
import { Input } from '#/shared/components/input'
import { useCart, useCheckout } from '#/shared/hooks'
import { cn } from '#/shared/lib/utils'

/**
 * Contact methods offered at checkout, in display order.
 *
 * Derived from the domain `ContactMethod` const-object so the option set stays
 * in sync with the single source of truth; the order here is the only thing the
 * UI owns.
 */
const CONTACT_METHODS = [
  ContactMethod.CALL,
  ContactMethod.TELEGRAM,
  ContactMethod.WHATSAPP,
  ContactMethod.MAX,
  ContactMethod.VKONTAKTE,
] as const

/**
 * Checkout page — client-rendered (the route sets `ssr: false` and a `noindex`
 * robots directive).
 *
 * Mirrors {@link CartPage}: cart lines come from {@link useCart} and the
 * matching product/exemplar data is loaded fresh via the existing `getProducts`
 * server function (the cart itself only stores ids + quantity). The form is
 * plain controlled `useState` over each field; the submit builds a
 * {@link CreateOrderData} (snapshotting each line's product name, size and unit
 * price from the catalog) and calls {@link useCheckout}.
 *
 * On success the use case has already cleared the cart and shown a toast; the
 * page only redirects home. The redirect is a presentation concern (router
 * navigation), which is why it lives here and not in the use case.
 */
export function CheckoutPage() {
  const { items, isLoading: isCartLoading } = useCart()
  const navigate = useNavigate()
  // Navigation on success is a presentation concern, so it lives here rather
  // than in the use case: pass it to the checkout hook as an `onSuccess`
  // callback, fired exactly once when the mutation resolves (after the hook has
  // invalidated the cart cache) — more precise than a `useEffect` watching a
  // boolean flag, which would fire "while success is true" instead of "once".
  const { placeOrder, isPlacing, isError, error } = useCheckout({
    onSuccess: () => navigate({ to: '/' }),
  })

  const productIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.productId))),
    [items],
  )

  const { data, isLoading: areProductsLoading } = useQuery({
    queryKey: ['cart-products', productIds] as const,
    queryFn: () =>
      getProducts({ data: { ids: productIds, pageSize: productIds.length || 1 } }),
    enabled: productIds.length > 0,
  })

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

  const priceOf = (exemplarId: UniqueId) =>
    exemplarById.get(exemplarId)?.price

  // A line is "broken" if its exemplar or product was deleted from the catalog
  // since it was added to the cart. Such an order cannot be placed: the snapshot
  // would be incomplete, so the submit button is disabled until the shopper
  // removes the stale line.
  const hasBrokenLines = useMemo(
    () =>
      items.some(
        (item) =>
          !productsById.has(item.productId) ||
          !exemplarById.has(item.exemplarId),
      ),
    [items, productsById, exemplarById],
  )

  // Form state.
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>(
    ContactMethod.CALL,
  )
  const [comment, setComment] = useState('')

  // Field-level validation. The phone rule is the shared {@link ruPhone} schema
  // — the same one the `createOrder` server function and the API route use — so
  // live feedback here and the authoritative server-side check cannot drift.
  // `safeParse` returns the refine message on failure; we surface it inline.
  const nameError = customerName.trim().length === 0
  const phoneParse = ruPhone.safeParse(phone)
  const phoneError = phoneParse.success ? undefined : phoneParse.error.issues[0]?.message
  const canSubmit =
    !nameError &&
    !phoneError &&
    !hasBrokenLines &&
    items.length > 0 &&
    !isPlacing

  const subtotal = cartSubtotal({ items }, priceOf)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    // Build snapshot order lines from the cart + freshly loaded catalog data.
    const orderItems: CreateOrderItemData[] = items.map((item) => {
      const product = productsById.get(item.productId)!
      const exemplar = exemplarById.get(item.exemplarId)!
      return {
        exemplarId: item.exemplarId,
        productId: item.productId,
        productName: product.name,
        size: exemplar.size,
        unitPrice: exemplar.price,
        quantity: item.quantity,
      }
    })

    const payload: CreateOrderData = {
      customerName: customerName.trim(),
      // Store the phone in its canonical 10-digit form (NSN) rather than the
      // raw typed string, so the catalog has one shape regardless of whether
      // the shopper typed `+7 …`, `8 …` or `89991234567`. Already validated by
      // `ruPhone` above, so normalization here only strips formatting.
      phone: normalizePhone(phone),
      contactMethod,
      comment: comment.trim() || undefined,
      totalPrice: subtotal,
      items: orderItems,
    }

    placeOrder(payload)
  }

  if (isCartLoading) {
    return <Status text="Загрузка корзины…" />
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border bg-background p-8 text-center">
          <h1 className="text-xl font-semibold">Корзина пуста</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Оформлять заказ не из чего — добавьте товары из каталога.
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

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Оформление заказа</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Заполните контактные данные — мы свяжемся с вами для подтверждения.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]"
      >
        <div className="flex flex-col gap-6">
          {/* Contact details */}
          <section className="rounded-lg border bg-background p-5">
            <h2 className="text-sm font-medium text-muted-foreground">
              Контактные данные
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <Field
                label="Имя"
                htmlFor="checkout-name"
                error={nameError ? 'Укажите имя' : undefined}
              >
                <Input
                  id="checkout-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                  aria-invalid={nameError || undefined}
                />
              </Field>
              <Field
                label="Телефон"
                htmlFor="checkout-phone"
                error={phoneError}
              >
                <Input
                  id="checkout-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  autoComplete="tel"
                  aria-invalid={phoneError !== undefined || undefined}
                />
              </Field>
            </div>
          </section>

          {/* Contact method */}
          <section className="rounded-lg border bg-background p-5">
            <h2 className="text-sm font-medium text-muted-foreground">
              Предпочтительный способ связи
            </h2>
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Способ связи"
            >
              {CONTACT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  role="radio"
                  aria-checked={contactMethod === method}
                  onClick={() => setContactMethod(method)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm font-medium transition',
                    contactMethod === method
                      ? 'border-ring bg-primary text-primary-foreground'
                      : 'bg-background hover:border-ring/50',
                  )}
                >
                  {contactMethodLabel(method)}
                </button>
              ))}
            </div>
          </section>

          {/* Comment */}
          <section className="rounded-lg border bg-background p-5">
            <h2 className="text-sm font-medium text-muted-foreground">
              Комментарий к заказу
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Удобное время для звонка, пожелания по доставке…"
              rows={3}
              className="mt-4 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-4 h-fit rounded-lg border bg-background p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Ваш заказ</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => {
              const product = productsById.get(item.productId)
              const exemplar = exemplarById.get(item.exemplarId)
              const broken = !product || !exemplar
              return (
                <li
                  key={item.exemplarId}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className={cn('truncate', broken && 'text-destructive')}>
                      {product?.name ?? 'Товар недоступен'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {exemplar
                        ? `Размер ${sizeLabel(exemplar.size)}`
                        : 'вариант удалён'}{' '}
                      × {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {exemplar ? formatPrice(exemplar.price * item.quantity) : '—'}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Итого</span>
              <span className="text-2xl font-semibold">
                {formatPrice(subtotal)}
              </span>
            </div>
          </div>

          {hasBrokenLines ? (
            <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              В корзине есть недоступные позиции. Уберите их на странице корзины,
              чтобы оформить заказ.
            </p>
          ) : null}

          {isError ? (
            <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              {error?.message ?? 'Не удалось оформить заказ. Попробуйте ещё раз.'}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-4 w-full"
            disabled={!canSubmit}
          >
            <ShoppingBag />
            {isPlacing ? 'Оформляем…' : 'Подтвердить заказ'}
          </Button>
          <Link
            to="/cart"
            className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Вернуться в корзину
          </Link>
        </aside>
      </form>
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
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

function formatPrice(price: PriceInRub): string {
  return `${price.toLocaleString('ru-RU')} ₽`
}
