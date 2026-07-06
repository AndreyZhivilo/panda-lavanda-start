# Architecture

This project follows a **Clean Architecture** layering, with the application
shell (`app/`) organized the way [Feature-Sliced Design](https://feature-sliced.design/)
lays out its top layer. Routing uses TanStack Start's file-based convention,
but route files are intentionally **thin wrappers** that import page
components from `presentation/pages/`.

## Layers

```
src/
├── app/              # Application shell (router, providers, global styles)
│   ├── router.tsx    #   getRouter() — imports auto-generated routeTree
│   ├── routes/       #   📍 File-based routes directory (thin wrappers)
│   │   ├── __root.tsx    #     Root route — HTML shell + providers
│   │   ├── index.tsx     #     '/'      → @presentation/pages/home-page
│   │   ├── about.tsx     #     '/about' → @presentation/pages/about-page
│   │   └── routeTree.gen.ts  # ⚙️ Auto-generated (do not edit)
│   ├── providers/     #   Composition root (DI boundary)
│   └── styles.css     #   Global styles (@import "tailwindcss")
├── presentation/      # React UI: pages, components, hooks
│   ├── pages/         #   Page components (imported by app/routes/)
│   ├── components/    #   Reusable UI components (Button, Header...)
│   └── hooks/         #   React hooks
├── application/       # Use cases (application business rules)
├── domain/            # Enterprise business rules — pure TS, no dependencies
│   ├── entities/
│   ├── value-objects/
│   └── ports/         #   Interfaces for infrastructure
├── infrastructure/    # External-world adapters (API, storage) implementing ports
│   ├── api/
│   └── storage/
└── shared/            # Cross-cutting: config, lib, types, ui kit
    ├── config/
    ├── lib/
    ├── types/
    └── ui/
```

### Dependency rule

Dependencies point **inward** toward the domain:

```
app ─► presentation ─► application ─► domain ◄─ infrastructure (via ports)
                                                  ▲
                          shared ◄─ (any layer)
```

| Layer          | May import                                                   | May NOT import                |
| -------------- | ------------------------------------------------------------ | ----------------------------- |
| `domain`       | itself, `shared`                                             | React, anything external      |
| `application`  | `domain`, `shared`                                           | React, `infrastructure`       |
| `infrastructure` | `domain` (ports only), external libs, `shared`             | `presentation`, `app`         |
| `presentation` | `application`, `domain`, `shared`                            | `infrastructure` directly     |
| `app`          | everything (composition root)                                | —                             |

The only place that wires concrete infrastructure to the application is
`app/providers` (the composition root / dependency-injection boundary).
`presentation` never imports `infrastructure` directly — it goes through an
`application` use case.

## Routing (thin file-based wrappers)

TanStack Start requires file-based route generation for build-time manifest
and code splitting. Route files live in `app/routes/` and are **thin** —
they only import and re-export a page component from `presentation/pages/`.

```tsx
// app/routes/index.tsx — thin wrapper
import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@presentation/pages/home-page'

export const Route = createFileRoute('/')({ component: HomePage })
```

All page logic, layout, and composition lives in `presentation/pages/`.

### Route configuration

- `routesDirectory` and `generatedRouteTree` are configured in both
  `vite.config.ts` (`tanstackStart({ router: {...} })`) and `tsr.config.json`.
  **Important:** In `vite.config.ts` these paths are relative to `srcDirectory`
  (`./src`), so use `./app/routes` (not `./src/app/routes`). In `tsr.config.json`
  they are relative to the project root, so use `./src/app/routes`.
- `routeFileIgnorePattern: 'routeTree\\.gen'` prevents the generated route tree
  from being scanned as a route file.

To add a route:

1. Create the page component under `presentation/pages/<name>-page/`.
2. Create a thin route file under `app/routes/<name>.tsx` that imports the page.
3. Run `npm run dev` — the route tree regenerates automatically.

## Import aliases

Defined in `tsconfig.json` and resolved by Vite via `tsconfigPaths`:

| Alias              | Target                  |
| ------------------ | ----------------------- |
| `@/*`, `#/*`       | `./src/*`               |
| `@app/*`           | `./src/app/*`           |
| `@presentation/*`  | `./src/presentation/*`  |
| `@domain/*`        | `./src/domain/*`        |
| `@application/*`   | `./src/application/*`   |
| `@infrastructure/*`| `./src/infrastructure/*`|
| `@shared/*`        | `./src/shared/*`        |

## Data-flow example

User opens the profile page → `app/routes/profile.tsx` (thin route)
renders `presentation/pages/profile-page` → the page's hook calls
`application/profile/get-profile.usecase.ts` → the use case depends on the
`IProfileRepository` port from `domain/ports/` → the concrete implementation in
`infrastructure/api/profile.api.repository.ts` performs the HTTP request and
returns the `Profile` entity from `domain/entities/`.
