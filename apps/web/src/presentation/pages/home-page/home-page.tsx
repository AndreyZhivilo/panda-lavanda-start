import type { ICategory } from '@panda-lavanda/domain'
import { Link, useLoaderData, useRouter } from '@tanstack/react-router'

import { Button } from '#/shared/components/button'

/**
 * JSON-serializable shape of what the homepage route loader returns.
 *
 * The use case produces an `Either<Error, ICategory[]>`, but `Either` (a class
 * with methods) and `Error` do not survive TanStack Start's server→client
 * serialization. The route's server function converts the result into this
 * plain discriminated union on the wire.
 */
type HomeLoaderData =
  | { ok: true; categories: ICategory[] }
  | { ok: false; message: string }

/**
 * Homepage: keeps the welcome block and adds a categories section below it.
 *
 * The categories are loaded on the server by the homepage route's loader
 * (see `app/routes/index.tsx`) and read here via `useLoaderData`. Each card is
 * a link to the category page (`/categories/$categorySlug`).
 */
export function HomePage() {
  const data = useLoaderData({ from: '/' }) as HomeLoaderData
  const router = useRouter()

  const welcome = (
    <div className="text-center">
      <h1 className="text-4xl font-bold">Welcome to Panda Lavanda</h1>
      <p className="mt-4 text-lg">
        Code-based routing + Clean Architecture on TanStack Start.
      </p>
    </div>
  )

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        {welcome}
        <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <h2 className="text-xl font-semibold text-destructive">
            Не удалось загрузить категории
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{data.message}</p>
          <Button className="mt-4" onClick={() => router.invalidate()}>
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  const { categories } = data

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      {welcome}

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-semibold">Категории</h2>

        {categories.length === 0 ? (
          <p className="text-muted-foreground">Категорий пока нет.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => (
              <li
                key={category.id}
                className="relative flex flex-col overflow-hidden rounded-lg border bg-background"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex flex-1 items-center p-4">
                  <h3 className="font-medium">{category.name}</h3>
                </div>

                {/* Stretched link covering the whole card. */}
                <Link
                  to="/categories/$categorySlug"
                  params={{ categorySlug: category.slug }}
                  aria-label={`Открыть категорию: ${category.name}`}
                  className="absolute inset-0 z-0 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
