import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from 'sonner'

import appCss from '../styles.css?url'

/**
 * Single shared {@link QueryClient} for the whole app.
 *
 * Instantiated once at module scope so the same cache survives navigations
 * and is shared between route loaders and components. Client-only favorites
 * state (the current user) lives in this cache; mutations invalidate the
 * `['user']` key so every heart icon on the page re-renders automatically.
 *
 * Favorites is intentionally a client-only concern (LocalStorage), so we do
 * not wire SSR dehydration here — the cache starts empty on the server and is
 * populated after hydration.
 */
const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Panda Lavanda' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        {/* Toast host. Mounted once at the root so notifications survive
            navigation (e.g. the success toast shown by `CreateOrderUseCase`
            right before the checkout page redirects to `/`). Driven by
            `SonnerNotificationService` on the client. */}
        <Toaster position="top-center" richColors />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
