# Panda Lavanda — Architecture

Monorepo with **npm workspaces**. Clean Architecture layering across shared
packages, with TanStack Start (web) and Telegram Bot as independent apps.

## Repository structure

```
panda-lavanda-start/
├── apps/
│   ├── web/                     # TanStack Start (React 19 + Tailwind v4)
│   ├── api/                     # @panda-lavanda/api — Fastify + Drizzle backend
│   │   ├── src/
│   │   │   ├── schema/              # pg tables/enums (products, exemplars, …)
│   │   │   ├── db/client.ts         # createDb(connectionString) → Drizzle instance
│   │   │   ├── repositories/        # Drizzle-backed repository (implements domain ports)
│   │   │   ├── routes/              # Fastify REST endpoints
│   │   │   └── plugins/db.ts        # registers the db connection + repo
│   │   ├── scripts/seed.ts          # dev-only seed script
│   │   └── drizzle.config.ts        # drizzle-kit config (migrations, studio)
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
    │       ├── repositories/        # HTTP-backed adapters (HttpProductsRepository)
    │       └── storage/             # localStorage / file-storage adapters
    │
    └── shared/                  # @panda-lavanda/shared — cross-cutting utilities
        └── src/
            ├── lib/                 # tryCatch / tryCatchSync (@sweet-monads/either)
            ├── types/
            ├── config/
            └── ui/
```

> **Note on `apps/api`:** this is the dedicated backend service (Fastify +
> Drizzle). It owns the persistence schema, the Drizzle client, the migrations
> and the seed script, and exposes REST endpoints over the domain entities.
> Repository implementations there use `import type` for the domain port types
> (no runtime dependency on `@panda-lavanda/domain`). Client apps (`web`,
> `telegram-bot`) talk to it over HTTP via `HttpProductsRepository` in
> `infrastructure` — no process imports a database driver.

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
| `infrastructure` | `domain` (ports), `shared`           | React, `app` code, db drivers |
| `web`            | all packages + own `presentation/`   | db drivers (talks to `api` over HTTP) |
| `api`            | `domain` (types only), `shared`, `drizzle-orm`, `fastify` | React, `infrastructure`, other apps |
| `telegram-bot`    | `application`, `infrastructure`, etc. | —                       |

The **only place** that wires concrete infrastructure is each app's composition
root (`web/src/app/composition-root/`, `api/src/plugins/db.ts`). No other layer
imports `infrastructure` or a database driver directly.

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
npm run dev:web        # Start TanStack Start dev server (port 3000)
npm run dev:api        # Start the Fastify + Drizzle backend (port 4000)
npm run dev:all        # Start both web and api concurrently
npm run build:web      # Production build (client + SSR)
npm run dev:bot        # Start Telegram Bot
npm run migrate:api    # Apply Drizzle migrations (apps/api)
npm run generate:api   # Generate a new Drizzle migration from the schema
npm run seed:api       # Wipe + fill the DB with test garden plants
```

The web app and the backend run as **separate processes**. In development, start
both with `npm run dev:all` (or `dev:web` + `dev:api` in two terminals). The web
app calls the backend at `BACKEND_URL` (default `http://localhost:4000`).

## Data-flow example

User opens `/catalog` → `web/src/app/routes/catalog.tsx` (thin route) renders
`web/src/presentation/pages/catalog-page` → a hook calls the `getProducts`
server function → `GetProductsUseCase` (in `@panda-lavanda/application`) depends
on `IProductsRepository` from `@panda-lavanda/domain` (port) → the concrete
`HttpProductsRepository` in `@panda-lavanda/infrastructure` performs the HTTP
request to `apps/api` → the backend's `ProductsRepository` (Drizzle-backed)
queries PostgreSQL and returns `IProduct` entities → serialized as JSON over
HTTP → mapped back to `IProduct` and returned to the use case → folded into
`Either<Error, Paginated<IProduct>>` by `tryCatch`.
