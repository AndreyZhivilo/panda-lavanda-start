/**
 * Client-safe barrel for `@panda-lavanda/infrastructure`.
 *
 * The main barrel (`./src/index.ts`) re-exports the Drizzle repository, which
 * transitively pulls in `@panda-lavanda/db` → `postgres` (postgres-js) → Node's
 * `Buffer`. Importing that barrel from the browser therefore throws
 * `ReferenceError: Buffer is not defined`.
 *
 * This subpath (`@panda-lavanda/infrastructure/client`) re-exports **only** the
 * modules with no Node-only dependencies, so it is safe to import from the
 * client bundle. Client code (the web app's `index.client.ts` composition root)
 * must import from here, never from the main barrel.
 *
 * When adding a new infrastructure module, place it in this barrel only if it
 * has no Node-only imports (no `node:*`, no `@panda-lavanda/db`, no Drizzle).
 * Server-only modules belong in `index.ts` only.
 */
export * from './api/crash-reporter.service'
export * from './storage/local-storage.repository'
export * from './storage/local-storage-user.repository'
