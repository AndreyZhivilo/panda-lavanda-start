export interface ICrashReporterService {
  report(error: unknown): void
}
