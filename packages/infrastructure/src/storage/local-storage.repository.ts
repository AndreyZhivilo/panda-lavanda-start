import type { ZodType } from 'zod'
import { z } from 'zod'

/** Configuration injected at the composition root. */
export interface LocalStorageRepositoryConfig {
  /** LocalStorage key the document is stored under. */
  storageKey: string
}

/**
 * Thrown when a LocalStorage-backed repository is used outside the browser.
 *
 * The repository should only be instantiated from client code (the web app's
 * `index.client.ts` composition root). This guard turns an opaque
 * `ReferenceError: localStorage is not defined` on the server into a clear,
 * typed error pointing at the wiring mistake.
 */
export class LocalStorageUnavailableError extends Error {
  constructor(storageKey: string, cause?: unknown) {
    super(
      `localStorage is not available (tried key "${storageKey}"). ` +
        'LocalStorageRepository subclasses must only be used in the browser — ' +
        'instantiate them from the client composition root (index.client.ts).',
    )
    this.name = 'LocalStorageUnavailableError'
    if (cause !== undefined) this.cause = cause
  }
}

/**
 * Thrown when a stored value cannot be parsed as JSON or does not match the
 * subclass's Zod schema. Lets the use case distinguish "corrupt data" from
 * "missing data" (missing → seed; corrupt → log + seed).
 */
export class LocalStorageParseError extends Error {
  constructor(
    message: string,
    public readonly storageKey: string,
    public readonly raw: string | null,
    cause?: unknown,
  ) {
    super(message)
    this.name = 'LocalStorageParseError'
    if (cause !== undefined) this.cause = cause
  }
}

/**
 * Base class for LocalStorage-backed repositories.
 *
 * Owns the parts of LocalStorage access that are identical across features —
 * the window guard, JSON parse/stringify, and schema validation — so concrete
 * repositories (user, future cart, etc.) only declare their Zod schema and
 * default value. Subclasses get `read()` / `write()` / `readOrSeed()` for
 * free.
 *
 * Template method: the base orchestrates I/O + validation; the subclass owns
 * the data shape (`schema`) and the seed (`defaultValue()`).
 *
 * Browser-only: relies on the global `localStorage` Web API (typed via the
 * root tsconfig's `lib: ["DOM", "DOM.Iterable"]`). Subclasses must only be
 * instantiated from client code.
 */
export abstract class LocalStorageRepository<T> {
  constructor(protected readonly config: LocalStorageRepositoryConfig) {}

  /** Zod schema describing the stored document. Provided by the subclass. */
  protected abstract readonly schema: ZodType<T>

  /** Value persisted and returned when the key is absent or unreadable. */
  protected abstract defaultValue(): T

  /**
   * Reads, parses, and validates the stored document.
   *
   * - Throws {@link LocalStorageUnavailableError} if `localStorage` is not
   *   reachable (server-side misuse).
   * - Throws {@link LocalStorageParseError} if the stored value is not valid
   *   JSON or fails schema validation. Callers (use cases) catch this and
   *   decide whether to seed or surface the error.
   */
  protected read(): T {
    const raw = this.getRaw()

    if (raw === null) {
      const seeded = this.defaultValue()
      this.write(seeded)
      return seeded
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      throw new LocalStorageParseError(
        `Failed to parse JSON at "${this.config.storageKey}"`,
        this.config.storageKey,
        raw,
        cause,
      )
    }

    const result = this.schema.safeParse(parsed)
    if (!result.success) {
      throw new LocalStorageParseError(
        `Stored value at "${this.config.storageKey}" failed schema validation`,
        this.config.storageKey,
        raw,
        result.error,
      )
    }
    return result.data
  }

  /** Validates and persists the value. Throws if validation fails. */
  protected write(value: T): void {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      // Programming error — the caller passed a value that doesn't match the
      // schema. Don't silently write bad data.
      throw new LocalStorageParseError(
        `Attempted to write an invalid value at "${this.config.storageKey}"`,
        this.config.storageKey,
        null,
        result.error,
      )
    }
    this.setRaw(JSON.stringify(result.data))
  }

  /**
   * Reads the value, seeding on missing data. If parsing/validation fails,
   * logs through the optional crash reporter, re-seeds, and returns the
   * default — so a corrupt entry never permanently blocks the user.
   */
  protected readOrSeed(
    crashReporter?: { report(error: unknown): void },
  ): T {
    try {
      return this.read()
    } catch (error) {
      if (error instanceof LocalStorageUnavailableError) throw error
      crashReporter?.report(error)
      const seeded = this.defaultValue()
      this.write(seeded)
      return seeded
    }
  }

  private getRaw(): string | null {
    if (!isLocalStorageAvailable()) {
      throw new LocalStorageUnavailableError(this.config.storageKey)
    }
    return localStorage.getItem(this.config.storageKey)
  }

  private setRaw(value: string): void {
    if (!isLocalStorageAvailable()) {
      throw new LocalStorageUnavailableError(this.config.storageKey)
    }
    localStorage.setItem(this.config.storageKey, value)
  }
}

/**
 * `localStorage` exists in modern browsers but is `undefined` under SSR (and
 * can be disabled by the user via browser settings — `StorageAccessError` on
 * access). Feature-detect instead of `typeof window` so we catch both cases.
 */
function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null
  } catch {
    // Accessing `localStorage` can itself throw in sandboxed iframes.
    return false
  }
}

/**
 * Convenience: a reusable non-empty string schema. Useful for id-like fields
 * stored in LocalStorage documents (e.g. `IUser.id`).
 */
export const nonEmptyString = z.string().min(1)
