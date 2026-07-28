# Корзина — план реализации

## Ответ на ваш вопрос (кратко)

`IProduct` — это *шаблон* (например, «Лаванда»), а `IExemplar` — *покупаемый вариант* (P9/P11, своя цена, свой `id`). В реальных магазинах корзина оперирует **вариантом/SKU**, а не шаблоном. Поэтому **ключом позиции корзины будет `exemplarId`, а не `productId`** (как у Ozon/Wildberries/Shopify). Это позволяет: корректно считать сумму (цены разные), держать P9 и P11 разными строками, не терять выбранный размер. Ваш выбор «минимум: ids + quantity» отлично ложится на эту модель.

---

## Зафиксированные решения (из ваших ответов)

- **Ключ позиции:** `exemplarId`.
- **`ICartItem`:** `{ exemplarId, productId, quantity }` — без снапшотов; цена/имя/фото/размер всегда берутся свежими с бэкенда (грузим продукты по ids — тот же трюк, что в favorites).
- **Кнопка в каталоге:** добавляет «основной» экземпляр = первый in-stock (или первый, если всех нет) — будет чистая доменная функция `primaryExemplar`.
- **Header:** в этой задаче не трогаем (только страница + кнопки).
- **«Оформить заказ»:** пустая кнопка-заглушка (заказ — отдельная задача).

Архитектурно **точно повторяем favorites** (домен → порт → application use-case → LocalStorage-репозиторий → client composition root → `useCart` хук на TanStack Query → SPA-страница с `ssr: false`). Это согласуется с `architecture.md` и явными комментариями в коде («future cart»).

---

## Слой 1 — Domain (`packages/domain/src/`)

### `cart/cart.ts` (новый)
```ts
import type { UniqueId, PriceInRub } from '@panda-lavanda/shared'

/** Позиция корзины. Ключ — экземпляр (вариант), не продукт. */
export interface ICartItem {
  exemplarId: UniqueId
  productId: UniqueId
  quantity: number
}

/** Анонимная корзина — список позиций. */
export interface ICart {
  items: ICartItem[]
}

// Чистые функции-запросы (используются в компонентах и тестах):
export function isInCart(cart: ICart, exemplarId: UniqueId): boolean
export function cartItemQuantity(cart: ICart, exemplarId: UniqueId): number // 0 если нет
export function cartTotalQuantity(cart: ICart): number                       // всего единиц
export function cartDistinctItemCount(cart: ICart): number                   // число строк
/** Сумма по позициям; цена берётся из резолвера (данные о ценах живут в продуктах). */
export function cartSubtotal(
  cart: ICart,
  priceOf: (exemplarId: UniqueId) => PriceInRub | undefined,
): PriceInRub
```

### `products/product.ts` (правка) — добавить две чистые функции
```ts
/** Основной экземпляр: первый in-stock, иначе первый; undefined если нет экземпляров. */
export function primaryExemplar(product: IProduct): IExemplar | undefined
/** Человекочитаемая метка размера (вынос из exemplar-selector, единый источник). */
export function sizeLabel(size: Size): string
```

### `cart/index.ts` (новый) → `export * from './cart'`
### `cart/cart.test.ts` (новый) — тесты чистых функций (зеркало `users/user.test.ts`)
### `ports/cart-repository.port.ts` (новый)
```ts
export interface ICartRepository {
  get(): Promise<ICart>                                  // сид пустой корзиной если нет
  addItem(item: ICartItem): Promise<ICart>              // мёржит кол-во если exemplar уже есть
  removeItem(exemplarId: UniqueId): Promise<ICart>      // идемпотентно
  setQuantity(exemplarId: UniqueId, quantity: number): Promise<ICart>  // <=0 → удаляет
  clear(): Promise<ICart>                               // для будущего флоу заказа
}
```
### `index.ts` (правка) — добавить `export * from './cart'` и `export * from './ports/cart-repository.port'`

---

## Слой 2 — Application (`packages/application/src/cart/`)

Один файл на use-case, каждый — тонкая обёртка `tryCatch` над портом (точная копия `toggle-favorite-product.use-case.ts`):
- `get-cart.use-case.ts` → `GetCartUseCase`
- `add-cart-item.use-case.ts` → `AddCartItemUseCase` (аргумент `ICartItem`)
- `remove-cart-item.use-case.ts` → `RemoveCartItemUseCase` (аргумент `exemplarId`)
- `set-cart-quantity.use-case.ts` → `SetCartQuantityUseCase` (`exemplarId`, `quantity`)
- `clear-cart.use-case.ts` → `ClearCartUseCase`
- `cart/index.ts` → barrel
- правка `application/src/index.ts` → `export * from './cart'`

Логика мёрджа/удаления живёт в репозитории (как `toggleFavoriteProduct`), use-case — чистый `tryCatch`.

---

## Слой 3 — Infrastructure (`packages/infrastructure/src/storage/`)

### `local-storage-cart.repository.ts` (новый)
Расширяет `LocalStorageRepository<ICart>`, реализует `ICartRepository`. Объявляет только Zod-схему + `defaultValue()` (зеркало `local-storage-user.repository.ts`):
```ts
const cartItemSchema = z.object({
  exemplarId: nonEmptyString,
  productId: nonEmptyString,
  quantity: z.number().int().positive(),
})
const cartSchema = z.object({ items: z.array(cartItemSchema) })

export class LocalStorageCartRepository extends LocalStorageRepository<ICart> implements ICartRepository {
  protected readonly schema = cartSchema
  protected defaultValue(): ICart { return { items: [] } }
  // get / addItem(мёрж) / removeItem / setQuantity(<=0 удаляет) / clear
}
```
### Баррели (правка): добавить экспорт в **оба** — `index.ts` и `index.client.ts` (как у user-repo).

---

## Слой 4 — Web: composition root + хук

### `apps/web/src/app/composition-root/index.client.ts` (правка)
Рядом с блоком `userRepository`:
```ts
export const cartRepository: ICartRepository = new LocalStorageCartRepository(
  'panda-lavanda:cart', crashReporter,
)
export const getCartUseCase = new GetCartUseCase(cartRepository, crashReporter)
export const addCartItemUseCase = new AddCartItemUseCase(cartRepository, crashReporter)
export const removeCartItemUseCase = new RemoveCartItemUseCase(cartRepository, crashReporter)
export const setCartQuantityUseCase = new SetCartQuantityUseCase(cartRepository, crashReporter)
export const clearCartUseCase = new ClearCartUseCase(cartRepository, crashReporter)
```

### `apps/web/src/shared/hooks/use-cart.ts` (новый) — клон `use-favorites.ts`
- `CART_QUERY_KEY = ['cart']`
- `createIsomorphicFn().client(...).server(... throwing stubs ...)` граница
- `useQuery` на `getCart`, `useMutation` на каждое действие с `onSettled` → инвалидируем `['cart']`
- Возвращает: `cart`, `isLoading`, `addItem`, `removeItem`, `setQuantity`, `clear`, `isAdding`, `isInCart(id)`, `quantity(id)`, `totalQuantity`, `itemCount`
### правка `shared/hooks/index.ts` → экспорт `useCart`

---

## Слой 5 — Web: UI

### `shared/components/product-card.tsx` (правка)
Расширить props: `onAddToCart?: () => void`, `isAddingToCart?: boolean`. Добавить кнопку-иконку (`ShoppingCart` из lucide) в футер карточки рядом с ценой, с `aria-label="Добавить в корзину"`. Дизейблится через `isAddingToCart` (родитель управляет).

### `shared/components/exemplar-selector.tsx` (правка)
Сделать **контролируемым**: props `selectedId: UniqueId | undefined` + `onSelectChange: (id: UniqueId) => void`; убрать внутренний `useState`. `sizeLabel` импортировать из домена (вместо локальной копии).

### `presentation/pages/product-page/product-page.tsx` (правка)
- Поднять состояние выбранного экземпляра: `useState<UniqueId | undefined>(primaryExemplar(product)?.id)`.
- Передать `selectedId`/`onSelectChange` в `ExemplarSelector`.
- Под селектором — кнопка «В корзину»: `addItem({ exemplarId: selectedId, productId: product.id, quantity: 1 })`. Дизейблится, если нет экземпляра или выбранный не in-stock.

### `presentation/pages/catalog-page/catalog-page.tsx` (правка)
- Деструктурировать `useCart()`.
- Для каждой карточки: `const ex = primaryExemplar(product)`, `onAddToCart={() => ex && addItem({ exemplarId: ex.id, productId: product.id, quantity: 1 })}`, `isAddingToCart={isAdding}`. Передать в `<ProductCard>`.

### `presentation/pages/cart-page/cart-page.tsx` + `index.ts` (новые) — клон `favorites-page`
- `useCart()` → `items`. `ids = unique(items.map(i => i.productId))`.
- `useQuery(['cart-products', ids])` → `getProducts({ data: { ids, pageSize: ids.length || 1 } })`, `enabled: ids.length > 0` (тот же приём).
- По каждой позиции: фото, имя, размер (`sizeLabel`), цена за единицу, степпер `− qty +` (`setQuantity`; при `0` репозиторий сам удаляет), цена строки, кнопка-«корзина» (`removeItem`).
- Итог: `cartSubtotal(cart, priceOf)`, где `priceOf` строится из загруженных экземпляров.
- Состояния: пусто («Корзина пуста» + ссылка в каталог), загрузка, ошибка.
- Кнопка **«Оформить заказ»** — пустая заглушка (TODO, обработчик в следующей задаче).

### `app/routes/cart.tsx` (новый) — клон `favorites.tsx`
```tsx
export const Route = createFileRoute('/cart')({
  component: CartPage,
  ssr: false,
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
})
```

### Регенерация маршрутов
После добавления `cart.tsx` — `npm run generate-routes` (или это сделает dev-сервер), чтобы обновился `routeTree.gen.ts`.

---

## Что НЕ делаем в этой задаче
- Иконку корзины со счётчиком в header (по вашему выбору — позже).
- Создание заказа (заглушка-кнопка; флоу — отдельная задача).
- Серверный бэкенд корзины (LocalStorage; миграция тривиальна через composition root).

## Согласование с конвенциями
- `import type` для типов, без `const enum`, чистые доменные функции рядом с интерфейсами, `tryCatch`/`Either` через use-case, `.client.ts` composition root, `ssr: false` + `noindex` для клиентской страницы — всё как в favorites.

## Очерёдность
Домен (+тесты) → application → infrastructure (+баррели) → composition root → хук → UI (card/selector/product/catalog/cart) → маршрут + реген → `tsc --noEmit` по пакетам и ручная проверка в dev.