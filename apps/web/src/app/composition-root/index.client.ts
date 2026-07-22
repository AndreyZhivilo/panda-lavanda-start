import type { IUserRepository } from '@panda-lavanda/domain'
import { CrashReporterService, LocalStorageUserRepository } from '@panda-lavanda/infrastructure/index.client.ts'

/**
 * Client-only composition root.
 *
 * Imports from the **client subpath** of `@panda-lavanda/infrastructure`
 * (`.../client`), never from its main barrel. The main barrel re-exports the
 * Drizzle repository, which transitively pulls in `@panda-lavanda/db` →
 * `postgres` (postgres-js) → Node's `Buffer`; importing it from the browser
 * throws `ReferenceError: Buffer is not defined` and unmounts the React tree.
 * The `./client` barrel re-exports only the client-safe modules (crash
 * reporter + LocalStorage-backed repositories) and cannot reach the server
 * graph, so this is a structural guarantee — not just a naming convention.
 *
 * The sibling {@link ./index.ts} wires server infrastructure (Drizzle repos,
 * postgres-js, `fs`-backed file storage) and is imported only from server code
 * (`.server.ts` files and `createServerFn` handlers). This file is the only
 * place that instantiates client-side infrastructure.
 *
 * `CrashReporterService` is used here purely as a `console.error` sink — it
 * has no Node-only dependencies, so it is safe to reuse on the client for
 * surfacing LocalStorage parse errors during development.
 */
const crashReporter = new CrashReporterService()

export const userRepository: IUserRepository = new LocalStorageUserRepository(
  'panda-lavanda:user',
  // Placeholder until real authentication exists; a single anonymous user is
  // shared across the app. Replace with the authenticated user's id once a
  // session is available.
  'anonymous',
  crashReporter,
)
