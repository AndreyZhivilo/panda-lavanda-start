import type { INotificationService } from '@panda-lavanda/domain'
import { toast } from 'sonner'

/**
 * `sonner`-backed implementation of {@link INotificationService}.
 *
 * `sonner` is a client-only toast library (it renders into the DOM), so this
 * adapter is **client-only** and is exported solely from the `./client`
 * subpath of `@panda-lavanda/infrastructure`, never from the main barrel. It is
 * instantiated in the web app's client composition root and injected into the
 * `CreateOrderUseCase`, which decides *when* to call it — mirroring how
 * {@link CrashReporterService} is wired into use cases.
 *
 * The methods are thin wrappers over `sonner`'s `toast` API. `toast` never
 * throws on display failure, so these satisfy the port's fire-and-forget
 * contract directly.
 */
export class SonnerNotificationService implements INotificationService {
  success(message: string): void {
    toast.success(message)
  }

  error(message: string): void {
    toast.error(message)
  }

  info(message: string): void {
    toast.info(message)
  }
}
