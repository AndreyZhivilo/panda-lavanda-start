# AGENTS.md

Workspace guide for ZCode agents. Read this before editing.
Authoritative architecture detail lives in **`architecture.md`** — read it
before touching layer boundaries or adding packages.

## What this is

npm-workspaces monorepo for **Panda Lavanda** (an e-commerce catalog of garden plants). Clean Architecture layering across shared packages; three independent
apps consume them (`web`, `api`, `telegram-bot`).

## Layout

```
apps/
  web/            @panda-lavanda/web   — TanStack Start (React 19 + Tailwind v4)
  api/            @panda-lavanda/api   — Fastify + Drizzle backend (PostgreSQL)
  telegram-bot/   @panda-lavanda/telegram-bot — placeholder entry point
packages/
  shared/         cross-cutting utils (tryCatch, types, config, ui)
  domain/         entities, value-objects, ports (interfaces), AppError hierarchy
  application/    use cases (GetProductsUseCase, ToggleFavoriteProductUseCase, GetCurrentUserUseCase)
  infrastructure/ port implementations (HTTP repos, CrashReporterService, storage)
```

> The backend owns the Drizzle schema, the DB client, migrations and the seed
> script under `apps/api/`. Client apps talk to it over HTTP — no app except
> `apps/api` imports a database driver.

## Commands (run from repo root)

| Task              | Command                         |
| ----------------- | ------------------------------- |
| Dev (web)         | `npm run dev` / `npm run dev:web` |
| Dev (api)         | `npm run dev:api`               |
| Dev (web + api)   | `npm run dev:all`               |
| Dev (bot)         | `npm run dev:bot`               |
| Build (web only)  | `npm run build` / `npm run build:web` |
| Tests (web)       | `npm run test` (Vitest)         |
| Regen route tree  | `npm run generate-routes`       |
| Typecheck a pkg   | `npx tsc --noEmit` in the package dir |
| Drizzle generate  | `npm run generate:api`          |
| Drizzle migrate   | `npm run migrate:api`           |
| Drizzle studio    | `npm run studio:api`            |
| Seed (dev)        | `npm run seed:api`              |

There is **no repo-wide build/typecheck/lint script**. Typecheck per package
with `tsc --noEmit`. The root `build` only builds the web app.

## Architecture rules (critical)

Dependency direction (see `architecture.md` for the full table):

```
shared ◄── domain ◄── application ◄── web / telegram-bot
               ▲                        ▲
               └── infrastructure ──────┘ (via ports; HTTP adapters talk to `api`)
                                  
                  api ──► drizzle ──► postgres
                  (owns schema + repositories; type-only domain imports)
```

- **`domain`** is pure TS, zero framework deps. No React, no external libs.
- **Ports** (e.g. `IProductsRepository`) are interfaces defined **in domain**.
  Concrete implementations live in **infrastructure** (HTTP adapters) and are
  injected at the app's composition root (`apps/web/src/app/composition-root/`).
  Nothing else imports `infrastructure` directly.
- **`infrastructure`** contains HTTP-backed adapters (e.g.
  `HttpProductsRepository`) that call `apps/api` over `fetch` and map JSON
  responses to domain entities (`IProduct`). It has **no** database driver —
  persistence lives entirely in the backend.
- **`apps/api`** owns the Drizzle schema and exposes a typed `Db`. Its
  repository (`ProductsRepository implements IProductsRepository`) maps between
  relational rows (snake_case) and domain entities (camelCase). It imports the
  domain port types as `import type` only (no runtime dependency).

### ⚠️ Known dependency inversion

`architecture.md` says `shared` must not import `domain`, but
`packages/shared/src/lib/result.ts` imports `AppError` and
`ICrashReporterService` **from `@panda-lavanda/domain`**, and
`packages/shared/package.json` lists `@panda-lavanda/domain` as a dependency.
This creates a mutual dependency between `shared` and `domain`. Follow the
existing code (not just the doc) when editing error-handling code, and don't
add *new* `domain` imports into `shared`.

## TypeScript conventions

- Root `tsconfig.json` enables **`verbatimModuleSyntax`** and
  **`isolatedModules`**. Consequences:
  - Always use **`import type`** for type-only imports.
  - **No `const enum`** — it breaks isolated transpilation. Use the
    const-object + union pattern instead (see `Size` in
    `packages/domain/src/products/product.ts`).
- **`types` field override gotcha:** root tsconfig sets `"types": ["vite/client"]`,
  which *replaces* (not merges) the types list in extending configs. Node-only
  packages/apps must set their own `"types": ["node"]` (see
  `apps/api/tsconfig.json`). This is why `process` was undefined in
  `drizzle.config.ts`.
- **No branded/nominal types** — `UniqueId`, `ImageUrl`, `PriceInRub`
  (`packages/shared/src/types/branded.ts`) are plain aliases, intentionally
  JSON-serializable for HTTP/Drizzle interop. Don't brand them without reason.

## Error handling

- Use `@sweet-monads/either` `Either<Error, T>` everywhere, never throw across
  layer boundaries. Wrap with `tryCatch` / `tryCatchSync` from
  `@panda-lavanda/shared` (optionally pass an `ICrashReporterService`).
- Throw/construct the `AppError` subclasses from `@panda-lavanda/domain`
  (`NetworkError`, `AuthError`, `NotFoundError`, `ValidationError`,
  `PermissionError`).

## Import paths

- **Between packages:** always the workspace package name
  (`@panda-lavanda/domain`), resolved via npm symlinks — never relative paths.
- **Inside `apps/web/`:** `#/*` subpath imports → `./src/*`
  (also `@/*`; `#/*` is the documented convention).

## Web app specifics

- **Routes are thin wrappers.** Route files in `src/app/routes/` only mount a
  page component from `src/presentation/pages/`. `routeTree.gen.ts` is
  generated — regenerate with `npm run generate-routes` (or the dev server
  does it). Don't hand-edit it; it's gitignored under `.tanstack/`.
- Path relativity gotcha: in `vite.config.ts` router paths are relative to
  `./src` (so `./app/routes`), but in `tsr.config.json` they're relative to
  the app root (so `./src/app/routes`).
- **Server functions live in `src/app/server-functions/<feature>/`.** Each
  `createServerFn` wrapper is in a `<feature>.functions.ts` file (TanStack
  Start convention — `.functions.ts` files are safe to import statically from
  routes/components; the compiler replaces the call with an RPC fetch in the
  client bundle). Route files only import these wrappers and pass arguments —
  they never call use cases or the composition root directly.
- **File-suffix conventions (TanStack Start import-protection):**
  - `.functions.ts` — `createServerFn` wrappers, isomorphic (importable from
    client and server).
  - `.server.ts` — server-only modules (env, server-only helpers). The
    `.server.*` suffix makes TanStack Start reject any import of this file
    from the client bundle; secrets stay server-side automatically.
  - `.client.ts` — client-only code.
- **Composition root in `src/app/composition-root/`.** The only place that
  instantiates concrete infrastructure (`HttpProductsRepository`, etc.).
  Imported only from `.server.ts` files or inside `.functions.ts` handlers —
  never from routes/components directly. The products repository is HTTP-backed
  (talks to `apps/api` at `env.BACKEND_URL`); the only Node-only dependency in
  the server composition root now is `LocalFileStorageService`.

## Environment

- **Centralized access:** all reads of environment variables go through a
  validated `env` module.
  - **Web app:** `import { env } from '#/shared/lib/env.server'`. The
    `env.server.ts` module runs the entire `process.env` through a zod schema
    at module scope, so a missing/invalid variable fails the server at startup
    with a clear error rather than mid-request. **Never** read `process.env.X`
    directly in app code (`vite.config.ts` and Vite-specific entry code are the
    only exceptions). Add new variables to the schema in `env.server.ts`.
  - **API backend:** `import { env } from '#/env'` (in `apps/api`). Same zod
    pattern; the schema lives in `apps/api/src/env.ts`.
- **Three `.env` files (all gitignored):**
  - `apps/web/.env` — loaded by Vite/TanStack `loadEnvPlugin` (reads
    `config.root = apps/web/`). Needs `BACKEND_URL` (the API origin).
  - `apps/api/.env` — loaded by Node's `--env-file-if-exists=.env` in the
    `dev`/`start`/`seed` scripts. Needs `DATABASE_URL`, `PORT`, `CORS_ORIGIN`.
  - Root `.env` — loaded by `docker-compose.yml` (for `POSTGRES_*` init and
    the `migrate` service).
  - `cp .env.example <path>` for each.
- `BACKEND_URL` — the API origin (e.g. `http://localhost:4000`), read by the
  web app's composition root (`HttpProductsRepository`) via `env.BACKEND_URL`.
- `DATABASE_URL` — PostgreSQL connection string, read by `apps/api`'s
  `createDb()` (via `env.DATABASE_URL`) and Drizzle Kit
  (`apps/api/drizzle.config.ts`, which uses its own `process.env` loader).
  **Only the backend reads it** — the web app no longer touches the database.
