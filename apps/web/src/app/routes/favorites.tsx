import { createFileRoute } from '@tanstack/react-router'

import { FavoritesPage } from '#/presentation/pages/favorites-page'

/**
 * Favorites route — SPA-only.
 *
 * `ssr: false` makes TanStack Start skip server rendering for this route: the
 * server returns no HTML body for `/favorites`, so the page is never seen by
 * crawlers. The `noindex, nofollow` robots directive is belt-and-suspenders,
 * guarding against any links being indexed even without a renderable body.
 *
 * Favorites are a per-browser concern (LocalStorage, no auth yet), so there's
 * nothing useful to render server-side anyway.
 */
export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
  ssr: false,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})
