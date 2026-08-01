/**
 * User-facing notification contract (toasts, banners, …).
 *
 * A side-effect port, modelled on {@link ICrashReporterService}: the interface
 * lives in the domain layer and is injected into a use case, which decides
 * *when* to surface a notification (just as a use case decides when to report
 * a crash). Concrete implementations live in the infrastructure layer (e.g. a
 * `sonner`-backed adapter on the client) and are injected at the composition
 * root. This keeps the application layer independent of any UI library.
 *
 * All methods are synchronous best-effort fire-and-forget: they enqueue a
 * notification and return immediately, never throwing on display failure.
 */
export interface INotificationService {
  /** Surfaces a success notification. */
  success(message: string): void
  /** Surfaces an error notification. */
  error(message: string): void
  /** Surfaces an informational notification. */
  info(message: string): void
}
