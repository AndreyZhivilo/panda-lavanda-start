/**
 * Generic, reusable pagination container shared across the whole monorepo.
 *
 * Lives in `shared` (not `domain`) because `Paginated<T>` carries no
 * business meaning: it doesn't know about plants, products, orders or any
 * domain concept — it's a structural shape for "a page of items plus the
 * total match count". It applies equally to `Paginated<IProduct>`,
 * `Paginated<ICategory>`, `Paginated<IUser>`, etc.
 *
 * Sits next to `branded.ts` (which holds the same category of non-business
 * reusable types: `UniqueId`, `ImageUrl`, `PriceInRub`).
 */
export interface Paginated<T> {
  items: T[]
  total: number
}
