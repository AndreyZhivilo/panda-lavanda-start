import { createFileRoute } from '@tanstack/react-router'

import { getCategories } from '#/app/server-functions'
import { HomePage } from '#/presentation/pages/home-page'

/**
 * Homepage route (`/`).
 *
 * The categories list is loaded on the server via the {@link getCategories}
 * server function and flows into `useLoaderData({ from: '/' })` on `HomePage`,
 * mirroring how `/catalog` loads its product page. The loader's return value
 * is a plain discriminated union (`{ ok, categories } | { ok, message }`) —
 * see `home-page.tsx` → `HomeLoaderData`.
 */
export const Route = createFileRoute('/')({
  component: HomePage,
  loader: () => getCategories(),
})
