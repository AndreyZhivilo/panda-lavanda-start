/**
 * Composition root for the web app.
 *
 * The only place that wires concrete infrastructure implementations
 * (`@panda-lavanda/infrastructure`, `@panda-lavanda/db`) to the domain ports.
 * Everything else in the app depends on the port types, never on these
 * concrete classes.
 *
 * Importing this module (transitively) pulls in Node-only code (postgres-js),
 * so it must only ever be referenced from server code (e.g. inside a
 * `createServerFn` handler), never from a client component.
 */
export { db } from './db'
export { productsRepository } from './products'
export { fileStorage } from './storage'
