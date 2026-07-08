import type { ICrashReporterService } from '@panda-lavanda/domain'

export class CrashReporterService implements ICrashReporterService {
  report(error: unknown): void {
    console.error(error) // TODO: отправить в Sentry
  }
}
