import {
  CreateProductUseCase,
  GetCategoriesUseCase,
  GetProductBySlugUseCase,
  GetProductsUseCase,
  UpdateProductUseCase,
} from '@panda-lavanda/application'
import type { ICategoriesRepository, IProductsRepository } from '@panda-lavanda/domain'
import {
  HttpCategoriesRepository,
  HttpProductsRepository,
} from '@panda-lavanda/infrastructure'

import { env } from '#/env'
import { PhotoUploader } from '#/infrastructure/photo-uploader'

/**
 * Wired application dependencies — the bot's composition root.
 *
 * This is the **only** place in the bot that instantiates concrete
 * infrastructure (`HttpProductsRepository`, `HttpCategoriesRepository`,
 * `PhotoUploader`). Everything else consumes the ports. The web app follows the
 * same convention (`apps/web/src/app/composition-root/`); this mirrors it for
 * the bot.
 *
 * The repositories are HTTP-backed (they call `apps/api` at `env.BACKEND_URL`),
 * so the bot has **no** database driver — persistence lives entirely in the
 * backend, exactly as for the web app. The photo uploader is a small `fetch`
 * helper that `POST`s a multipart image to the backend's `POST /uploads` and
 * returns the stored URL.
 */
export interface AppDependencies {
  productsRepository: IProductsRepository
  categoriesRepository: ICategoriesRepository
  photoUploader: PhotoUploader
  createProduct: CreateProductUseCase
  updateProduct: UpdateProductUseCase
  getProducts: GetProductsUseCase
  getProductBySlug: GetProductBySlugUseCase
  getCategories: GetCategoriesUseCase
}

/**
 * Builds the bot's dependency graph from the validated env.
 *
 * Constructed once at startup (see `src/index.ts`) and shared across all
 * conversations. The `baseUrl` passed to the HTTP repositories is the validated
 * `BACKEND_URL` (origin only, no trailing slash) — matching the contract used
 * by the web app.
 */
export function createDependencies(): AppDependencies {
  const httpConfig = { baseUrl: env.BACKEND_URL }

  const productsRepository: IProductsRepository = new HttpProductsRepository(httpConfig)
  const categoriesRepository: ICategoriesRepository =
    new HttpCategoriesRepository(httpConfig)
  const photoUploader = new PhotoUploader({
    baseUrl: env.BACKEND_URL,
    botToken: env.TELEGRAM_BOT_TOKEN,
  })

  return {
    productsRepository,
    categoriesRepository,
    photoUploader,
    createProduct: new CreateProductUseCase(productsRepository),
    updateProduct: new UpdateProductUseCase(productsRepository),
    getProducts: new GetProductsUseCase(productsRepository),
    getProductBySlug: new GetProductBySlugUseCase(productsRepository),
    getCategories: new GetCategoriesUseCase(categoriesRepository),
  }
}
