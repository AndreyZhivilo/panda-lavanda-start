import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { NotFoundError } from '../errors'

/** Params schema for the slug-based lookup route. */
const categorySlugParamsSchema = z.object({
  slug: z.string().min(1),
})

/**
 * Mounts the categories REST endpoints on the root prefix.
 *
 * Each handler delegates to `fastify.categoriesRepository` (the Drizzle-backed
 * implementation registered by the db plugin) and returns the domain entity
 * directly — Fastify serializes the plain JSON-serializable `ICategory` shape.
 *
 * Категорий немного, поэтому `GET /categories` не пагинируется и возвращает весь
 * список разом (см. доменный порт `ICategoriesRepository`).
 */
export const categoriesRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.get('/categories', async () => {
    return fastify.categoriesRepository.getMany()
  })

  fastify.get('/categories/by-slug/:slug', async (request) => {
    const { slug } = categorySlugParamsSchema.parse(request.params)
    const category = await fastify.categoriesRepository.getBySlug(slug)
    if (!category) {
      throw new NotFoundError('Category', slug)
    }
    return category
  })
}
