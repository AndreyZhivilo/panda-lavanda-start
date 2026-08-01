import type { Either } from '@sweet-monads/either'

import type {
  ICartRepository,
  ICrashReporterService,
  INotificationService,
  IOrder,
  IOrdersRepository,
} from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'

import type { CreateOrderData } from '@panda-lavanda/domain'

/**
 * Places an order from the current cart.
 *
 * Unlike the thin read/write use cases elsewhere in this layer, this one
 * **orchestrates** the checkout side-effects: it persists the order, then —
 * only after a successful persist — clears the cart and surfaces a success
 * notification. Owning that sequence here (rather than in a page component)
 * keeps the business rule "a placed order empties the cart and tells the user"
 * in a single, testable place, exactly the way error reporting is owned by the
 * use cases that take an {@link ICrashReporterService}.
 *
 * The notification and cart ports are side-effect services injected at the
 * composition root; on the client they are backed by `sonner` and the
 * LocalStorage cart respectively. The repository is the order-persistence
 * port (an RPC adapter calling the server function on the client).
 *
 * ## Error handling
 *
 * The persist is the primary effect and is wrapped by {@link tryCatch}: a
 * failure there is returned as `Either.Left` and **none** of the secondary
 * effects run (the cart is not cleared, no notification is shown). The
 * secondary effects (clear cart, notify) are deliberately swallowed if they
 * throw — the order is already saved, so failing to clear LocalStorage or to
 * show a toast must not surface as a failed checkout. Their errors are routed
 * to the {@link ICrashReporterService} for observability instead.
 *
 * The redirect to the home page is intentionally **not** done here: navigation
 * is a presentation/router concern, so the calling page performs it after a
 * successful `Either.Right`.
 */
export class CreateOrderUseCase {
  constructor(
    private readonly orders: IOrdersRepository,
    private readonly cart: ICartRepository,
    private readonly notifications: INotificationService,
    private readonly crashReporter?: ICrashReporterService,
  ) {}

  execute(data: CreateOrderData): Promise<Either<Error, IOrder>> {
    return tryCatch(async () => {
      // Primary effect: persist the order. A throw here propagates to
      // `tryCatch` and becomes `Either.Left` — the secondary effects below
      // never run.
      const order = await this.orders.create(data)

      // Secondary effects: must not fail the checkout once the order exists.
      // Cart clearing is awaited (it is part of the contract) but its failure
      // is logged, not thrown; the notification is fire-and-forget by design.
      try {
        await this.cart.clear()
      } catch (error) {
        this.crashReporter?.report(error)
      }
      this.notifications.success('Заказ оформлен! Мы свяжемся с вами в ближайшее время.')

      return order
    }, this.crashReporter)
  }
}
