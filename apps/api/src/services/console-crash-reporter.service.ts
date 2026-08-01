import type { ICrashReporterService } from '@panda-lavanda/domain'

/**
 * Local `console.error` sink for {@link ICrashReporterService}.
 *
 * Mirrors `packages/infrastructure/src/api/crash-reporter.service.ts` on purpose:
 * by architecture rule `apps/api` is a thin adapter that imports the domain **as
 * types only** and owns its own small adapters (it does not import
 * `packages/infrastructure` — that's where the client-side adapters live). This
 * is the backend's concrete crash reporter, just as `apps/api/src/storage/...`
 * is its concrete file storage and `apps/api/src/repositories/*` are its
 * concrete repositories.
 *
 * Today it only writes to `console.error`. When Sentry is wired in, the only
 * change is the body of {@link report} — the port and every consumer stay
 * untouched (swap the adapter here, or pass the real reporter through a new
 * Fastify decorator / env-based factory).
 */
export class ConsoleCrashReporterService implements ICrashReporterService {
  report(error: unknown): void {
    // TODO: отправить в Sentry
    console.error(error)
  }
}
