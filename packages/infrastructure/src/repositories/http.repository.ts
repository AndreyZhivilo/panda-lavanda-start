import {
  NetworkError,
  NotFoundError,
  ValidationError,
} from '@panda-lavanda/domain'

/** Configuration injected at the composition root. */
export interface HttpRepositoryConfig {
  /**
   * The backend API origin, e.g. `http://localhost:4000`. No trailing slash.
   * Each request is sent to `${baseUrl}${path}`.
   */
  baseUrl: string
}

/** Request options understood by {@link HttpRepository.request}. */
export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** JSON-serializable request body (sent with `Content-Type: application/json`). */
  body?: unknown
}

/**
 * Base class for HTTP-backed repositories.
 *
 * Owns the parts of backend access that are identical across features — the
 * `fetch` call, JSON serialization, status-code → `AppError` mapping — so
 * concrete repositories (products, future cart, orders, …) only declare the
 * endpoints they hit and how to shape the response. Subclasses get
 * {@link request} / {@link get} / {@link post} / {@link patch} / {@link del}
 * for free.
 *
 * Template method: the base orchestrates transport + error translation; the
 * subclass owns the URL paths and the response shape.
 *
 * Uses only the platform `fetch` — no `node:*` imports, no Drizzle, no
 * `@panda-lavanda/db` — so it is **client-safe** and may be imported from both
 * the server and the browser bundle.
 *
 * ## Error contract
 *
 * Failures are thrown as {@link AppError} subclasses (not `Either`): the use
 * case layer wraps calls with `tryCatch` and converts a thrown error into
 * `Either.Left`, preserving the typed error via `cause`.
 *
 * - Network/parse failure, 5xx → {@link NetworkError}
 * - `404` → {@link NotFoundError}
 * - Other `4xx` → {@link ValidationError}
 *
 * `404` is special-cased because some ports (`getById`, `update`) treat it as
 * a legitimate "not found" result and map it to `null` themselves; for those,
 * call {@link request} directly and inspect `response.status === 404` before
 * parsing the body.
 */
export abstract class HttpRepository {
  protected readonly baseUrl: string

  constructor(config: HttpRepositoryConfig) {
    this.baseUrl = config.baseUrl
  }

  /**
   * Performs a `fetch` against the backend and translates failures into typed
   * {@link AppError} subclasses. Returns the raw `Response` so the caller can
   * decide how to parse the body (and how to treat `404`).
   *
   * - Resolves with the `Response` on any 2xx.
   * - Throws {@link NetworkError} on a fetch rejection (DNS, refused
   *   connection, timeout) and on any non-2xx status other than the 404 /
   *     4xx cases below.
   * - Throws {@link NotFoundError} on `404`.
   * - Throws {@link ValidationError} on other `4xx` responses.
   */
  protected async request(
    path: string,
    options: HttpRequestOptions,
  ): Promise<Response> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers:
          options.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      })
    } catch (error) {
      // `fetch` throws on network failure (DNS, refused connection, timeout).
      throw new NetworkError(
        `Failed to reach backend at ${this.baseUrl}${path}`,
        error,
      )
    }

    if (response.ok) return response

    if (response.status === 404) {
      throw new NotFoundError(
        `Backend returned 404 for ${options.method} ${path}`,
      )
    }

    if (response.status >= 400 && response.status < 500) {
      throw new ValidationError(
        `Backend rejected request (${response.status}) for ${options.method} ${path}`,
      )
    }

    // 5xx and anything else.
    throw new NetworkError(
      `Backend error (${response.status}) for ${options.method} ${path}`,
    )
  }

  /** Convenience GET — returns the parsed JSON body as `T`. */
  protected async get<T>(path: string): Promise<T> {
    const response = await this.request(path, { method: 'GET' })
    return (await response.json()) as T
  }

  /** Convenience POST — sends `body`, returns the parsed JSON body as `T`. */
  protected async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, { method: 'POST', body })
    return (await response.json()) as T
  }

  /** Convenience PATCH — sends `body`, returns the parsed JSON body as `T`. */
  protected async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, { method: 'PATCH', body })
    return (await response.json()) as T
  }

  /** Convenience DELETE — returns nothing on success. */
  protected async del(path: string): Promise<void> {
    await this.request(path, { method: 'DELETE' })
  }
}
