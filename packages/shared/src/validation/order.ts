import { z } from 'zod'

import { ContactMethod, Size } from '@panda-lavanda/domain'

import { ruPhone } from './phone'

/**
 * Zod schema for the domain {@link ContactMethod} enum.
 *
 * The allowed values are **derived from the domain const-object** rather than
 * redeclared as string literals, so adding a contact method in
 * `packages/domain/src/orders/order.ts` flows through here automatically — no
 * drift between the enum the UI offers, the schema that validates it, and the
 * `pgEnum` the backend stores.
 *
 * The cast narrows `Object.values(...)` (which TS widens to `string[]`) to a
 * tuple of the `ContactMethod` literal-union, so `z.enum` infers the exact
 * literal type and `z.infer<typeof contactMethodSchema>` stays assignable to
 * `ContactMethod` (and thus to the {@link CreateOrderData} DTO).
 */
export const contactMethodSchema = z.enum(
  Object.values(ContactMethod) as [ContactMethod, ...ContactMethod[]],
)

/**
 * Zod schema for the domain {@link Size} enum.
 *
 * Same derive-from-domain rationale as {@link contactMethodSchema}: kept in sync
 * with `packages/domain/src/products/product.ts` and the catalog `sizeEnum`.
 * The tuple cast keeps the inferred value type the literal `Size` union.
 */
export const sizeSchema = z.enum(Object.values(Size) as [Size, ...Size[]])

/**
 * Zod schema for one checkout order line — mirrors the domain
 * {@link CreateOrderItemData} DTO.
 *
 * These are the **snapshot** fields copied from the catalog at checkout time
 * (product name, size, unit price) plus the soft references to the exemplar and
 * product. `quantity` must be a positive integer (the cart invariant).
 */
export const createOrderItemSchema = z.object({
  exemplarId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string().min(1),
  size: sizeSchema,
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
})

/**
 * Zod schema for the checkout payload — mirrors the domain
 * {@link CreateOrderData} DTO and is the **single source of truth** shared by
 * every boundary that validates an order:
 *
 * - the checkout form (live per-field feedback, via {@link ruPhone} directly),
 * - the `createOrder` server function (`.validator(...)` authoritative check),
 * - the API `POST /orders` route (`.parse(request.body)`).
 *
 * Reusing one schema means the phone rule, the contact-method enum and the
 * item shape cannot drift across these three layers. `phone` is validated with
 * {@link ruPhone}; `items` must be non-empty.
 */
export const createOrderDataSchema = z.object({
  customerName: z.string().min(1),
  phone: ruPhone,
  contactMethod: contactMethodSchema,
  comment: z.string().optional(),
  totalPrice: z.number().int().nonnegative(),
  items: z.array(createOrderItemSchema).min(1),
})

/** Inferred input type of {@link createOrderDataSchema}. */
export type CreateOrderInput = z.infer<typeof createOrderDataSchema>
