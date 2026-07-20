/**
 * Sort keys for product lists.
 *
 * Implemented as a const object + union type rather than a `const enum`,
 * because `const enum` is incompatible with `isolatedModules` /
 * `verbatimModuleSyntax` (enabled in our tsconfig) when modules are
 * transpiled in isolation. Usage stays ergonomic: `SortOrder.OUT_OF_STOCK_LAST`.
 *
 * New keys can be added here without changing `IProductFilters` (which takes
 * `SortOrder[]`), so the contract is forward-compatible with future sort
 * options (by price, name, popularity, …).
 */
export const SortOrder = {
  /** Products with no exemplar in stock sink to the end of the list. */
  OUT_OF_STOCK_LAST: 'out-of-stock-last',
} as const

/** Sort key — one of the `SortOrder` const keys. */
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]
