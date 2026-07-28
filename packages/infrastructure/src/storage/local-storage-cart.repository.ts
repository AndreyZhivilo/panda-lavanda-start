import type {
  ICart,
  ICartItem,
  ICartRepository,
  ICrashReporterService,
} from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import { z } from 'zod'

import {
  LocalStorageRepository,
  nonEmptyString,
} from './local-storage.repository'

/** Zod schema for a serialized {@link ICartItem} line. */
const cartItemSchema = z.object({
  exemplarId: nonEmptyString,
  productId: nonEmptyString,
  quantity: z.number().int().positive(),
})

/** Zod schema for the serialized {@link ICart} document. */
const cartSchema = z.object({
  items: z.array(cartItemSchema),
})

/**
 * LocalStorage-backed implementation of {@link ICartRepository}.
 *
 * Persists a single {@link ICart} document (JSON `{ items: [...] }`) under the
 * configured key. This is the client-side adapter for an anonymous cart;
 * swapping to a server-backed implementation later means a new adapter
 * implementing the same port plus one line at the (client) composition root —
 * callers in application/web stay unchanged.
 *
 * Inherits read/write/validate/window-guard from {@link LocalStorageRepository};
 * this class only declares the Zod schema and the seed value, mirroring
 * {@link LocalStorageUserRepository}.
 *
 * Browser-only: relies on the global `localStorage` Web API. Must only be
 * instantiated from client code (the web app's `index.client.ts` composition
 * root).
 *
 * @param crashReporter Optional sink for parse/validation errors. When the
 *   stored entry is corrupt, it is logged here and a fresh empty cart is seeded
 *   so the shopper is never permanently blocked.
 */
export class LocalStorageCartRepository
  extends LocalStorageRepository<ICart>
  implements ICartRepository {
  constructor(
    storageKey: string,
    private readonly crashReporter?: ICrashReporterService,
  ) {
    super({ storageKey })
  }

  protected readonly schema = cartSchema

  protected defaultValue(): ICart {
    return { items: [] }
  }

  async get(): Promise<ICart> {
    return this.readOrSeed(this.crashReporter)
  }

  async addItem(item: ICartItem): Promise<ICart> {
    const current = await this.get()
    const existing = current.items.find((i) => i.exemplarId === item.exemplarId)
    const items = existing
      ? current.items.map((i) =>
          i.exemplarId === item.exemplarId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        )
      : [...current.items, item]
    const updated: ICart = { items }
    this.write(updated)
    return updated
  }

  async removeItem(exemplarId: UniqueId): Promise<ICart> {
    const current = await this.get()
    // Idempotent: filtering a missing id leaves the list unchanged.
    const items = current.items.filter((i) => i.exemplarId !== exemplarId)
    const updated: ICart = { items }
    this.write(updated)
    return updated
  }

  async setQuantity(exemplarId: UniqueId, quantity: number): Promise<ICart> {
    if (quantity <= 0) return this.removeItem(exemplarId)
    const current = await this.get()
    const items = current.items.map((i) =>
      i.exemplarId === exemplarId ? { ...i, quantity } : i,
    )
    const updated: ICart = { items }
    this.write(updated)
    return updated
  }

  async clear(): Promise<ICart> {
    const updated: ICart = { items: [] }
    this.write(updated)
    return updated
  }
}
