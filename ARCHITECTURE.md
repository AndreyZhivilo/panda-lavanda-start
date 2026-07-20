# Panda Lavanda — Architecture

Monorepo with **npm workspaces**. Clean Architecture layering across shared
packages, with TanStack Start (web) and Telegram Bot as independent apps.

## Repository structure

```
panda-lavanda-start/
├── apps/
│   ├── web/                     # TanStack Start (React 19 + Tailwind v4)
│   └── telegram-bot/            # Telegram Bot (placeholder)
│
└── packages/
    ├── domain/                  # @panda-lavanda/domain — pure TS, 0 framework deps
    │   └── src/
    │       ├── entities/            # Business entities
    │       ├── value-objects/       # Value objects
    │       ├── ports/               # Interfaces (contracts for infrastructure)
    │       └── errors.ts            # AppError, NetworkError, AuthError, …
    │
    ├── application/             # @panda-lavanda/application — use cases
    │   └── src/
    │
    ├── infrastructure/          # @panda-lavanda/infrastructure — port implementations
    │   └── src/
    │       ├── api/                 # HTTP adapters (CrashReporterService, …)
    │       └── storage/             # localStorage / DB adapters
    │
    ├── shared/                  # @panda-lavanda/shared — cross-cutting utilities
    │   └── src/
    │       ├── lib/                 # tryCatch / tryCatchSync (@sweet-monads/either)
    │       ├── types/
    │       ├── config/
    │       └── ui/
    │
    └── db/                     # @panda-lavanda/db — Drizzle ORM schema & client
        ├── src/
        │   ├── schema/              # pg tables/enums (products, exemplars, …)
        │   └── client.ts            # createDb(connectionString) → Drizzle instance
        └── drizzle.config.ts        # drizzle-kit config (migrations, studio)
```

> **Note on `db`:** unlike the pure-TS packages, this one is Node-only
> (PostgreSQL driver). It owns the persistence schema and exposes a typed
> `Db` instance; concrete repository implementations live in
> `infrastructure` and consume it via the `@panda-lavanda/domain` ports.

## Dependency rule (Clean Architecture)

```
shared ◄── domain ◄── application ◄── web / telegram-bot
               ▲                        ▲
               └── infrastructure ───────┘ (via ports)
```

| Package          | May import                          | May NOT import          |
| ---------------- | ----------------------------------- | ----------------------- |
| `shared`         | itself (pure TS utils)               | domain, frameworks     |
| `domain`         | `shared`                            | React, external libs   |
| `application`    | `domain`, `shared`                  | React, `infrastructure` |
| `infrastructure` | `domain` (ports), `shared`, `db`     | React, `app` code      |
| `db`             | `drizzle-orm`, `shared`             | domain, app code       |
| `web`            | all packages + own `presentation/`   | —                       |
| `telegram-bot`    | `application`, `infrastructure`, etc. | —                       |

The **only place** that wires concrete infrastructure is the app's composition
root (`web/src/app/composition-root/`). No other layer imports `infrastructure`
directly.

## Internal packages (no build step)

All `packages/*` use the **internal package** pattern: their `package.json`
points directly at TypeScript source, and the consuming app's bundler (Vite)
transpiles them. No per-package build step.

## Cross-package imports

Between packages, always use the **package name** (resolved via npm workspace
symlinks), not path aliases:

```ts
import { AppError } from '@panda-lavanda/domain'
import { tryCatch } from '@panda-lavanda/shared'
```

Within `apps/web/`, use `#/*` subpath imports for app-internal paths:

```ts
import { HomePage } from '#/presentation/pages/home-page'
```

## Adding a workspace package

1. Create `packages/<name>/package.json` with scope `@panda-lavanda/<name>`.
2. Create `packages/<name>/tsconfig.json` extending `../../tsconfig.json`.
3. Add source under `packages/<name>/src/` with an `index.ts` barrel.
4. In the consuming app's `package.json`, add `"@panda-lavanda/<name>": "*"`.
5. Run `npm install` from the repo root.

## Web app (`apps/web/`)

### Routing

TanStack Start requires file-based route generation for build-time manifest
and code splitting. Route files live in `src/app/routes/` and are **thin** —
they only import a page component from `src/presentation/pages/`.

```tsx
// apps/web/src/app/routes/index.tsx — thin wrapper
import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '#/presentation/pages/home-page'

export const Route = createFileRoute('/')({ component: HomePage })
```

### Route configuration notes

- In `vite.config.ts`, `routesDirectory` and `generatedRouteTree` are relative
  to `srcDirectory` (`./src`), so use `./app/routes` (not `./src/app/routes`).
- In `tsr.config.json`, paths are relative to the app root (`apps/web/`),
  so use `./src/app/routes`.
- `routeFileIgnorePattern: 'routeTree\\.gen'` excludes the generated file.

### Scripts

Run from the **repo root**:

```
npm run dev:web        # Start TanStack Start dev server
npm run build:web      # Production build (client + SSR)
npm run dev:bot        # Start Telegram Bot
```

## Data-flow example

User opens `/profile` → `web/src/app/routes/profile.tsx` (thin route)
renders `web/src/presentation/pages/profile-page` → a hook calls
`@panda-lavanda/application` use case → the use case depends on
`IProfileRepository` from `@panda-lavanda/domain` (port) → the concrete
`ProfileApiRepository` in `@panda-lavanda/infrastructure` performs the
HTTP request → returns a `Profile` entity from `@panda-lavanda/domain`.
