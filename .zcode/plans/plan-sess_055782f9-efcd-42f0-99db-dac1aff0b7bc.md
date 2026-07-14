# План: скрипт очистки и заполнения dev-БД тестовыми товарами

## Контекст и архитектурное решение

Создаётся greenfield seed-скрипт в **`packages/db`**, который работает с таблицами через Drizzle напрямую (`db.delete()`, `db.insert()`), а **не** через `DrizzleProductsRepository` из `infrastructure`. Это соблюдает направление зависимостей из `architecture.md`: `infrastructure → db`, обратное запрещено. `db` ничего не должен знать о доменных сущностях и портах.

Скрипт оперирует двумя таблицами: `products` и `exemplars` (FK `onDelete: cascade`). Категорий как таблицы нет — `category_id` это bare UUID, поэтому категории задаются как стабильные UUID-константы.

## Создаваемые/изменяемые файлы

### 1. `packages/db/scripts/seed.ts` (новый, основной скрипт)

Логика по порядку:

1. **Парсинг CLI-аргументов**: `--count=N` (по умолчанию `10`), `--yes` / `-y` (пропустить подтверждение для CI).
2. **Загрузка/чтение `DATABASE_URL`** из `process.env` (загружается нативным флагом Node `--env-file-if-exists` в npm-скрипте, см. п. 3 — без новой `dotenv`-зависимости). Если `DATABASE_URL` не задан — понятная ошибка и `exit(1)`.
3. **Guard защиты от прод-БД**: отказ, если `DATABASE_URL` не содержит dev-маркеров (`localhost`, `127.0.0.1`, `::1`, или имя БД `panda`). Отдельное сообщение о том, что скрипт только для dev.
4. **Интерактивный prompt** (через `node:readline/promises`): показывает целевой URL и запрашивает `y/N`. Пропускается при `-y`.
5. **Очистка**: `TRUNCATE exemplars, products RESTART IDENTITY CASCADE` через `db.execute(sql\`...\`)` — атомарно, сбрасывает `gen_random_uuid()` sequence не требуется (UUID генерируется, не sequence), но RESTART IDENTITY безопасен; CASCADE покрывает обе таблицы.
6. **Заполнение**: базовый набор из ~10 реалистичных садовых растений (лаванда узколистная/французская/зубчатая, гортензия крупнолистная/метельчатая, роза чайно-гибридная/плетистая, буддлея, юкка, клематис) с осмысленными описаниями, ценами, exemplars размеров `p9`/`p11` и placeholder-изображениями (`/uploads/<name>.jpg`). Набор циклически размножается до `count` через `Array.from({ length: count })` (суффикс номера при необходимости для уникальности имён).
7. **Отчёт**: `console.log` с количеством созданных товаров/exemplars.
8. **Закрытие соединения**: `process.exit(0)` (postgres-js держит пул, иначе процесс зависнет).

Категории — захардкоженные валидные UUID-строки (3-4 константы, например для групп «Лаванда», «Декоративные кустарники», «Многолетники»). Доступ к таблицам через импорты из `@panda-lavanda/db` (`products`, `exemplars`, `createDb`).

### 2. `packages/db/package.json` (изменить)

- Добавить `"seed": "node --env-file-if-exists=../../.env --import tsx scripts/seed.ts"` в `scripts`. Флаг `--env-file-if-exists` (Node 22.9+) не падает, если `.env` отсутствует — тогда скрипт сам выведёт понятную ошибку про `DATABASE_URL`.
- Добавить `"tsx": "^4.19.0"` в `devDependencies` (версия как в `apps/telegram-bot`), чтобы не полагаться на случайное hoisting в root.

### 3. `package.json` (root, изменить)

Добавить в `scripts`:
- `"seed": "npm run seed --workspace @panda-lavanda/db"`
- `"seed:db": "npm run seed --workspace @panda-lavanda/db"` (алиас, соответствующий паттерну `dev:web`/`dev:bot`)

### 4. `packages/db/tsconfig.json` (изменить)

Добавить `"scripts"` в `include`, чтобы `tsc --noEmit` (команда `npm run build` пакета) проверял типы скрипта. `types: ["node"]` уже стоит — `node:readline/promises`, `node:process`, `process.exit` доступны.

## Использование

```bash
# из корня монорепо, 10 товаров по умолчанию, с подтверждением
npm run seed

# 50 товаров, без подтверждения (для CI/частого пересоздания)
npm run seed -- --count=50 --yes

# короткий алиас
npm run seed -- -y
```

## Что НЕ делается

- Не добавляется `dotenv` — используем нативный `--env-file-if-exists` Node 22 (в Docker уже node:22-alpine).
- Не создаются миграции — схема не меняется, скрипт только оперирует данными.
- Не добавляются категории как таблица/сущность — вне рамок задачи (захардкоженные UUID).
- Скрипт не использует `IProductsRepository`/`DrizzleProductsRepository` — работает с таблицами напрямую, чтобы не нарушать слои.
- Не используется `tryCatch`/`Either` — для standalone CLI-скрипта обычный try/catch с `console.error` + `process.exit(1)` уместнее и не тянет зависимость от `domain` в `db`.