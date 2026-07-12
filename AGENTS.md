# AGENTS.md

Workspace guide for ZCode agents. Read this before editing.
Authoritative architecture detail lives in **`architecture.md`** — read it
before touching layer boundaries or adding packages.

## What this is

npm-workspaces monorepo for **Panda Lavanda** (an e-commerce catalog of garden plants). Clean Architecture layering across shared packages; two independent
apps consume them.

## Layout

```
apps/
  web/            @panda-lavanda/web   — TanStack Start (React 19 + Tailwind v4)
  telegram-bot/   @panda-lavanda/telegram-bot — placeholder entry point
packages/
  shared/         cross-cutting utils (tryCatch, types, config, ui)
  domain/         entities, value-objects, ports (interfaces), AppError hierarchy
  application/    use cases (currently empty barrel)
  infrastructure/ port implementations (Drizzle repos, CrashReporterService)
  db/             Drizzle ORM schema + createDb() client (Node-only, PostgreSQL)
```

## Commands (run from repo root)

| Task              | Command                         |
| ----------------- | ------------------------------- |
| Dev (web)         | `npm run dev` / `npm run dev:web` |
| Dev (bot)         | `npm run dev:bot`               |
| Build (web only)  | `npm run build` / `npm run build:web` |
| Tests (web)       | `npm run test` (Vitest)         |
| Regen route tree  | `npm run generate-routes`       |
| Typecheck a pkg   | `npx tsc --noEmit` in the package dir |
| Drizzle generate  | `npm run generate -w @panda-lavanda/db` |
| Drizzle migrate   | `npm run migrate -w @panda-lavanda/db` |
| Drizzle studio    | `npm run studio -w @panda-lavanda/db` |

There is **no repo-wide build/typecheck/lint script**. Typecheck per package
with `tsc --noEmit`. The root `build` only builds the web app.

## Architecture rules (critical)

Dependency direction (see `architecture.md` for the full table):

```
shared ◄── domain ◄── application ◄── web / telegram-bot
               ▲                        ▲
               └── infrastructure ──────┘ (via ports)  ──◄── db
```

- **`domain`** is pure TS, zero framework deps. No React, no external libs.
- **Ports** (e.g. `IProductsRepository`) are interfaces defined **in domain**.
  Concrete implementations live in **infrastructure** and are injected at the
  app's composition root (`apps/web/src/app/providers/`). Nothing else imports
  `infrastructure` directly.
- **`infrastructure`** maps between relational rows (snake_case) and domain
  entities (camelCase). See `drizzle-products.repository.ts` for the pattern:
  LEFT JOIN exemplars, group in JS, return `IProduct`.
- **`db`** owns the Drizzle schema and exposes a typed `Db`. It does **not**
  know about domain entities.

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
  packages must set their own `"types": ["node"]` (see
  `packages/db/tsconfig.json`). This is why `process` was undefined in
  `drizzle.config.ts`.
- **No branded/nominal types** — `UniqueId`, `ImageUrl`, `PriceInRub`
  (`packages/shared/src/types/branded.ts`) are plain aliases, intentionally
  JSON-serializable for Drizzle/API interop. Don't brand them without reason.

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

## Environment

- `DATABASE_URL` — PostgreSQL connection string, read by `createDb()` and
  Drizzle Kit (`packages/db/drizzle.config.ts`). Define in `.env` (gitignored).
