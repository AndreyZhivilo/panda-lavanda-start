# Замена `productId` на `slug` в URL товара

Заменяем роут `/products/$productId` → `/products/$productSlug`. Slug авто-генерируется из названия (кириллица → латиница) при **создании** товара, хранится в БД (UNIQUE), не меняется при последующих PATCH. Страница товара читает slug из URL и грузит данные по нему.

## Принятые решения

- **Транслитерация:** `cyrillic-to-translit-js`, зависимость **только** `apps/api` (домен остаётся pure). Веб-клиент только читает `product.slug`.
- **Уникальность:** колонка `UNIQUE` в Postgres + автосуффикс `-2`, `-3`, … в репозитории при коллизии (pre-check перед insert).
- **Поведение при rename:** slug **фиксируется при создании**, НЕ пересчитывается при `PATCH /products/:id` (в `update()` slug не трогаем).
- **API:** `GET /products/:id` (UUID) **остаётся**, добавляется `GET /products/by-slug/:slug`. Оба метода `getById`/`getBySlug` в порте и репозиториях.

---

## 1. Domain — `packages/domain`

**`src/products/product.ts`** — добавить поле в `IProduct` (после `id`):
```ts
export interface IProduct {
  id: UniqueId
  slug: string            // ← NEW
  name: string
  // ...
}
```

**`src/ports/products-repository.port.ts`** — добавить метод в `IProductsRepository`:
```ts
/** Returns a single product by slug, or `null` if not found. */
getBySlug(slug: string): Promise<IProduct | null>
```

## 2. Application — `packages/application`

**`src/products/get-product-by-slug.use-case.ts`** — NEW, зеркалит `GetProductByIdUseCase`:
```ts
export class GetProductBySlugUseCase {
  constructor(
    private readonly products: IProductsRepository,
    private readonly crashReporter?: ICrashReporterService,
  ) {}
  execute(slug: string): Promise<Either<Error, IProduct | null>> {
    return tryCatch(() => this.products.getBySlug(slug), this.crashReporter)
  }
}
```
**`src/products/index.ts`** — добавить `export * from './get-product-by-slug.use-case'`.

## 3. API — `apps/api`

**`package.json`** — добавить зависимость `cyrillic-to-translit-js`.

**`src/utils/slug.ts`** — NEW, чистая утилита (используется репозиторием и сидом):
```ts
import CyrillicToTranslitJs from 'cyrillic-to-translit-js'

const translit = new CyrillicToTranslitJs()

/** "Лаванда узколистная «Hidcote»" → "lavanda-uzkololistnaya-hidcote" */
export function toSlug(name: string): string {
  return translit
    .transform(name, '-')        // кириллица→латиница, пробелы→-
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')  // убрать кавычки/гильеметы/прочее
    .replace(/-+/g, '-')         // схлопнуть повторы -
    .replace(/^-+|-+$/g, '')     // обрезать по краям
}
```

**`src/schema/products.ts`** — добавить колонку:
```ts
slug: varchar('slug', { length: 255 }).notNull().unique(),
```

**Миграция:** `npm run generate:api` → создаст `drizzle/0002_*.sql` (`ALTER TABLE products ADD COLUMN slug … UNIQUE`). Затем `npm run migrate:api`. Поскольку сид делает `TRUNCATE … RESTART IDENTITY`, порядок: migrate → seed. Если миграция падает на `NOT NULL` с существующими строками — сначала очистить таблицу (re-seed / `TRUNCATE` вручную).

**`src/repositories/products.repository.ts`**:
- `ProductSelectRow`: добавить `slug: ProductRow['slug']`.
- Оба `select({...})` (в `getMany` и `getById`): добавить `slug: productsTable.slug`.
- `mergeProducts`: добавить `slug: p.slug` в возвращаемый объект.
- `create`: вычислить `slug = await findUniqueSlug(tx, toSlug(data.name))`, добавить в `.values({...})`. Приватный хелпер `findUniqueSlug(tx, base)` — ищет занятые slug'и с префиксом `base`/`base-%`, возвращает первый свободный (`base`, `base-2`, …).
- `update`: **slug НЕ трогаем** (он фиксируется при создании).
- **NEW** `getBySlug(slug)`: select по `eq(productsTable.slug, slug)` + загрузка exemplars, `mergeProducts(...)[0]` (как `getById`).

**`src/routes/products.ts`** — добавить эндпоинт (существующий `GET /products/:id` не трогаем):
```ts
const productSlugParamsSchema = z.object({ slug: z.string().min(1) })

fastify.get('/products/by-slug/:slug', async (request) => {
  const { slug } = productSlugParamsSchema.parse(request.params)
  const product = await fastify.productsRepository.getBySlug(slug)
  if (!product) throw new NotFoundError('Product', slug)
  return product
})
```
> Нет конфликта с `GET /products/:id`: Fastify держит radix-дерево по методу, разные имена параметров в разных методах OK.

**`scripts/seed.ts`** — в insert-цикле (стр. ~310) добавить `slug: toSlug(item.name)` в `.values({...})`. Для дублей цикла (`i >= CATALOG.length`) имя уже получает ` #N` — slug считается из итогового имени → уникально. Добавить импорт `toSlug`.

## 4. Infrastructure — `packages/infrastructure`

**`src/repositories/http-products.repository.ts`** — NEW метод (существующий `getById` не трогаем):
```ts
async getBySlug(slug: string): Promise<IProduct | null> {
  const response = await this.request(
    `/products/by-slug/${encodeURIComponent(slug)}`,
    { method: 'GET' },
  )
  if (response.status === 404) return null
  return (await response.json()) as IProduct
}
```

## 5. Web — `apps/web`

**`src/app/composition-root/products.ts`** — инстанцировать и экспортировать `getProductBySlugUseCase`.
**`src/app/composition-root/index.ts`** — реэкспорт.

**`src/app/server-functions/products/products.functions.ts`** — сменить ввод `getProduct` с `id` на `slug`:
```ts
const getProductInputSchema = z.object({ slug: z.string().min(1) })
// .handler → getProductBySlugUseCase.execute(data.slug)
// success → { ok: true, product: result.value }
```

**Переименовать роут** `src/app/routes/products.$productId.tsx` → `products.$productSlug.tsx`:
```tsx
export const Route = createFileRoute('/products/$productSlug')({
  component: ProductPage,
  loader: ({ params }) => getProduct({ data: { slug: params.productSlug } }),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
})
```
Затем `npm run generate-routes` (или dev-сервер сам).

**`src/presentation/pages/product-page/product-page.tsx`** — `useLoaderData({ from: '/products/$productSlug' })`.

**`src/shared/components/product-card.tsx`** — линк:
```tsx
<Link to="/products/$productSlug" params={{ productSlug: product.slug }} … />
```

**`src/presentation/pages/cart-page/cart-page.tsx`** — линк использует slug из уже загруженного `product` (корзина грузит товары через `getProducts({ ids })`, так что `product.slug` доступен):
```tsx
<Link to="/products/$productSlug" params={{ productSlug: product.slug }} … >
```
Если товар удалён (`product` нет) — рендерить текст без линка, чтобы не вести на 404.

---

## Порядок выполнения
1. **Domain:** `IProduct.slug`, `getBySlug` в порте.
2. **Application:** `GetProductBySlugUseCase`.
3. **API:** зависимость, утилита `slug.ts`, колонка в схеме, миграция (`generate:api` → `migrate:api`), репозиторий (create/getBySlug/selects/merge; `update` slug НЕ трогает), роут `/by-slug/:slug`, сид.
4. **Infrastructure:** `HttpProductsRepository.getBySlug`.
5. **Web:** composition root, server function (`slug`), переименование роута + regenerate, product-page, product-card, cart-page.
6. **Проверка:** `tsc --noEmit` в затронутых пакетах; re-seed; открыть `/products/<slug>` вручную.