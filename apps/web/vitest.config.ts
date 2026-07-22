import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * The test runner lives in the web workspace (`npm run test` →
 * `vitest run`), but the project root is the monorepo root so unit tests in
 * any `packages/*` package are discovered. Workspace packages resolve via the
 * npm symlinks (same as at runtime).
 *
 * `environment: 'jsdom'` is set globally so future hook/component tests have
 * `document`/`window` available; pure-domain tests don't use it but are
 * unaffected.
 */
export default defineConfig({
  root: '../..',
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
