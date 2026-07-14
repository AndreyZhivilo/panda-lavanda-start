# Design Spec — Panda Lavanda

Полное техническое задание на дизайн и вёрстку трёх ключевых страниц
интернет-магазина садовых растений **Panda Lavanda**: **Главная**, **Каталог**,
**Карточка товара**.

Документ адресован дизайнеру и верстальщику, привязан к реальному стеку проекта
и существующей доменной модели (`IProduct` / `IExemplar` / `Size`).

---

## 1. Введение

### 1.1. Цель

Зафиксировать визуальный язык, дизайн-токены, компонентную декомпозицию и
покомпонентную спецификацию трёх страниц так, чтобы:

- дизайнер мог собрать макеты без двусмысленностей;
- верстальщик мог реализовать страницы прямо в существующей кодовой базе;
- результат был консистентен с архитектурой монорепо (Clean Architecture,
  npm workspaces) и доменной моделью.

### 1.2. Референс и подход

| Параметр | Значение |
| --- | --- |
| Референс по UX/структуре | [aquaplant.ru](https://aquaplant.ru/) |
| Скриншоты-референсы | `apps/web/public/refs/main-page.png`, `products-list.png`, `single-product.png` |
| Подход | **«Структура + своя тема»** — перенимаем UX-паттерны и раскладку aquaplant (хедер с поиском, hero-карусель, плитки категорий, сетки хитов/новинок, промо-блоки, бренды, блог, футер; каталог с левым сайдбаром фильтров и сеткой карточек; карточка с галереей, табами, related-каруселью), но подставляем собственную **лавандово-садовую** тему вместо аквариумно-голубой |

> ⚠️ aquaplant — это **аквариумный** магазин (водные растения, креветки, грунты).
> Переносим **только** структуру и UX, тематическое наполнение и палитру — свои.

### 1.3. Стек и ограничения

| Слой | Технология |
| --- | --- |
| Фреймворк | TanStack Start (SSR включён), file-based routing |
| UI | React 19 |
| Стили | Tailwind CSS v4 (`@theme` в CSS, без `tailwind.config`) |
| UI-кит | **shadcn/ui** (Radix UI + Tailwind), расширенный набор |
| Иконки | `lucide-react` (уже в `apps/web/package.json`) |
| Типографика для longread | `@tailwindcss/typography` (установлен, но **не активирован** — включить) |
| Формы/валидация | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Тосты | `sonner` |
| Обработка ошибок | `@sweet-monads/either`, `tryCatch`/`tryCatchSync` из `@panda-lavanda/shared`. **Никаких `throw` через границы слоёв.** |

Жёсткие правила (из `AGENTS.md`):

- `import type` для type-only импортов (`verbatimModuleSyntax`, `isolatedModules`).
- Без `const enum` (паттерн const-object + union, как `Size`).
- Между пакетами — импорты по workspace-имени (`@panda-lavanda/domain`), не относительные пути.
- Внутри `apps/web` — `#/*` → `./src/*`.
- Маршруты — тонкие обёртки в `src/app/routes/`, монтируют страницу из `src/presentation/pages/`.

### 1.4. Текущее состояние проекта (стартовая точка)

| Слой | Состояние |
| --- | --- |
| Токены | **Greenfield.** В `apps/web/src/app/styles.css` только `@import "tailwindcss"` + reset. Никакого `@theme`. |
| UI-компоненты | **Greenfield.** `packages/shared/src/ui/`, `apps/web/src/presentation/components/` — пусты (`.gitkeep`). |
| Страницы | Placeholder `HomePage` (`/`) и `AboutPage` (`/about`). Каталога и карточки товара нет. |
| Глобальный layout | **Отсутствует.** В `__root.tsx` body рендерит `{children}` без хедера/футера. |
| Доставка данных | **Не подключена.** Нет composition root для `IProductsRepository`, нет вызова `createDb()`. |

→ Всё это — greenfield, спецификация определяет систему с нуля. Зазоры для закрытия
перечислены в разделе [12](#12-wiring-зазоры-и-рекомендации).

---

## 2. Дизайн-токены (Tailwind v4 `@theme`)

Токены определяются в **`apps/web/src/app/styles.css`** через `@theme` и
CSS-переменные в нотации shadcn (HSL channels для поддержки opacity-модификаторов
Tailwind и light/dark). Базовый `baseColor` shadcn — **`neutral`**.

### 2.1. Палитра — 2–3 варианта (с рекомендацией)

> Финальный выбор — за заказчиком. Ниже — три проработанных варианта с HEX,
> готовыми HSL-каналами для shadcn-переменных и обоснованием.

#### Вариант A — «Лаванда primary» ⭐ Рекомендуется

Лавандовый фиолетовый — основной бренд-цвет (кнопки, активные ссылки, акценты),
садовый зелёный — вторичный (наличие, эко-бейджи), кремовый фон — тёплая база.

| Роль | HEX | HSL channels | Применение |
| --- | --- | --- | --- |
| `--primary` | `#7C5CDB` | `253 67% 61%` | Кнопки CTAs, активные состояния, ссылки |
| `--primary-foreground` | `#FFFFFF` | `0 0% 100%` | Текст на primary |
| `--secondary` | `#4C7A3A` | `97 33% 36%` | Эко-бейджи, наличие, секондари-кнопки |
| `--secondary-foreground` | `#FFFFFF` | `0 0% 100%` | Текст на secondary |
| `--accent` | `#E9DFFB` | `264 67% 92%` | Ховеры, выделения, фоны hover-строк |
| `--accent-foreground` | `#4A2F9C` | `255 54% 39%` | Текст на акценте |
| `--background` | `#FAF7F2` | `40 38% 96%` | Фон страницы (кремовый) |
| `--foreground` | `#241F33` | `257 24% 16%` | Основной текст |
| `--muted` | `#F0EBE3` | `39 33% 92%` | Фоны секций, скелетоны |
| `--muted-foreground` | `#6B6480` | `250 12% 45%` | Вспомогательный текст |
| `--destructive` | `#C0392B` | `9 64% 46%` | Ошибки, нет в наличии |
| `--border` | `#E2DBD0` | `39 28% 85%` | Границы, разделители |
| `--ring` | `#7C5CDB` | `253 67% 61%` | Кольцо фокуса |

**Почему рекомендуется:** лаванда = название бренда, даёт узнаваемость; зелёный
семантически подходит «наличию/эко»; кремовый фон теплее и «природнее», чем
чисто-белый, и не сливается с аквариумно-голубым референсом.

#### Вариант B — «Садовый primary»

Зелёный — основной бренд-цвет (более «природный»,植物-настроение), лаванда — акцент.

| Роль | HEX | HSL channels |
| --- | --- | --- |
| `--primary` | `#4C7A3A` (садовый зелёный) | `97 33% 36%` |
| `--secondary` | `#7C5CDB` (лаванда) | `253 67% 61%` |
| `--accent` | `#E4EFE0` (бледно-зелёный) | `120 28% 91%` |
| `--background` | `#FAF7F2` | `40 38% 96%` |
| `--foreground` | `#1F2A1B` | `120 20% 14%` |

Подходит, если бренд-посыл — «сад/растения» важнее «лаванды» как имени.

#### Вариант C — «Природный приглушённый»

Тона землисто-зелёные + пыльно-лавандовый, насыщенность ниже, фоны теплее.

| Роль | HEX |
| --- | --- |
| `--primary` | `#6B8E4E` (sage green) |
| `--secondary` | `#9B86C9` (пыльная лаванда) |
| `--accent` | `#EFE9DC` |
| `--background` | `#F5F1E8` (льняной) |
| `--foreground` | `#2E2A24` |

Подходит для премиум/ботанического позиционирования.

### 2.2. Светлая / тёмная тема

Токены описаны для **light** по умолчанию. Тёмная тема — через `@media (prefers-color-scheme: dark)` или класс `.dark` на `<html>` (управлять через `next-themes`, если заказчик захочет переключатель). Для dark — инвертированные значения яркости тех же hue (primary остаётся лавандовым, фон `#1A1626`, текст `#F5F1E8`). **MVP: только light.**

### 2.3. Типографика

| Токен / класс | Размер (rem) | Line-height | Weight | Семейство |
| --- | --- | --- | --- | --- |
| `--text-display` (hero h1) | 3.0 / clamp(2rem, 5vw, 3rem) | 1.1 | 700 | Display |
| `--text-h1` | 2.25 | 1.2 | 700 | Display |
| `--text-h2` | 1.75 | 1.25 | 600 | Display |
| `--text-h3` | 1.375 | 1.3 | 600 | Sans |
| `--text-h4` | 1.125 | 1.4 | 600 | Sans |
| `--text-body` | 1.0 (16px) | 1.6 | 400 | Sans |
| `--text-body-sm` | 0.875 | 1.5 | 400 | Sans |
| `--text-caption` | 0.75 | 1.4 | 500 | Sans |

**Шрифты (рекомендация):**
- **Display:** [Manrope](https://fonts.google.com/specimen/Manrope) (700/600) — мягкий, дружелюбный, хорошо читается на кириллице.
- **Sans (body):** [Inter](https://fonts.google.com/specimen/Inter) или системный stack `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- Загружать через `@import url(...)` вверху `styles.css` или через `<link>` в `__root.tsx head`. Учитывать `font-display: swap`.

**Размер базы:** `html { font-size: 16px }` (по умолчанию). Для адаптива можно `clamp`.

### 2.4. Spacing, Radii, Shadows, Breakpoints

```css
@theme {
  /* Radii — мягкие, «природные», не острые */
  --radius-sm: 0.375rem;   /* 6px  — мелкие контролы */
  --radius-md: 0.5rem;     /* 8px  — кнопки, инпуты */
  --radius-lg: 0.75rem;    /* 12px — карточки */
  --radius-xl: 1rem;       /* 16px — крупные блоки, hero */
  --radius-full: 9999px;   /* пилюли, бейджи */

  /* Spacing scale — стандартная Tailwind, но зафиксировать semantic */
  /* container max-width */
  --container-7xl: 80rem;  /* 1280px — макс ширина контента */

  /* Shadows — мягкие, с лавандовым подтоном */
  --shadow-sm: 0 1px 2px 0 hsl(257 24% 16% / 0.05);
  --shadow-md: 0 4px 6px -1px hsl(257 24% 16% / 0.08), 0 2px 4px -2px hsl(257 24% 16% / 0.05);
  --shadow-lg: 0 10px 15px -3px hsl(257 24% 16% / 0.10), 0 4px 6px -4px hsl(257 24% 16% / 0.05);

  /* Breakpoints — mobile-first (Tailwind v4 default compatible) */
  --breakpoint-sm: 40rem;  /* 640px */
  --breakpoint-md: 48rem;  /* 768px */
  --breakpoint-lg: 64rem;  /* 1024px */
  --breakpoint-xl: 80rem;  /* 1280px */
}
```

`--radius` (базовый, для shadcn-компонентов) = `--radius-md` (0.5rem). shadcn
каскадно выводит `--radius-sm/lg` через calc от базового — оставить эту логику.

### 2.5. Что попадает в `styles.css` (итог)

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";   /* ⬅ активировать (сейчас выключен) */

@theme { /* радиусы, тени, брейкпоинты, контейнер — из 2.4 */ }

@layer base {
  :root {
    /* shadcn HSL-каналы, Вариант A */
    --background: 40 38% 96%;
    --foreground: 257 24% 16%;
    --primary: 253 67% 61%;
    /* ... остальные из таблицы Варианта A ... */
    --radius: 0.5rem;
  }
  .dark { /* токены тёмной темы, MVP опционально */ }

  * { box-sizing: border-box; }
  html, body, #app { min-height: 100%; }
  body {
    margin: 0;
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: theme(--font-sans);
    line-height: 1.6;
  }
}
```

---

## 3. Интеграция shadcn/ui в монорепо

shadcn/ui — не npm-пакет, а **генератор исходников**: CLI копирует компоненты
в проект. Нужно правильно разместить их в архитектуре монорепо.

### 3.1. Расположение компонентов (решение по архитектуре)

| Тип компонента | Место | Экспорт | Обоснование |
| --- | --- | --- | --- |
| **Базовые shadcn-примитивы** (Button, Card, Input, Badge, Separator, Skeleton, Tooltip, Sheet, Select, Accordion, Tabs, Dialog, DropdownMenu, NavigationMenu, Carousel, Sonner, Form, Label, Checkbox, ToggleGroup) | `packages/shared/src/ui/<name>/` | Барель `@panda-lavanda/shared` | Кросс-апп (web + telegram-bot позже), не зависят от домена |
| **Утилита `cn()`** | `packages/shared/src/lib/cn.ts` | Барель `@panda-lavanda/shared` | Нужна всем shadcn-компонентам |
| **Доменно-специфичные компоненты** (ProductCard, CategoryTile, ProductGallery, FiltersPanel, PriceTag, StockBadge, QuantityStepper) | `apps/web/src/presentation/components/<name>/` | Локально через `#/presentation/components/...` | Зависят от `IProduct`/домена, только web |
| **Страницы** | `apps/web/src/presentation/pages/<name>-page/` | Локально | Только web |

> ⚠️ В `packages/shared` есть известное нарушение: `lib/result.ts` импортирует
> из `@panda-lavanda/domain`. **shadcn-примитивы НЕ должны добавлять новых
> импортов из `domain`** — они чистые UI (см. AGENTS.md, «Known dependency
> inversion»). Доменные знания живут только в web-only компонентах.

### 3.2. `components.json` (корень `apps/web/`)

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",          // компактнее, лучше для e-commerce
  "rsc": true,                  // TanStack Start поддерживает RSC-стиль
  "tsx": true,
  "tailwind": {
    "config": "",               // v4 — без конфига
    "css": "src/app/styles.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "#/presentation/components",
    "ui": "#/shared-ui",        // ⬅ см. примечание ниже
    "utils": "#/lib/utils",
    "lib": "#/lib",
    "hooks": "#/hooks"
  },
  "iconLibrary": "lucide"
}
```

**⚠️ Сложность с monorepo + shadcn CLI:** CLI ожидает плоский `src/`. Варианты:

1. **(Рекомендуется)** Генерировать shadcn-компоненты в `apps/web/src/shared-ui/`,
   затем при необходимости вручную переносить/копировать кросс-апп штуки в
   `packages/shared/src/ui/` и реэкспортировать. Прагматично: 90% компонентов
   всё равно нужны только web-у.
2. Запускать CLI в `packages/shared/` с кастомным `aliases.ui`. Чище по архитектуре,
   но требует подгонки путей CLI под workspace-структуру.
3. Вручную копировать исходники с [ui.shadcn.com/docs/components](https://ui.shadcn.com)
   сразу в финальные папки — самый контроль, ноль магии CLI.

Финальный выбор способа — за реализующим; документ фиксирует **целевое**
расположение (таблица 3.1).

### 3.3. Зависимости для установки

В `apps/web/package.json` (или `packages/shared`, если компонент идёт туда):

```bash
# Ядро shadcn
npm i class-variance-authority clsx tailwind-merge -w @panda-lavanda/shared
# Radix-примитивы для расширенного набора
npm i @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
      @radix-ui/react-navigation-menu @radix-ui/react-accordion @radix-ui/react-tabs \
      @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-toggle-group \
      @radix-ui/react-separator @radix-ui/react-checkbox @radix-ui/react-label -w @panda-lavanda/shared
# Carousel
npm i embla-carousel-react -w @panda-lavanda/shared
# Тосты
npm i sonner -w @panda-lavanda/web
# Формы + валидация
npm i react-hook-form zod @hookform/resolvers -w @panda-lavanda/web
# Иконки (уже в deps): lucide-react
# Тема (опционально, MVP light-only можно пропустить): next-themes
```

> `@radix-ui/*` и `class-variance-authority`/`clsx`/`tailwind-merge` ставятся в
> `packages/shared` (там живут примитивы). `sonner`, `react-hook-form`, `zod` —
> в `apps/web` (там, где бизнес-форма и тосты).

### 3.4. Утилита `cn()`

`packages/shared/src/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Экспорт через барель `packages/shared/src/index.ts` (добавить `export * from './lib/cn'`).
Все shadcn-компоненты импортируют как `import { cn } from '@panda-lavanda/shared'`.

### 3.5. Карта shadcn-компонентов → блокам/страницам

| shadcn-компонент | Где используется |
| --- | --- |
| `Button` | CTAs везде, «В корзину», «Применить фильтры» |
| `Card` | ProductCard, CategoryTile, блог-карточка |
| `Input` | Поиск, формы, range-инпуты цены |
| `Badge` | бейджи скидки, «Хит», наличие, размер |
| `Separator` | разделители в хедере/футере/фильтрах |
| `Skeleton` | загрузка карточек, галереи, списка |
| `Tooltip` | подсказки у иконок, размера, доставки |
| `Sheet` | мобильное меню, мобильные фильтры |
| `Select` | сортировка каталога, кол-во на странице |
| `Accordion` | фильтры каталога (категория/цена/наличие) |
| `Tabs` | Описание/Характеристики/Отзывы в карточке |
| `Dialog` | быстрый просмотр, модалки |
| `DropdownMenu` | аккаунт, корзина-превью, валюты |
| `NavigationMenu` | основное меню категорий в хедере |
| `Carousel` | hero, ProductGallery, «Хиты», Related |
| `ToggleGroup` | выбор размера (P9/P11), grid/list вид |
| `Sonner` (`Toaster`) | тост «Добавлено в корзину» |
| `Form` + `Label` + `Checkbox` | формы (позже: оформление заказа) |

---

## 4. Глобальный layout

Закрывает wiring-зазор: в текущем `__root.tsx` body рендерит `{children}` без
хедера/футера. Вводим `RootLayout`, оборачивающий все страницы.

### 4.1. Структура

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (мелкая строка)   контакты · доставка · аккаунт   │
├─────────────────────────────────────────────────────────┤
│ Header (sticky)                                                  │
│   [Лого]   [====== Поиск ======]    [♡ избранное] [👤] [🛒 N]   │
│   ──────────── MainNav (NavigationMenu) ────────────            │
│   Каталог · Растения · Деревья · Кустарники · ... (категории)   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   {children}  ← Outlet страницы                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Footer (многоколоночный)                                │
│   Категории | Информация | Контакты | Оплата | Соцсети  │
│   © Panda Lavanda, 2026                                 │
└─────────────────────────────────────────────────────────┘
<Toaster />  ← Sonner, монтируется в RootLayout
```

### 4.2. Header (sticky, `position: sticky; top: 0`)

- **TopBar:** тонкая строка (`h-9`, `text-caption`, `bg-muted`). Слева — телефон/контакты, справа — ссылки «Доставка», «Оплата», «Отзывы», «Контакты». На `< md` скрывается.
- **Основная строка** (`h-16`):
  - Лого слева (текст + иконка `Sprout` из lucide).
  - Поиск по центру — `Input` с иконкой `Search` и кнопкой «Найти». На submit → `/catalog?q=...`.
  - Справа — `IconButton`-стек: избранное (`Heart`), аккаунт (`User`, как `DropdownMenu`), корзина (`ShoppingCart` с `Badge`-счётчиком).
- **MainNav:** горизонтальное меню категорий через `NavigationMenu` (с dropdown-подкатегориями на hover). Активная категория — `text-primary` + подчёркивание. На `< md` — burger-иконка `Menu`, открывает `Sheet` с тем же меню.

### 4.3. Footer

- 4–5 колонок: «Каталог» (список категорий), «Информация» (О нас, Доставка, Оплата, Отзывы, Блог), «Контакты» (телефон, email, адрес), «Мы в соцсетях» (иконки).
- Нижняя строка: © Panda Lavanda, год + способы оплаты (плашинки) + ссылка на политику.
- На `< md` — accordion-сворачиваемые колонки.

### 4.4. Breadcrumbs

Переиспользуемый компонент `Breadcrumbs` (`apps/web/src/presentation/components/breadcrumbs/`),
рендерит путь из `useRouterState` или props. Главная → Каталог → Растения → `<Название товара>`.

---

## 5. Компонентная декомпозиция

### 5.1. Atomic (базовые)

| Компонент | shadcn-основа | Пакет | Props (ключевые) |
| --- | --- | --- | --- |
| `Button` | Button | `@panda-lavanda/shared` | `variant: 'default'\|'secondary'\|'outline'\|'ghost'\|'destructive'\|'link'`, `size`, `asChild` |
| `IconButton` | Button(ghost,size=icon) | shared | `icon`, `label` (aria) |
| `Badge` | Badge | shared | `variant: 'default'\|'secondary'\|'destructive'\|'outline'` |
| `Input` | Input | shared | стандарт input props |
| `Separator` | Separator | shared | `orientation` |
| `Skeleton` | Skeleton | shared | `className` (размер) |
| `Tooltip` | Tooltip | shared | `content`, `children` |

### 5.2. Layout

| Компонент | shadcn-основа | Пакет | Назначение |
| --- | --- | --- | --- |
| `TopBar` | — | web | верхняя мелкая строка |
| `Header` | NavigationMenu, Sheet, DropdownMenu | web | шапка с поиском + меню |
| `MainNav` | NavigationMenu | web | меню категорий |
| `MobileNav` | Sheet | web | мобильное меню |
| `Footer` | — | web | многоколоночный футер |
| `RootLayout` | — | web | обёртка хедер+{children}+футер+Toaster |
| `Breadcrumbs` | — | web | хлебные крошки |
| `Container` | — | web | `max-w-7xl mx-auto px-4` для выравнивания контента |

### 5.3. Commerce (доменно-специфичные)

| Компонент | shadcn-основа | Пакет | Props | Источник данных |
| --- | --- | --- | --- | --- |
| `ProductCard` | Card, Button, Badge | web | `product: IProduct`, `onAddToCart?` | `IProduct` |
| `CategoryTile` | Card | web | `category: {id,name,image}` | новая сущность Category (см. §12) |
| `PriceTag` | — | web | `price: PriceInRub`, `oldPrice?`, `currency` | `IExemplar.price` |
| `StockBadge` | Badge | web | `inStock: boolean` | `IExemplar.inStock` |
| `SizeSelector` | ToggleGroup | web | `exemplars: IExemplar[]`, `value`, `onChange` | `IExemplar[]` (size, price, inStock) |
| `QuantityStepper` | Button, Input | web | `value`, `min`, `max`, `onChange` | — |
| `ProductGallery` | Carousel | web | `images: ImageUrl[]`, `alt` | `IProduct.images` |
| `FiltersPanel` | Accordion, Input, Checkbox, Button | web | `filters: IProductFilters`, `onChange` | `IProductFilters` |
| `SortToolbar` | Select, ToggleGroup | web | `sort`, `view`, `onSortChange` | — |
| `ProductGrid` | — | web | `products: IProduct[]`, `loading`, `view: 'grid'\|'list'` | `IProduct[]` |
| `Pagination` | Button | web | `page`, `totalPages`, `onChange` | `page` из `IProductFilters`, total из репозитория |
| `TabsSpec` | Tabs | web | `description`, `specs[]`, `reviews[]` | `IProduct.description` + справочники |
| `RelatedCarousel` | Carousel, ProductCard | web | `products: IProduct[]` | `getMany({ categoryId })` |

#### `ProductCard` — детальная спецификация (используется в 3+ местах)

```
┌──────────────────────────┐
│  [Badge "Хит"]  [♡]       │  ← угловые бейджи (опционально)
│                          │
│      📷 фото (1:1)        │  ← images[0], object-fit: cover, bg-white
│                          │
├──────────────────────────┤
│ Название товара (2стр)   │  ← name, line-clamp-2
│ Размер · от NNN ₽        │  ← min(exemplars[].price), размер
│ [Badge в наличии/под зак]│  ← StockBadge по exemplars
│           [В корзину ▶]  │  ← Button, icon ShoppingCart
└──────────────────────────┘
```

- Размер: фиксированная ширина в сетке, адаптив (см. §11).
- Цена: если у товара несколько exemplars — показываем «от NNN ₽» (min price), иначе точную цену.
- Hover: лёгкий `shadow-lg`, подъём `-translate-y-0.5`, появление быстрой кнопки.
- Клик по карточке (кроме кнопки) → `/product/:id`.

---

## 6. Страница 1 — Главная (`/`)

**Файлы:** маршрут `src/app/routes/index.tsx` (есть), страница `src/presentation/pages/home-page/home-page.tsx` (placeholder → переписать).

### 6.1. Блочная структура (сверху вниз)

| # | Блок | Источник на aquaplant | Компоненты |
| --- | --- | --- | --- |
| 1 | Header (глобальный) | шапка | из RootLayout |
| 2 | **Hero-карусель** | большой баннер вверху | `Carousel` 2–3 слайда: промо-фото + заголовок + CTA «В каталог» |
| 3 | **Плитка категорий** | сетка иконок-категорий | `CategoryTile` × 6–8, сетка `grid-cols-2 sm:3 md:4 lg:6` |
| 4 | **«Хиты продаж»** | сетка топ-товаров | секция: заголовок + «смотреть все» → `ProductGrid`/`Carousel` из `ProductCard` (8 шт) |
| 5 | **Промо-блоки (2 колонки)** | баннеры доставки/акций | две `Card` с фоном-изображением и текстом |
| 6 | **«Новинки»** | сетка новых товаров | как блок 4, `getMany({ page: 1 })` сортировка по новизне |
| 7 | **Бренды / преимущества** | лого-строка или 3–4 преимущества (доставка, гарантия, качество) | `Card` с иконкой + текст |
| 8 | **Блог** | 3 карточки статей | `Card` (превью + заголовок + дата) — данные из будущего блога |
| 9 | Footer (глобальный) | футер | из RootLayout |

### 6.2. Hero-карусель (детально)

- Высота `clamp(280px, 50vh, 480px)`, full-width внутри `Container`.
- `Carousel` (embla), автопрокрутка 5–7с, пауза на hover, стрелки навигации, точки-индикаторы.
- Слайд: фоновое изображение (растения) + оверлей-градиент + текстовый блок слева/по центру (display-заголовок + подзаголовок + `Button` CTA).
- a11y: `aria-roledescription="carousel"`, кнопки с `aria-label`, слайды с `aria-label="N из M"`.
- Состояния: загрузка → `Skeleton` во весь hero; ошибка → статичный дефолтный слайд.

### 6.3. Сетка «Хиты» / «Новинки»

- Заголовок секции (`h2`) + ссылка-стрелка «Смотреть все» справа → `/catalog`.
- Продукты в `Carousel` (по 4 на десктопе) или `ProductGrid` (`grid-cols-2 md:3 lg:4`).
- Получение данных: `IProductsRepository.getMany({ page: 1 })` (на главной — первые 8, нет фильтра «хит» в модели → пока по новизне/наличию; поле «hit» добавить позже, см. §12).

### 6.4. Промо-блоки (2 колонки)

- Две карточки рядом (`grid-cols-1 md:grid-cols-2`, gap-4).
- Пример: «Доставка по России от N ₽ / бесплатно от M ₽» + «Гарантия приживаемости».
- Фон: изображение или градиент акцентного цвета, текст контрастный.

### 6.5. Адаптив главной

- **Mobile (`<sm`):** hero короче, плитка категорий 2 колонки, продукты 2 колонки, промо-блоки в столбик, блог 1 колонка (или горизонтальный скролл).
- **Tablet (`md`):** 3 колонки продуктов, плитка 4 колонки.
- **Desktop (`lg+`):** 4 колонки продуктов, плитка 6 колонок, контент в `Container` (max-w-7xl).

---

## 7. Страница 2 — Каталог (`/catalog` и `/category/:categoryId`)

**Файлы:** новый маршрут `src/app/routes/catalog.tsx` (и опционально `category.$categoryId.tsx`), новая страница `src/presentation/pages/catalog-page/`.

### 7.1. Layout

```
┌─ Breadcrumbs ─────────────────────────────────────────────┐
│ Главная / Каталог / Растения                               │
├─ Title + count ────────────────────────────────────────────┤
│ Растения (43 товара)                                       │
├──────────────┬────────────────────────────────────────────┤
│              │ [Сортировка: популярные ▾] [⊞ grid | ☰ list] [по 20 ▾]  │
│  Filters     ├────────────────────────────────────────────┤
│  (sticky,    │                                            │
│   Accordion) │   ProductGrid (3–4 колонки)                │
│              │   [ProductCard] [ProductCard] [ProductCard]│
│  • Категория │   [ProductCard] [ProductCard] [ProductCard]│
│  • Цена      │   ...                                      │
│  • Наличие   │                                            │
│  [Применить] │                                            │
│  [Сбросить]  │   ◀ Pagination ▶                           │
│              │                                            │
├──────────────┴────────────────────────────────────────────┤
│  На mobile: фильтры → Sheet по кнопке «Фильтры (N)»       │
└────────────────────────────────────────────────────────────┘
```

### 7.2. Хлебные крошки и заголовок

- `Breadcrumbs`: Главная / Каталог / `<Название категории>` (если есть Category-сущность).
- Заголовок — название категории или «Каталог», счётчик товаров рядом (`text-muted-foreground`).

### 7.3. Левый сайдбар фильтров (`FiltersPanel`)

- Ширина `w-64`, `position: sticky; top: <header-height>`, на десктопе.
- Состоит из `Accordion`:
  - **Категория:** список/дерево категорий (RadioGroup или Checkbox). → `IProductFilters.categoryId`.
  - **Цена:** два `Input` (от/до) или range-slider. ⚠️ В `IProductFilters` нет поля `priceMin/priceMax` — **нужно расширить фильтры** (см. §12) либо фильтровать клиентски по `exemplars[].price`.
  - **Размер:** Checkbox по `Size.P9`/`Size.P11`. ⚠️ тоже нет в фильтрах — расширить.
  - **Наличие:** Checkbox «только в наличии». ⚠️ нет в фильтрах — клиентский фильтр по `exemplars.some(e => e.inStock)` или расширить.
- Кнопки: «Применить» (primary), «Сбросить» (ghost).
- **На `< md`:** сайдбар скрыт, вместо него `Button` «Фильтры» открывает `Sheet` с тем же `FiltersPanel`.

### 7.4. Тулбар сортировки (`SortToolbar`)

- `Select` сортировки: популярные / дешевле / дороже / новизна. ⚠️ сортировка не в `IProductFilters` — клиентская сортировка `Product[]` или расширить порт.
- `ToggleGroup` (grid/list) — переключение вида сетки.
- `Select` кол-ва на странице: 20 / 40 / 60. ⚠️ `PAGE_SIZE = 20` захардкожен в репозитории — расширить или оставить 20.

### 7.5. ProductGrid

- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6`.
- При `view: 'list'` → `grid-cols-1` с горизонтальной раскладкой карточки (фото слева, инфо справа).
- Каждый элемент — `ProductCard`.

### 7.6. Пагинация

- Кнопки «‹», «1 2 3 … N», «›», текущая — `variant='default'`, остальные `outline`.
- `page` из URL query (`/catalog?page=2`) или состояния; передаётся в `IProductFilters.page`.
- Общее кол-во страниц = `ceil(total / PAGE_SIZE)`, где `total` — из репозитория. ⚠️ `getMany` сейчас возвращает `IProduct[]` без `total` — **нужно расширить контракт** на `{ items, total }` (см. §12).

### 7.7. Состояния

| Состояние | Что показываем |
| --- | --- |
| Loading (первичная) | `Skeleton`-карточки в сетке (12 шт) |
| Loading (смена фильтра/страницы) | лёгкий оверлей/спиннер поверх текущей сетки, сетка не пропадает |
| Empty (нет товаров по фильтру) | иконка `SearchX` + «Ничего не найдено» + кнопка «Сбросить фильтры» |
| Error | `NetworkError`-сообщение + кнопка «Повторить» (через `Either` из репозитория, без throw) |

### 7.8. Доставка данных (привязка к модели)

- TanStack Route `loader`: `const products = await productsRepo.getMany({ categoryId, page })`.
- `useLoaderData` / `useSearch` для чтения query-параметров (`page`, `categoryId`, фильтры).
- Все вызовы оборачивать в `tryCatch(() => repo.getMany(...), crashReporter)` → `Either<AppError, IProduct[]>`.

---

## 8. Страница 3 — Карточка товара (`/product/$productId`)

**Файлы:** новый маршрут `src/app/routes/product.$productId.tsx`, новая страница `src/presentation/pages/product-page/`.

### 8.1. Layout

```
┌─ Breadcrumbs ─────────────────────────────────────────────┐
│ Главная / Каталог / Растения / Лаванда узколистная         │
├─────────────────────────┬──────────────────────────────────┤
│                         │ Лаванда узколистная (h1)         │
│   ProductGallery        │ ★★★★☆ (12)  ·  Артикул: ...      │
│                         │                                  │
│   [Большое фото]        │ от 290 ₽                         │  ← PriceTag
│                         │ Размер: [P9] [P11 ◉]              │  ← SizeSelector
│   [мини] [мини] [мини]  │                                  │
│                         │ [Badge в наличии: 8 шт]          │  ← StockBadge
│                         │                                  │
│                         │ Кол-во: [− 1 +]   [В корзину ▶]  │  ← QuantityStepper + Button
│                         │                                  │
│                         │ 🚚 Доставка по РФ от 460 ₽       │  ← Tooltip-блок
│                         │ ✓ Гарантия приживаемости          │
├─────────────────────────┴──────────────────────────────────┤
│  [Описание] [Характеристики] [Отзывы (12)]                  │  ← TabsSpec
│  <prose longread описание> ...                              │
├─────────────────────────────────────────────────────────────┤
│  С этим товаром покупают                                     │  ← RelatedCarousel
│  [ProductCard] [ProductCard] [ProductCard] [ProductCard] ▶  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2. ProductGallery (слева, ~55% ширины)

- `Carousel` (embla): большое фото сверху (`aspect-square` или `4/3`, `object-contain`, `bg-white`, рамка).
- Миниатюры снизу горизонтальным скроллом (`images[]`, клик → переключение слайда).
- Hover на большом фото → зум (cursor-zoom-in, лупа или `transform: scale(1.5)` по позиции курсора).
- a11y: `role="region"`, `aria-label`, миниатюры — кнопки с `aria-label="Фото N"`.
- `images` берётся из `IProduct.images: ImageUrl[]`. Если массив пуст → placeholder `ImageOff`.
- Состояния: loading → `Skeleton aspect-square`; пустой массив → заглушка.

### 8.3. Блок покупки (справа, ~45%)

- **Заголовок** (`h1`, `text-h1`): `IProduct.name`.
- **Рейтинг** (заглушка): звёзды + кол-во отзывов → таб «Отзывы». ⚠️ в модели нет рейтинга/отзывов — MVP показываем заглушку «Отзывов пока нет» или убираем (см. §12).
- **Цена** (`PriceTag`): «от NNN ₽» если несколько exemplars, иначе точная. Обновляется при выборе размера. Формат `Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 })`.
- **Выбор размера** (`SizeSelector` на `ToggleGroup`): кнопки `P9` / `P11` по `exemplars`. Выбранный exemplar определяет цену и наличие. Недоступные (не `inStock`) — disabled с пометкой «под заказ». `value` = `exemplar.id` или `exemplar.size`.
- **Наличие** (`StockBadge`): на основе `exemplar.inStock` выбранного размера. «В наличии» / «Под заказ» / «Нет в наличии».
- **Количество** (`QuantityStepper`): `[−] [1] [+]`, `min=1`, `max` ограничен (нет поля stock-quantity в модели, только `inStock: boolean` → `max=99` условно).
- **CTA** (`Button` primary, full-width на mobile): «В корзину» + иконка. По клику → добавление в корзину + `toast.success('Добавлено в корзину', { action: 'Перейти' })` через Sonner.
- **Инфо-блок:** доставка (460 ₽ / бесплатно от 10 000 ₽), гарантия — мелким текстом с иконками и `Tooltip`.

### 8.4. TabsSpec (ниже)

- `Tabs` с тремя табами:
  - **Описание** — `IProduct.description`, рендер через `prose` (`@tailwindcss/typography`, **активировать плагин**). Поддержка HTML/markdown.
  - **Характеристики** — таблица ключ-значение. ⚠️ в `IProduct` только `category` (opaque UUID) — характеристики нужно либо выводить из size/цены/наличия, либо расширять модель (см. §12). MVP: размер, цена, наличие, категория.
  - **Отзывы** — список отзывов + форма. ⚠️ нет в модели → MVP заглушка «Будьте первым, кто оставит отзыв».

### 8.5. RelatedCarousel (внизу)

- Заголовок «С этим товаром покупают».
- `Carousel` из `ProductCard`, данные — `productsRepo.getMany({ categoryId: product.category })` (первые 8, исключая текущий по id).

### 8.6. Состояния

| Состояние | Что показываем |
| --- | --- |
| Loading | `Skeleton` для галереи + блока покупки |
| Not Found (`getById` → `NotFoundError`) | страница 404: «Товар не найден» + ссылка в каталог |
| Error | `NetworkError`-блок + «Повторить» |
| Нет exemplars | «Товар временно недоступен» вместо блока покупки |

### 8.7. Доставка данных

- TanStack Route `loader` с параметром `$productId`: `const product = await productsRepo.getById(productId)`.
- `Either<NotFoundError, IProduct>` → ветвление в компоненте.
- Related — второй вызов `getMany` (можно параллельно через `Promise.all` в loader).

---

## 9. Состояния и интерактив

Единые правила для всех интерактивных компонентов:

| Состояние | Реализация |
| --- | --- |
| **Default** | базовые токены |
| **Hover** | `hover:` классы, `transition-colors duration-150`; карточки — лёгкий `shadow-lg` + `-translate-y-0.5` |
| **Focus-visible** | `outline-none` + `ring-2 ring-ring ring-offset-2 ring-offset-background`. **Всегда видимый фокус** (не убирать) |
| **Active** | `active:` чуть темнее primary, `scale-[0.98]` на кнопках |
| **Disabled** | `disabled:opacity-50 disabled:pointer-events-none` |
| **Loading** | `Skeleton` вместо контента, кнопки — `disabled` + `Loader2` spin (lucide) |
| **Empty** | иконка + текст + CTA (сбросить/повторить) |
| **Error** | `destructive`-блок с типом ошибки (`AppError` subclass) и кнопкой «Повторить» |
| **Selected** (toggle/size) | `variant='default'` (primary), остальные `outline` |

**Тосты (Sonner):** добавление в корзину → `toast.success`; ошибки → `toast.error`.
Монтируется `<Toaster />` в `RootLayout`.

**Правило ошибок:** все репозиторий-вызовы через `tryCatch`/`tryCatchSync`
(`@panda-lavanda/shared`), результат `Either<AppError, T>`. **Никаких throw
через границы слоёв.** В UI — ранний return по `Either.isLeft`.

---

## 10. Доступность (WCAG 2.1 AA)

| Требование | Реализация |
| --- | --- |
| Семантика | `<header>`, `<nav>`, `<main>`, `<footer>`, `<article>`, `<aside>`; `<h1>` один на странице |
| Видимый фокус | `:focus-visible` ring на всех интерактивных элементах, `tabindex` корректный |
| ARIA | `aria-label` на иконочных кнопках, `aria-current="page"` в навигации, `role="carousel"`/`role="region"` для каруселей, `aria-expanded` для accordion/dropdown |
| Изображения | `alt` на всех `images: ImageUrl[]` (использовать `IProduct.name` + « — фото N»); декоративные — `alt=""` |
| Контраст | ≥ 4.5:1 для текста, ≥ 3:1 для крупного/UI. Палитра §2 проверена под это |
| Клавиатура | все действия доступны с клавиатуры; карусели — стрелками; фильтры/galley — Tab-порядок логичный; модалки — фокус-ловушка (Radix даёт) |
| Размер цели | минимум 24×24px (лучше 44×44 на mobile) для кликабельных |
| Репетишн | никаких миганий > 3Hz; автопрокрутка карусели — пауза на hover/focus |

---

## 11. Адаптивность

### 11.1. Брейкпоинты (mobile-first)

| Токен | Ширина | Устройство |
| --- | --- | --- |
| (база) | 0–639px | mobile (375+) |
| `sm` | 640px | большой mobile / мелкий tablet |
| `md` | 768px | tablet |
| `lg` | 1024px | desktop |
| `xl` | 1280px | wide desktop (max-w-7xl Container) |

### 11.2. Поведение блоков по брейкпоинтам

| Блок | `<sm` | `sm–md` | `md–lg` | `lg+` |
| --- | --- | --- | --- | --- |
| Header MainNav | burger → Sheet | Sheet | inline меню | inline меню |
| Hero carousel | h 280px, текст внизу | h 320px | h 400px | h 480px |
| Плитка категорий | 2 col | 3 col | 4 col | 6 col |
| ProductGrid (главная/каталог) | 2 col | 2 col | 3 col | 4 col |
| Сайдбар фильтров | Sheet по кнопке | Sheet | sticky sidebar | sticky sidebar |
| Карточка товара layout | 1 col (галерея над) | 1 col | 2 col | 2 col |
| TabsSpec | вертикально/accordion | tabs | tabs | tabs |
| Footer колонки | accordion | 2 col | 4 col | 5 col |

### 11.3. Контейнер

`Container`: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`. Применять ко всем секциям с контентом.

---

## 12. Wiring-зазоры и рекомендации

Чтобы верстка заработала на реальных данных, нужно закрыть эти пробелы
(часть — кодом, часть — расширением домена). Маркировка: 🔴 блокер для верстки,
🟡 улучшение.

| # | Зазор | Действие | Маркировка |
| --- | --- | --- | --- |
| 1 | **Глобальный layout отсутствует** | Создать `RootLayout` (хедер+футер+Toaster), обернуть `{children}` в `__root.tsx` | 🔴 |
| 2 | **Нет composition root для `IProductsRepository`** | В `apps/web/src/app/providers/` инстанцировать `createDb(process.env.DATABASE_URL)` + `new DrizzleProductsRepository(db)` | 🔴 |
| 3 | **Данные не доходят до UI** | Использовать TanStack Route `loader` с `productsRepo.getMany/getById`, передать через `useLoaderData`; либо React Context-провайдер | 🔴 |
| 4 | **`styles.css` без `@theme`** | Добавить токены §2.5 (палитра, типографика, радиусы) | 🔴 |
| 5 | **`@tailwindcss/typography` не активен** | Добавить `@plugin "@tailwindcss/typography";` в `styles.css` (для описания товара) | 🔴 |
| 6 | **`getMany` не возвращает `total`** | Расширить контракт `IProductsRepository.getMany` → `{ items: IProduct[]; total: number }` (нужно для пагинации) | 🔴 |
| 7 | **`IProductFilters` бедный** | Добавить `priceMin?`, `priceMax?`, `sizes?: Size[]`, `inStockOnly?: boolean`, `sort?`, `pageSize?` — для фильтров каталога | 🟡 |
| 8 | **Нет сущности Category** | `category: UniqueId` — opaque UUID. Добавить `ICategory { id, name, slug?, parentId? }` + порт `ICategoriesRepository` + таблицу — для меню, плитки категорий, хлебных крошек | 🟡 |
| 9 | **Нет рейтинга/отзывов** | MVP — заглушки; позже — `IReview` + `rating` на `IProduct` | 🟡 |
| 10 | **Нет «хит/новинка»** | Поле/флаг для блоков «Хиты/Новинки» на главной; MVP — сортировка по id (новизна) | 🟡 |
| 11 | **Нет корзины** | MVP — локальная корзина (Context + localStorage), позже — бэкенд | 🟡 |
| 12 | **Нет поиска** | Реализовать `/catalog?q=...` (client-фильтр по name или полнотекст на бэке) | 🟡 |

**Порядок закрытия перед версткой:** 4, 5 (токены, можно сразу) → 1 (layout) → 2, 3 (data wiring) → 6 (total) → затем верстка страниц; 7–12 параллельно/после.

---

## 13. План реализации / чек-лист

Последовательность шагов верстки (каждый — коммит):

### Этап 0 — Фундамент
- [ ] **0.1** Заполнить `apps/web/src/app/styles.css`: `@theme` (радиусы, тени, брейкпоинты, контейнер), `:root` shadcn-переменные Варианта A (или выбранного), `@plugin "@tailwindcss/typography"`, базовый reset.
- [ ] **0.2** Утилита `cn()` в `packages/shared/src/lib/cn.ts`, экспорт через барель.
- [ ] **0.3** Установить зависимости (§3.3): `@radix-ui/*`, `cva`, `clsx`, `tailwind-merge`, `embla-carousel-react`, `sonner`, `react-hook-form`, `zod`, `@hookform/resolvers`.
- [ ] **0.4** `components.json` в `apps/web/`. Сгенерировать базовые shadcn-компоненты (Button, Card, Input, Badge, Separator, Skeleton, Label, Checkbox, Tooltip, Sheet, Select, Accordion, Tabs, Dialog, DropdownMenu, NavigationMenu, Carousel, ToggleGroup, Sonner).

### Этап 1 — Layout
- [ ] **1.1** `Container`, `RootLayout` (хедер+футер+`{children}`+`<Toaster/>`). Обернуть в `__root.tsx`.
- [ ] **1.2** `Header`: TopBar, основная строка (лого, поиск, иконки), MainNav (NavigationMenu) + MobileNav (Sheet).
- [ ] **1.3** `Footer` (многоколоночный, адаптив в accordion на mobile).
- [ ] **1.4** `Breadcrumbs`.

### Этап 2 — Data wiring
- [ ] **2.1** Provider `productsRepo` в `apps/web/src/app/providers/` (`createDb` + `DrizzleProductsRepository`).
- [ ] **2.2** Расширить `IProductsRepository.getMany` → `{ items, total }` (§12 #6).
- [ ] **2.3** TanStack loaders для каталога (`getMany`) и карточки (`getById`).

### Этап 3 — Компоненты каталога
- [ ] **3.1** `PriceTag`, `StockBadge`, `QuantityStepper`.
- [ ] **3.2** `ProductCard` (использует Card, Badge, Button).
- [ ] **3.3** `ProductGrid`, `Pagination`.
- [ ] **3.4** `FiltersPanel` (Accordion), `SortToolbar` (Select, ToggleGroup).

### Этап 4 — Страницы
- [ ] **4.1** Главная (`home-page.tsx`): hero-карусель, плитка категорий, «Хиты», промо-блоки, «Новинки», преимущества, блог.
- [ ] **4.2** Каталог (`catalog-page/` + маршрут `catalog.tsx`): сайдбар фильтров + тулбар + ProductGrid + пагинация. Состояния loading/empty/error.
- [ ] **4.3** Карточка товара (`product-page/` + маршрут `product.$productId.tsx`): ProductGallery + блок покупки (SizeSelector по exemplars) + TabsSpec + RelatedCarousel.

### Этап 5 — Полировка
- [ ] **5.1** Состояния везде (hover/focus/active/disabled/loading/empty/error).
- [ ] **5.2** Тосты Sonner (добавление в корзину).
- [ ] **5.3** a11y-проход (§10): семантика, фокус, aria, alt, контраст.
- [ ] **5.4** Адаптив-проход (§11) на брейкпоинтах 375/640/768/1024/1280.

### Файлы, затрагиваемые реализацией

| Путь | Действие |
| --- | --- |
| `apps/web/src/app/styles.css` | переписать (токены, плагин) |
| `apps/web/src/app/routes/__root.tsx` | обернуть children в RootLayout |
| `apps/web/src/app/routes/catalog.tsx` | **новый** маршрут |
| `apps/web/src/app/routes/product.$productId.tsx` | **новый** маршрут |
| `apps/web/src/app/providers/products.ts` | **новый** composition root |
| `apps/web/src/presentation/pages/home-page/home-page.tsx` | переписать (placeholder → реализация) |
| `apps/web/src/presentation/pages/catalog-page/` | **новый** |
| `apps/web/src/presentation/pages/product-page/` | **новый** |
| `apps/web/src/presentation/components/*` | **новые** доменные компоненты |
| `apps/web/components.json` | **новый** (shadcn config) |
| `packages/shared/src/lib/cn.ts` | **новый** |
| `packages/shared/src/ui/*` | **новые** shadcn-примитивы |
| `packages/shared/src/index.ts` | добавить экспорт cn |
| `packages/domain/src/ports/products-repository.port.ts` | расширить `getMany` (items+total), опц. фильтры |
| `packages/domain/src/products/product-filters.ts` | расширить (цена, размеры, наличие, sort) |

---

## Приложение. Ссылки

- Референс: https://aquaplant.ru/
- Скриншоты: `apps/web/public/refs/main-page.png`, `products-list.png`, `single-product.png`
- shadcn/ui: https://ui.shadcn.com
- Tailwind v4 `@theme`: https://tailwindcss.com/docs/theme
- Архитектура проекта: `architecture.md`, `AGENTS.md`
