## Фикс `Buffer is not defined` на странице /catalog

### Корневая причина
Цепочка импортов утягивает серверный граф (postgres-js → `Buffer`) в клиентский бандл:
`catalog-page.tsx` → `use-favorites.ts:10` → `composition-root/index.client.ts:2` → главный barrel `@panda-lavanda/infrastructure` → `index.ts:2` переэкспортирует `drizzle-products.repository` → `@panda-lavanda/db` → `postgres` → `Buffer`.

`index.client.ts` задумывался как клиент-изолированный (его комментарий так и обещает), но изоляция есть только на уровне composition-root, а на уровне **пакета** infrastructure единственный barrel `.` валит в один граф и серверные, и клиентские модули.

### Решение: клиентский subpath export
Разделить пакет infrastructure на два barrel: серверный `.` (как есть) и клиентский `./client` (только клиент-безопасные модули). Структурная защита от регрессии — повторно утянуть Drizzle/postgres в браузер через `./client` невозможно.

**Клиент-безопасные модули** (без Node-зависимостей): `api/crash-reporter.service.ts`, `storage/local-storage.repository.ts`, `storage/local-storage-user.repository.ts` (его импорт `./local-storage.repository` относительный и остаётся внутри подмножества).
**Серверные** (не входят в client-barrel): `repositories/drizzle-products.repository.ts`, `storage/local-file-storage.service.ts`.

### Изменения

1. **Создать `packages/infrastructure/src/client.ts`** — новый barrel:
   ```ts
   export * from './api/crash-reporter.service'
   export * from './storage/local-storage.repository'
   export * from './storage/local-storage-user.repository'
   ```

2. **`packages/infrastructure/package.json`** — добавить subpath `./client` в `exports` (поставить перед wildcard `./*`):
   ```json
   "exports": {
     ".": "./src/index.ts",
     "./client": "./src/client.ts",
     "./*": "./src/*"
   }
   ```

3. **`apps/web/src/app/composition-root/index.client.ts:2`** — сменить импорт на клиентский barrel и обновить комментарии (в них сейчас неверно утверждается, что графы «полностью разделены»):
   ```ts
   import { CrashReporterService, LocalStorageUserRepository } from '@panda-lavanda/infrastructure/client'
   ```

### Проверка
- Серверный код не трогается: `composition-root/products.ts` и `storage.ts` по-прежнему импортируют `DrizzleProductsRepository` / `LocalFileStorageService` из главного barrel `.` — ничего не ломается.
- После правки: `npm run dev:web`, открыть `/catalog` — товары остаются, `Buffer is not defined` не возникает; `useFavorites` работает (heart-иконки переключаются, состояние сохраняется в LocalStorage).
- (Опционально) `npx tsc --noEmit` в `packages/infrastructure` и `apps/web` для контроля типов.

### Затрагиваемые файлы
- `packages/infrastructure/src/client.ts` (новый)
- `packages/infrastructure/package.json` (1 строка)
- `apps/web/src/app/composition-root/index.client.ts` (1 импорт + комментарии)