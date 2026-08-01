import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { createOrderDataSchema } from '@panda-lavanda/shared'

import { NotFoundError } from '../errors'

/** Params schema for `/:id` routes. */
const orderIdParamsSchema = z.object({
  id: z.string().uuid(),
})

/**
 * Mounts the orders REST endpoints on the given prefix.
 *
 * Each handler delegates to `fastify.ordersRepository` (the Drizzle-backed
 * implementation registered by the db plugin) and returns the domain entity
 * directly — Fastify serializes the plain JSON-serializable `IOrder` shape.
 *
 * ## Validation
 *
 * `POST /orders` validates its body with {@link createOrderDataSchema} — the
 * **single source of truth** shared with the checkout form and the web app's
 * `createOrder` server function (see `@panda-lavanda/shared/validation/order.ts`).
 * A validation failure throws a `ZodError`, which the global error handler in
 * `server.ts` maps to HTTP 422. Reusing one schema across all three boundaries
 * means the phone rule, the contact-method enum and the item shape cannot drift.
 */
export const ordersRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.post('/orders', async (request, reply) => {
    const body = createOrderDataSchema.parse(request.body)
    const order = await fastify.ordersRepository.create(body)

    // Secondary effect: notify the shop admin over Telegram. This is a
    // best-effort side-effect, exactly like cart clearing in
    // `CreateOrderUseCase` — the order is already persisted, so a Telegram
    // outage (network error, blocked chat, rate limit) must never surface as a
    // failed checkout. The error is routed to the crash reporter (the same sink
    // the rest of the project uses) and tagged on the request log for context.
    try {
      await fastify.notifier.notifyOrderCreated(order)
    } catch (error) {
      request.log.error(error, 'Failed to send Telegram order notification')
      fastify.crashReporter.report(error)
    }

    return reply.code(201).send(order)
  })

  fastify.get('/orders/:id', async (request) => {
    const { id } = orderIdParamsSchema.parse(request.params)
    const order = await fastify.ordersRepository.getById(id)
    if (!order) {
      throw new NotFoundError('Order', id)
    }
    return order
  })
}
