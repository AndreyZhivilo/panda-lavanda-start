import { createFileRoute } from '@tanstack/react-router'

import { CheckoutPage } from '#/presentation/pages/checkout-page'

/**
 * Checkout route — SPA-only.
 *
 * Same rationale as {@link /cart}: the cart (and thus the checkout data) is a
 * per-browser LocalStorage concern, so there is nothing useful to render
 * server-side. `ssr: false` keeps the page out of the server bundle and the
 * `noindex, nofollow` directive prevents the checkout URL from being indexed.
 */
export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
  ssr: false,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})
