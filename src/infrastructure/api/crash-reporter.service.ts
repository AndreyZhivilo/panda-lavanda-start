import type { ICrashReporterService } from '@domain/ports/crash-reporter.port'

export class CrashReporterService implements ICrashReporterService {
  report(error: unknown): void {
    console.error(error) // TODO: отправить в Sentry
  }
}
