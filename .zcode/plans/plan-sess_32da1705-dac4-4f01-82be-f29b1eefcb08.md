# План: создание design-spec.md — полного ТЗ на дизайн и вёрстку

Создам один Markdown-файл `design-spec.md` в корне репозитория (рядом с `architecture.md`, `AGENTS.md`). Документ — рабочее ТЗ для дизайнера и верстальщика, привязанное к стеку (TanStack Start + React 19 + Tailwind v4 + shadcn/ui) и доменной модели проекта (`IProduct` / `IExemplar` / `Size`).

## Источники
- Скриншоты aquaplant.ru в `apps/web/public/refs/` (разобраны визуально: шапка, hero-карусель, плитки категорий, сетки хитов/новинок, промо-блоки, бренды, блог, футер; каталог с левым сайдбаром фильтров и сеткой карточек; карточка с галереей, табами и related).
- Веб-поиск по структуре aquaplant.ru (категории, навигация, условия доставки 460 ₽ / бесплатно от 10 000 ₽).
- Текущее состояние проекта (токены и компоненты — greenfield; страницы — placeholder; wiring-зазоры).

## Структура документа design-spec.md

1. **Введение** — цель, референс (aquaplant.ru, подход «структура + своя тема»), стек, ограничения (верстать на shadcn/ui, Tailwind v4 `@theme`, React 19, TanStack Start file-based routing).

2. **Дизайн-токены (Tailwind v4 `@theme`)** — описать блок для `apps/web/src/app/styles.css`:
   - **Палитра — 2–3 варианта** с HEX и рекомендацией:
     - Вариант A: лавандовый primary (#7C5CDB / #6D4FC0) + садовый зелёный secondary (#4C7A3A) + кремовый фон (#FAF7F2) + нейтральный текст
     - Вариант B: зелёный primary + лаванда accent
     - Вариант C: более приглушённый «природный»
     - Семантические токены: background, foreground, primary, secondary, muted, accent, destructive, border, ring (в нотации shadcn CSS-переменных для light/dark).
   - **Типографика** — шкала (display, h1–h4, body, caption), межстрочный, начертания; рекомендации по шрифтам (системный stack или гугл-шрифт вроде Manrope/Inter).
   - **Spacing / Radii / Shadows / Breakpoints** — шкалы под shadcn.

3. **Интеграция shadcn/ui в монорепо** (блок «дизайн + интеграция»):
   - Решение о расположении компонентов: базовые shadcn-примитивы (Button, Card, Input, Badge, Separator, Skeleton, Tooltip, Sheet, Select, Accordion, Tabs, Dialog, DropdownMenu, NavigationMenu, Carousel, Sonner) → `packages/shared/src/ui/` (кросс-апп, барель через `@panda-lavanda/shared`); доменно-специфичные (ProductCard, Filters, Gallery) → `apps/web/src/presentation/components/`.
   - `components.json` для shadcn CLI: aliases под монорепо, css-переменные, baseColor `neutral`, RSC on.
   - Установка: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (уже в deps), `next-themes` (опционально), `sonner`, `zod` + `react-hook-form` + `@hookform/resolvers`.
   - Утилита `cn()` в `packages/shared/src/lib/cn.ts` + экспорт через барель.
   - Карта соответствия shadcn-компонентов -> страницам/блокам.

4. **Глобальный layout** (закрыть wiring-зазор в `__root.tsx`):
   - `RootLayout` с Header (topbar + основная строка с поиском + меню категорий как NavigationMenu) + Footer (многоколоночный).
   - Header sticky, mobile-меню через Sheet; корзина/избранное/аккаунт как DropdownMenu.
   - Breadcrumbs как переиспользуемый компонент.

5. **Компонентная декомпозиция** — таблица: имя → shadcn-основа → местоположение в монорепо → props → на каких страницах используется:
   - Atomic: Button, IconButton, Badge, Input, Separator, Skeleton, Tooltip.
   - Layout: Header, TopBar, MainNav, Footer, Breadcrumbs.
   - Commerce: ProductCard, CategoryTile, QuantityStepper, PriceTag, StockBadge, ProductGallery, FiltersPanel, ProductGrid, Pagination, SortToolbar, TabsSpec, RelatedCarousel.

6. **Страница 1 — Главная (`/`)** — покомпонентный спек каждого блока (topbar, header, hero-карусель, плитка категорий, «Хиты/Новинки» сетка, промо-блоки в 2 колонки, бренды, блог-3 карточки, футер), сетка, отступы, адаптив (mobile-first брейкпоинты), состояния (карусель hover/active).

7. **Страница 2 — Каталог (`/catalog` или `/category/:id`)** — layout с левым sticky-сайдбаром фильтров (Accordion: категория, цена range, наличие) + правая область (SortToolbar: Select сортировки, переключатель grid/list, кол-во на странице; ProductGrid 3–4 колонки; Pagination). Привязка фильтров к `IProductFilters { categoryId?, page?, ids? }` и `PAGE_SIZE = 20`; отображение цены/наличия из `IExemplar`. Состояния: loading skeletons, empty, error.

8. **Страница 3 — Карточка товара (`/product/:id`)** — двухколоночный layout: слева `ProductGallery` (Carousel большое фото + миниатюры, зум по наведению), справа блок покупки (заголовок, рейтинг-заглушка, PriceTag, **выбор размера** как ToggleGroup/Select по `Size.P9`/`Size.P11` и `exemplars[]`, StockBadge по `inStock`, QuantityStepper, Button «В корзину», инфо-блок доставки). Ниже TabsSpec (Описание / Характеристики / Отзывы) с longread через `@tailwindcss/typography` (активировать плагин в styles.css). RelatedCarousel — маппинг по той же category. Все данные из `IProduct`.

9. **Состояния и интерактив** — hover/focus/active/disabled/loading/empty/error для ключевых компонентов; скелетоны на запросы репозитория; тосты через Sonner (добавление в корзину); правило «никаких throw через границы слоёв» (`Either` + `tryCatch`).

10. **Доступность (WCAG 2.1 AA)** — семантические теги, видимый фокус, `aria-*`, alt на изображениях (`images: ImageUrl[]`), role для каруселей, минимальный контраст, keyboard-навигация по фильтрам/галерее.

11. **Адаптивность** — таблица брейкпоинтов (mobile-first: 375 / 640 / 768 / 1024 / 1280) и поведение каждого блока (сколько колонок в сетке, сворачивание сайдбара в Sheet на мобиле, перестроение блоков главной).

12. **Wiring-зазоры и рекомендации** — что нужно закрыть до/во время верстки:
    - Composition root для `IProductsRepository` (инстанс `DrizzleProductsRepository` + `createDb(DATABASE_URL)`) в `apps/web/src/app/providers/`.
    - Доставка данных в UI (TanStack Route `loader` с `IProductsRepository.getMany/getById`, или React Context).
    - Global layout в `__root.tsx` (сейчас `{children}` без chrome).
    - Активация `@tailwindcss/typography` и `@theme`.

13. **План реализации / чек-лист** — последовательность шагов (токены → cn()/shadcn init → базовые компоненты → layout → ProductCard → 3 страницы → состояния → a11y), с отметками файлов, которые затрагиваются.

## Результат
Один самодостаточный файл `design-spec.md` в корне, готовый для передачи дизайнеру/верстальщику и для последующей реализации. Файл версионируется в git вместе с кодом. Скриншоты-референсы уже лежат в `apps/web/public/refs/` и на них будут ссылки.

Никакого кода/конфигов в этой задаче не меняю — только создаю `design-spec.md` (single new file, корень репо).