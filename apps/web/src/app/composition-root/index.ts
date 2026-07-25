/**
 * Composition root for the web app.
 *
 * The only place that wires concrete infrastructure implementations
 * (`@panda-lavanda/infrastructure`) to the domain ports. Everything else in
 * the app depends on the port types, never on these concrete classes.
 *
 * The products repository is HTTP-backed (`HttpProductsRepository`), so
 * importing this module no longer pulls in a database driver. The Node-only
 * import here is `LocalFileStorageService` (`node:fs/promises`, etc.) in
 * `storage.ts`, so this module must still only be referenced from server code
 * (e.g. inside a `createServerFn` handler), never from a client component.
 */
export {
  getProductByIdUseCase,
  getProductsUseCase,
  productsRepository,
} from './products'
export { fileStorage } from './storage'
