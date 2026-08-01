# План: валидация на клиенте + единый источник схемы в shared

## Архитектурный ответ (обоснование)

**Где валидация вписывается в Clean Architecture:** само *правило* (что считать валидным телефоном) и *схема* (zod-объект, который его выражает) живут в `@panda-lavanda/shared`. Все границы (форма на клиенте, server-function `.validator()`, API-маршрут `.parse()`) импортируют одну схему — правило перестаёт дублироваться и дрифтить. Это исправляет корневую проблему текущего кода (три независимых копии `phone: z.string().min(1)` + enum-литералы, рассинхронизируемые только JSDoc).

Почему `shared`, а не `domain`: domain намеренно pure без zod (AGENTS.md: "zero framework deps, no external libs"). `shared` уже зависит от `domain` (известная инверсия из AGENTS.md), поэтому shared-схема **можёт** ссылаться на доменные enum-значения (`ContactMethod`, `Size`) — это легально по направлению зависимостей и заодно устраняет дрифт enum'ов.

## Согласованные решения
- **Размещение:** общая zod-схема в `@panda-lavanda/shared` → импортируется во всех границах.
- **Правило телефона:** regex для российских мобильных номеров.

---

## 1. Зависимость
- `zod` → добавить в `packages/shared` (сейчас его там нет).

## 2. Shared-слой: единый источник схем

**`packages/shared/src/validation/phone.ts`** (новый):
- Константа `RU_PHONE_REGEX` (покрывает `+7`/`8`, 10 цифр после кода страны, допускает пробелы/скобки/дефисы — нормализуется перед проверкой).
- `ruPhone` = `z.string().trim().min(1).refine(normalizeAndTest, { message: 'Укажите корректный номер телефона' })` — экспортируемый примитив, переиспользуемый на любой границе.
- Чистая функция-нормализатор `normalizePhone(raw): string` (выкидывает всё кроме цифр) — нужна и для проверки, и (опционально) для сохранения канонического вида.

**`packages/shared/src/validation/order.ts`** (новый):
- `contactMethodSchema = z.enum(Object.values(ContactMethod) as [string, ...string[]])` — **выводится из домена**, а не хардкод литералов (устраняет дрифт enum'значений).
- `sizeSchema = z.enum(Object.values(Size) as [...])` — аналогично из домена (используется в order items).
- `createOrderItemSchema`, `createOrderDataSchema` — полные схемы заказа, переиспользующие `ruPhone`, `contactMethodSchema`, `sizeSchema`. Это **новый single source of truth**, заменяющий дубликаты в server-fn и API-маршруте.
- Тип `CreateOrderInput = z.infer<typeof createOrderDataSchema>` — для согласованности с DTO.

**`packages/shared/src/validation/index.ts`** (новый): barrel.

**`packages/shared/src/index.ts`**: `export * from './validation'`.

## 3. Границы: переключение на общую схему (устранение дубликатов)

**`apps/web/src/app/server-functions/orders/orders.functions.ts`:**
- Удалить локальные `createOrderItemSchema` / `createOrderInputSchema` (строки 13–33).
- Импортировать `createOrderDataSchema` из `@panda-lavanda/shared`.
- `.validator(createOrderDataSchema)` — авторитетная серверная проверка теперь та же схема, что и в форме.

**`apps/api/src/routes/orders.ts`:**
- Удалить локальные `orderItemSchema` / `createOrderBodySchema` (строки 19–44).
- Импортировать `createOrderDataSchema` из `@panda-lavanda/shared`.
- `createOrderBodySchema.parse(request.body)` → `createOrderDataSchema.parse(request.body)`.
- `orderIdParamsSchema` остаётся локальным (params, не доменная инварианта).

## 4. Клиент: live-валидация формы

**`apps/web/src/presentation/pages/checkout-page/checkout-page.tsx`:**
- Заменить ad-hoc `phoneError = phone.trim().length === 0` на `ruPhone.safeParse(phone)` (импорт из shared) → `phoneError` получает строку сообщения или `undefined`.
- Импортировать `ruPhone` из `@panda-lavanda/shared`.
- `canSubmit` остаётся, но теперь учитывает результат схемы телефона.
- Сообщение об ошибке телефона — из `ruPhone`'s refine-message («Укажите корректный номер телефона»), отображается в `<Field error>`.
- На submit: опционально нормализовать телефон через `normalizePhone(phone)` перед отправкой, чтобы в БД шёл канонический вид.
- Поведение `nameError` не трогать (имя — простое non-empty, но при желании можно вынести в shared аналогично — рамка для будущих полей готова).

## 5. Проверка
- `npx tsc --noEmit` в `shared`, `api`, `web` (+ `domain`/`application`/`infrastructure` для страховки).
- Проверить вручную: невалидный телефон блокирует кнопку и показывает сообщение; валидный (`+7 999 123-45-67`, `89991234567`) проходит; server-fn и API отклоняют мусор единой ошибкой 422.

## Что это даёт (обоснование ценности)
- **Дрифт правил устранён:** телефон проверяется по одному regex'у везде; изменить правило — правка в одном файле.
- **Дрифт enum'ов устранён:** `contactMethodSchema`/`sizeSchema` выводятся из доменных const-объектов, а не хардкодят литералы (если в `ContactMethod` добавится значение, схема подтянет автоматически).
- **Расширяемость:** добавление новых полей с валидацией = добавить примитив в `shared/validation/` и сослаться в схеме; форма/api/server-fn не требуют отдельных правок.
- **Домен остаётся pure:** никаких zod-зависимостей в `packages/domain`.

## Замечание
Это вводит **первую** кросс-граничную zod-схему в кодовой базе (до сих пор схемы дублировались). Это сознательное отклонение от status quo в сторону DRY, явно согласованное. Существующий паттерн "validate-at-boundary" для LocalStorage-репозиториев (их локальные схемы) не трогается — у них другой жизненный цикл данных.