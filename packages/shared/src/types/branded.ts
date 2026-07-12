/**
 * Generic, reusable primitive types shared across the whole monorepo.
 *
 * These are intentionally plain `type` aliases (not nominal/branded types) so
 * that they stay JSON-serializable and interoperate with Drizzle, API payloads
 * and storage without conversion. If stricter nominal typing is ever needed,
 * swap these for brand wrappers (e.g. `UniqueId = string & { __brand: 'UniqueId' }`).
 */

/** Unique identifier (UUID string). */
export type UniqueId = string

/** URL pointing to an image (product photo, avatar, etc.). */
export type ImageUrl = string

/** Monetary price expressed in Russian rubles. */
export type PriceInRub = number
