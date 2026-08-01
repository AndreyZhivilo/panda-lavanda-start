import type {
  ContactMethod,
  IOrder,
  INotifierService,
} from '@panda-lavanda/domain'
import { contactMethodLabel, sizeLabel } from '@panda-lavanda/domain'

/**
 * Configuration injected at the composition root.
 */
export interface TelegramNotifierConfig {
  /** Bot token from BotFather, used to authenticate the Telegram Bot API call. */
  botToken: string
  /** Numeric chat id that receives the notifications (the admin's chat). */
  adminChatId: number
}

/**
 * Telegram Bot API adapter implementing {@link INotifierService}.
 *
 * Sends formatted admin notifications to the configured chat via the Telegram
 * Bot API, using the platform `fetch` (available on Node ≥18). grammy is **not**
 * pulled in here: each notification is a single outbound HTTP call, and keeping
 * the dependency out of `apps/api` matches the backend's "thin adapter" stance
 * (it already imports domain types only and owns its own small adapters rather
 * than reaching into `packages/infrastructure`).
 *
 * Each `notify*` method formats its event into a message and posts it. The class
 * is intentionally generic in name (not `TelegramOrderNotifier`) so it can carry
 * every future notification method the {@link INotifierService} port gains,
 * sharing the transport (`sendMessage`) and config across all of them.
 *
 * Per the port contract, callers must treat a delivery failure as best-effort:
 * these methods throw on a non-OK Telegram response or network error, and the
 * `POST /orders` route wraps the call in a swallowed try/catch so a Telegram
 * outage can never fail order placement.
 */
export class TelegramNotifier implements INotifierService {
  constructor(private readonly config: TelegramNotifierConfig) {}

  async notifyOrderCreated(order: IOrder): Promise<void> {
    await this.send(formatOrderMessage(order))
  }

  /**
   * Posts `text` to the admin chat via `sendMessage`.
   *
   * Shared by every `notify*` method. Throws on a non-OK response so the caller
   * can route the error to the crash reporter / request log.
   */
  private async send(text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.config.adminChatId,
        text,
        // parse_mode kept as plain text on purpose: the message escapes nothing
        // and Russian text reads fine without Markdown; this avoids Telegram's
        // "bad request: can't parse entities" errors on stray punctuation.
        parse_mode: undefined,
      }),
    })

    if (!response.ok) {
      // Surface the Telegram payload for the caller's error log; throw so the
      // route handler can route it to the crash reporter / request log.
      const body = await response.text().catch(() => '')
      throw new Error(
        `Telegram sendMessage failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
      )
    }
  }
}

/**
 * Renders an order as a human-readable Telegram message.
 *
 * Pure function — extracted so the formatting rule has one definition and can
 * be unit-tested independently of the Telegram transport. Reuses the domain
 * {@link contactMethodLabel} / {@link sizeLabel} helpers so the labels stay in
 * sync with the storefront.
 */
export function formatOrderMessage(order: IOrder): string {
  const lines: string[] = []

  lines.push('🛒 Новый заказ')
  lines.push('')
  lines.push(`Клиент: ${order.customerName}`)
  lines.push(`Телефон: ${order.phone}`)
  lines.push(`Связь: ${contactMethodLabel(order.contactMethod as ContactMethod)}`)
  if (order.comment) {
    lines.push(`Комментарий: ${order.comment}`)
  }
  lines.push('')
  lines.push('Позиции:')

  for (const item of order.items) {
    const sum = item.unitPrice * item.quantity
    lines.push(
      `• ${item.productName} (${sizeLabel(item.size)}) — ` +
        `${item.unitPrice} ₽ × ${item.quantity} = ${sum} ₽`,
    )
  }

  lines.push('')
  lines.push(`Итого: ${order.totalPrice} ₽`)
  lines.push(`Оформлен: ${formatTimestamp(order.createdAt)}`)

  return lines.join('\n')
}

/**
 * Formats the stored ISO timestamp for display (DD.MM.YYYY HH:mm, local time).
 *
 * Falls back to the raw value if parsing fails, so a malformed timestamp never
 * breaks the notification.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
