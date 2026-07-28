import cyrillicToTranslit from 'cyrillic-to-translit-js'

// `ru` preset covers the catalog's Cyrillic (Russian) product names.
const translit = cyrillicToTranslit({ preset: 'ru' })

/**
 * Builds a URL-friendly slug from a (possibly Cyrillic) product name.
 *
 * Steps:
 * 1. Transliterate Cyrillic → Latin (spaces become the given separator `-`).
 * 2. Lowercase.
 * 3. Drop anything that is not `a-z0-9-` (guillemets `«»`, quotes, punctuation).
 * 4. Collapse runs of `-` and trim leading/trailing `-`.
 *
 * Example: `'Лаванда узколистная «Hidcote»'` → `'lavanda-uzkololistnaya-hidcote'`.
 *
 * Returns an empty string if the name transliterates to nothing usable; the
 * repository is responsible for guaranteeing uniqueness and rejecting empty
 * slugs before insert (the `products.slug` column is `NOT NULL UNIQUE`).
 */
export function toSlug(name: string): string {
  return translit
    .transform(name, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}
