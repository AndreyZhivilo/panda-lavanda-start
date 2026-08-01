import type { IOrder } from '../orders'

/**
 * Backend notification contract.
 *
 * A side-effect port, distinct from {@link INotificationService}: that port is a
 * synchronous, user-facing toast channel wired into storefront use cases, whereas
 * this one is an **async** backend channel that informs a shop admin (e.g. over
 * Telegram) about noteworthy domain events. Splitting the two keeps each contract
 * honest about its semantics — one is "show the shopper a message", the other is
 * "deliver a structured notification off-process".
 *
 * The interface is intentionally **event-oriented and extensible**: each kind of
 * notification is its own method (`notifyOrderCreated`, and future ones such as
 * low-stock or order-status-change) rather than a single overloaded `notify(...)`.
 * That keeps every event typed and discoverable, and lets the implementation
 * format each one differently.
 *
 * The interface lives in the domain layer; concrete implementations live next to
 * the backend that emits the event (e.g. a Telegram Bot API adapter in `apps/api`)
 * and are injected at the composition root. This keeps the domain independent of
 * any messaging provider — swapping to email or a different messenger later is a
 * single new adapter plus one line at the composition root.
 *
 * Implementations must be **best-effort from the caller's perspective**: a
 * notification failure (network error, blocked chat, rate limit) must never
 * surface as a failed business operation. Callers wrap the call in a swallowed
 * try/catch and route failures to the crash reporter, exactly as the storefront
 * use case does for cart clearing.
 */
export interface INotifierService {
  /**
   * Delivers a notification that an order has just been created.
   *
   * @param order The freshly persisted order. Fully self-describing — the
   *   denormalized {@link IOrderItem} snapshot lets the notifier render the whole
   *   receipt without a follow-up catalog lookup.
   */
  notifyOrderCreated(order: IOrder): Promise<void>
}
