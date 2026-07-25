import { createFileRoute } from '@tanstack/react-router'

import { getProduct } from '#/app/server-functions'
import { ProductPage } from '#/presentation/pages/product-page'

/**
 * Single-product route (`/products/:productId`).
 *
 * The product (with its exemplars) is loaded on the server via the
 * {@link getProduct} server function, mirroring how `/catalog` loads its page.
 * The loader's return value flows into `useLoaderData({ from: ... })` on
 * `ProductPage`.
 *
 * `noindex` mirrors the favorites route: this is a detail page whose SEO story
 * is not finalized yet, so we keep it out of the index for now.
 */
export const Route = createFileRoute('/products/$productId')({
  component: ProductPage,
  loader: ({ params }) =>
    getProduct({ data: { id: params.productId } }),
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})
