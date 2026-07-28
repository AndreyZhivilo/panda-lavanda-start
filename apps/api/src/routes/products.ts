import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import type { IProductFilters, SortOrder } from '@panda-lavanda/domain'

import { NotFoundError } from '../errors'

/**
 * Query schema for `GET /products`.
 *
 * Mirrors {@link IProductFilters}: `page`/`pageSize` are coerced from the
 * query string (URLs are strings), `ids` and `sort` arrive as comma-separated
 * values and are split into arrays. Unknown keys are stripped by zod.
 *
 * `ids` is a CSV because query-string array conventions vary across clients;
 * a single comma-separated value is unambiguous and matches how the web
 * client (`HttpProductsRepository`) serializes the filter.
 */
const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  ids: z
    .string()
    .optional()
    .transform((value) =>
      value ? value.split(',').map((id) => id.trim()).filter(Boolean) : undefined,
    ),
  sort: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? (value.split(',').map((s) => s.trim()).filter(Boolean) as SortOrder[])
        : undefined,
    ),
})

/**
 * Exemplar shape — shared by create and update schemas.
 *
 * `size` mirrors the domain `Size` values (`p9` | `p11`, kept in sync with the
 * `sizeEnum` in `schema/products.ts`).
 */
const exemplarSchema = z.object({
  price: z.number().int().nonnegative(),
  inStock: z.boolean(),
  size: z.enum(['p9', 'p11']),
})

/**
 * Body schema for `POST /products` — mirrors {@link CreateProductData}.
 *
 * `category` is a UUID string, `images` an array of URL strings, `exemplars`
 * an array of `{ price, inStock, size }` where `size` is the `p9` | `p11`
 * enum (kept in sync with the domain `Size`).
 */
const createProductBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().uuid(),
  images: z.array(z.string()).min(1),
  exemplars: z.array(exemplarSchema).default([]),
})

/**
 * Body schema for `PATCH /products/:id` — mirrors {@link UpdateProductData}.
 * Every field is optional (partial update).
 *
 * `exemplars`, when present, is a **full replacement** of the product's
 * variants: existing exemplars are deleted and these are inserted in their
 * place (the repository does this atomically). Pass `[]` to clear all variants.
 */
const updateProductBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().uuid().optional(),
  images: z.array(z.string()).min(1).optional(),
  exemplars: z.array(exemplarSchema).optional(),
}).partial()

/** Params schema for `/:id` routes. */
const productIdParamsSchema = z.object({
  id: z.string().uuid(),
})

/** Params schema for the slug-based lookup route. */
const productSlugParamsSchema = z.object({
  slug: z.string().min(1),
})

/** Params schema for exemplar sub-resource routes `/.../:exemplarId`. */
const exemplarIdParamsSchema = z.object({
  productId: z.string().uuid(),
  exemplarId: z.string().uuid(),
})

/**
 * Body schema for `POST /products/:productId/exemplars` — mirrors
 * {@link CreateExemplarData}. Reuses the shared {@link exemplarSchema}.
 */
const createExemplarBodySchema = exemplarSchema

/**
 * Body schema for `PATCH /products/:productId/exemplars/:exemplarId` — mirrors
 * {@link UpdateExemplarData}. Every field is optional (partial update).
 */
const updateExemplarBodySchema = exemplarSchema.partial()

/**
 * Mounts the products REST endpoints on the given prefix.
 *
 * Each handler delegates to `fastify.productsRepository` (the Drizzle-backed
 * implementation registered by the db plugin) and returns the domain entity
 * directly — Fastify serializes the plain JSON-serializable `IProduct` shape.
 */
export const productsRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.get('/products', async (request) => {
    const query = listProductsQuerySchema.parse(request.query)
    const filters: IProductFilters = {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      categoryId: query.categoryId,
      ids: query.ids,
      sort: query.sort,
    }
    return fastify.productsRepository.getMany(filters)
  })

  fastify.get('/products/:id', async (request) => {
    const { id } = productIdParamsSchema.parse(request.params)
    const product = await fastify.productsRepository.getById(id)
    if (!product) {
      throw new NotFoundError('Product', id)
    }
    return product
  })

  fastify.get('/products/by-slug/:slug', async (request) => {
    const { slug } = productSlugParamsSchema.parse(request.params)
    const product = await fastify.productsRepository.getBySlug(slug)
    if (!product) {
      throw new NotFoundError('Product', slug)
    }
    return product
  })

  fastify.post('/products', async (request, reply) => {
    const body = createProductBodySchema.parse(request.body)
    const product = await fastify.productsRepository.create(body)
    return reply.code(201).send(product)
  })

  fastify.patch('/products/:id', async (request) => {
    const { id } = productIdParamsSchema.parse(request.params)
    const body = updateProductBodySchema.parse(request.body)
    const product = await fastify.productsRepository.update(id, body)
    if (!product) {
      throw new NotFoundError('Product', id)
    }
    return product
  })

  fastify.delete('/products/:id', async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params)
    await fastify.productsRepository.delete(id)
    return reply.code(204).send()
  })

  // --- Exemplars (sub-resource of products) ------------------------------
  // Granular CRUD on a product's variants. `null` from the repository means the
  // product or exemplar does not exist → the global error handler turns the
  // thrown NotFoundError into a 404 in the uniform shape.

  fastify.get('/products/:productId/exemplars/:exemplarId', async (request) => {
    const { productId, exemplarId } = exemplarIdParamsSchema.parse(request.params)
    const exemplar = await fastify.productsRepository.getExemplar(
      productId,
      exemplarId,
    )
    if (!exemplar) {
      throw new NotFoundError('Exemplar', exemplarId)
    }
    return exemplar
  })

  fastify.post('/products/:productId/exemplars', async (request, reply) => {
    const { productId } = exemplarIdParamsSchema
      .pick({ productId: true })
      .parse(request.params)
    const body = createExemplarBodySchema.parse(request.body)
    const exemplar = await fastify.productsRepository.createExemplar(
      productId,
      body,
    )
    if (!exemplar) {
      throw new NotFoundError('Product', productId)
    }
    return reply.code(201).send(exemplar)
  })

  fastify.patch('/products/:productId/exemplars/:exemplarId', async (request) => {
    const { productId, exemplarId } = exemplarIdParamsSchema.parse(request.params)
    const body = updateExemplarBodySchema.parse(request.body)
    const exemplar = await fastify.productsRepository.updateExemplar(
      productId,
      exemplarId,
      body,
    )
    if (!exemplar) {
      throw new NotFoundError('Exemplar', exemplarId)
    }
    return exemplar
  })

  fastify.delete('/products/:productId/exemplars/:exemplarId', async (request, reply) => {
    const { productId, exemplarId } = exemplarIdParamsSchema.parse(request.params)
    await fastify.productsRepository.deleteExemplar(productId, exemplarId)
    return reply.code(204).send()
  })
}
