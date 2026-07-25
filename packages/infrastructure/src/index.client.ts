/**
 * Client-safe barrel for `@panda-lavanda/infrastructure`.
 *
 * The main barrel (`./src/index.ts`) re-exports `LocalFileStorageService`,
 * which imports Node-only modules (`node:crypto`, `node:fs/promises`,
 * `node:path`). Importing that barrel from the browser pulls those modules
 * into the client bundle and fails.
 *
 * This subpath (`@panda-lavanda/infrastructure/client`) re-exports **only** the
 * modules with no Node-only dependencies, so it is safe to import from the
 * client bundle. Client code (the web app's `index.client.ts` composition root)
 * must import from here, never from the main barrel.
 *
 * `HttpProductsRepository` is client-safe: it uses only the platform `fetch`,
 * no Node imports, no Drizzle, so it is exported from both barrels.
 *
 * When adding a new infrastructure module, place it in this barrel only if it
 * has no Node-only imports (no `node:*`, no Drizzle, no postgres driver).
 * Server-only modules belong in `index.ts` only.
 */
export * from './api/crash-reporter.service'
export * from './repositories/http.repository'
export * from './repositories/http-products.repository'
export * from './storage/local-storage.repository'
export * from './storage/local-storage-user.repository'
