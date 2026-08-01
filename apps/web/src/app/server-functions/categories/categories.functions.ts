import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  getCategoriesUseCase,
  getCategoryBySlugUseCase,
} from '#/app/composition-root'

/**
 * Loads the full list of categories on the server.
 *
 * The use case returns `Either<Error, ICategory[]>`; we fold it here into a
 * plain discriminated union because `Either` (a class with methods) and
 * `Error` don't survive TanStack Start's server→client serialization. The
 * route/loader/UI then work with this plain shape
 * (see `home-page.tsx` → `HomeLoaderData`).
 *
 * As a `.functions.ts` file, this export is safe to import statically from
 * anywhere (routes, components) — TanStack Start's compiler replaces the call
 * with an RPC fetch in the client bundle; only the server keeps the real
 * handler body.
 */
export const getCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await getCategoriesUseCase.execute()

  if (result.isRight()) {
    return { ok: true as const, categories: result.value }
  }

  const err = result.value
  return {
    ok: false as const,
    message: err.message,
  }
})

/**
 * Input shape callers pass into {@link getCategory}: the category slug from the
 * route param (`/categories/$categorySlug`).
 */
const getCategoryInputSchema = z.object({
  slug: z.string().min(1),
})

/**
 * Loads a single category on the server, by slug.
 *
 * Same Either→discriminated-union fold as {@link getCategories}: the use case
 * returns `Either<Error, ICategory | null>` (the repository maps a 404 to
 * `null`), so the success branch carries `category: ICategory | null`. The
 * page treats `null` as a "not found" case distinct from an error.
 */
export const getCategory = createServerFn({ method: 'GET' })
  .validator(getCategoryInputSchema)
  .handler(async ({ data }) => {
    const result = await getCategoryBySlugUseCase.execute(data.slug)

    if (result.isRight()) {
      return { ok: true as const, category: result.value }
    }

    const err = result.value
    return {
      ok: false as const,
      message: err.message,
    }
  })
