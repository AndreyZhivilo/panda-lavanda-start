import type { PriceInRub, UniqueId } from '@panda-lavanda/shared'

import type { Size } from '../products'

/**
 * The shopper's preferred contact method after an order is placed.
 *
 * Implemented as a const object + union type rather than a `const enum`,
 * because `const enum` is incompatible with `isolatedModules` /
 * `verbatimModuleSyntax` (enabled in our tsconfig) when modules are transpiled
 * in isolation. Usage stays ergonomic: `ContactMethod.TELEGRAM`.
 *
 * The string values are kept in sync with the `contact_method` `pgEnum` in
 * `apps/api/src/schema/orders.ts`.
 */
export const ContactMethod = {
  /** Phone call. */
  CALL: 'call',
  /** Telegram message. */
  TELEGRAM: 'telegram',
  /** WhatsApp message. */
  WHATSAPP: 'whatsapp',
  /** MAX messenger message. */
  MAX: 'max',
  /** VKontakte message. */
  VKONTAKTE: 'vkontakte',
} as const

/** Contact method value — one of the `ContactMethod` const keys. */
export type ContactMethod = (typeof ContactMethod)[keyof typeof ContactMethod]

/**
 * Lifecycle state of an order.
 *
 * Implemented as a const object + union type rather than a `const enum`
 * (see {@link ContactMethod}). The string values are kept in sync with the
 * `order_status` `pgEnum` in `apps/api/src/schema/orders.ts`.
 *
 * New orders start at {@link OrderStatus.NEW}; the rest model a future
 * admin/processing flow and are not yet set by the storefront.
 */
export const OrderStatus = {
  /** Just placed, not yet processed. The default for newly created orders. */
  NEW: 'new',
  /** Being handled by the shop. */
  PROCESSING: 'processing',
  /** Fulfilled / delivered. */
  COMPLETED: 'completed',
  /** Cancelled by the shop or the shopper. */
  CANCELLED: 'cancelled',
} as const

/** Order status value — one of the `OrderStatus` const keys. */
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

/**
 * A single line in a placed order.
 *
 * This is a **denormalized snapshot** taken at checkout time: `productName`,
 * `size` and `unitPrice` are copied from the catalog when the order is placed,
 * so changing or deleting a product later never alters a past order's contents
 * or totals. `exemplarId` / `productId` are kept as soft references (no DB
 * foreign key) for traceability and future admin tooling, but a missing
 * catalog row must never break the order's integrity.
 */
export interface IOrderItem {
  id: UniqueId
  /** The exemplar the line was built from (soft reference — no FK). */
  exemplarId: UniqueId
  /** The product the exemplar belongs to (soft reference — no FK). */
  productId: UniqueId
  /** Product name copied at checkout. */
  productName: string
  /** Exemplar size copied at checkout. */
  size: Size
  /** Unit price copied at checkout (rubles). */
  unitPrice: PriceInRub
  /** How many units of this exemplar were ordered (positive integer). */
  quantity: number
}

/**
 * A customer's order.
 *
 * Anonymous for now (no authentication exists yet — see {@link ICart}), so the
 * shopper is identified only by the contact details they entered at checkout.
 * `createdAt` is an ISO timestamp string (JSON-serializable for HTTP/Drizzle
 * interop, mirroring how the rest of the domain surfaces timestamps).
 */
export interface IOrder {
  id: UniqueId
  customerName: string
  phone: string
  contactMethod: ContactMethod
  /** Optional free-form note from the shopper (delivery wishes, call time…). */
  comment?: string
  /** Grand total of all lines, in rubles. Snapshot — see {@link IOrderItem}. */
  totalPrice: PriceInRub
  status: OrderStatus
  items: IOrderItem[]
  /** ISO timestamp of when the order was created. */
  createdAt: string
}

/**
 * Grand total of an order — the sum of every line's `unitPrice * quantity`.
 *
 * Pure function over the {@link IOrder} value — no I/O, no framework deps. Lives
 * in the domain layer so the rule has a single, testable definition; the
 * storefront recomputes it for display, and the backend can re-verify the value
 * a client sent at checkout.
 */
export function orderTotal(order: IOrder): PriceInRub {
  return order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
}

/**
 * Human-readable label for a {@link ContactMethod} value.
 *
 * Pure function over the {@link ContactMethod} value. Lives in the domain layer
 * so the label has a single, consistent definition shared by the checkout form
 * and any future order-management UI.
 */
export function contactMethodLabel(method: ContactMethod): string {
  switch (method) {
    case ContactMethod.CALL:
      return 'Позвонить'
    case ContactMethod.TELEGRAM:
      return 'Написать в Telegram'
    case ContactMethod.WHATSAPP:
      return 'Написать в WhatsApp'
    case ContactMethod.MAX:
      return 'Написать в MAX'
    case ContactMethod.VKONTAKTE:
      return 'Написать во ВКонтакте'
    default:
      return method
  }
}
