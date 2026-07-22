import type { ICrashReporterService, IUser, IUserRepository } from '@panda-lavanda/domain'
import type { UniqueId } from '@panda-lavanda/shared'
import { z } from 'zod'

import {
  LocalStorageRepository,
  nonEmptyString,
} from './local-storage.repository'

/** Zod schema for the serialized {@link IUser} document. */
const userSchema = z.object({
  id: nonEmptyString,
  favoriteProductIds: z.array(nonEmptyString),
})

/**
 * LocalStorage-backed implementation of {@link IUserRepository}.
 *
 * Persists a single {@link IUser} document (JSON `{ id, favoriteProductIds }`)
 * under the configured key. This is the client-side adapter for anonymous
 * favorites; swapping to a server-backed implementation later means a new
 * adapter implementing the same port plus one line at the (client)
 * composition root — callers in application/web stay unchanged.
 *
 * Inherits read/write/validate/window-guard from {@link LocalStorageRepository};
 * this class only declares the Zod schema and the seed value, so future
 * LocalStorage-backed repos (cart, etc.) can mirror this shape.
 *
 * Browser-only: relies on the global `localStorage` Web API. Must only be
 * instantiated from client code (the web app's `index.client.ts` composition
 * root).
 *
 * @param userId Identity used when seeding a new user. The web app currently
 *   has no auth, so the composition root passes a single shared anonymous id;
 *   a future authenticated implementation will own this differently.
 * @param crashReporter Optional sink for parse/validation errors. When the
 *   stored entry is corrupt, it is logged here and a fresh empty user is
 *   seeded so the user is never permanently blocked.
 */
export class LocalStorageUserRepository
  extends LocalStorageRepository<IUser>
  implements IUserRepository {
  constructor(
    storageKey: string,
    private readonly userId: UniqueId,
    private readonly crashReporter?: ICrashReporterService,
  ) {
    super({ storageKey })
  }

  protected readonly schema = userSchema

  protected defaultValue(): IUser {
    return { id: this.userId, favoriteProductIds: [] }
  }

  async getCurrent(): Promise<IUser> {
    return this.readOrSeed(this.crashReporter)
  }

  async toggleFavoriteProduct(productId: UniqueId): Promise<IUser> {
    const current = await this.getCurrent()
    const favoriteProductIds = current.favoriteProductIds.includes(productId)
      ? current.favoriteProductIds.filter((id) => id !== productId)
      : [...current.favoriteProductIds, productId]
    const updated: IUser = { id: current.id, favoriteProductIds }
    this.write(updated)
    return updated
  }
}
