/**
 * Development-only seed script: wipes the `categories`, `products` +
 * `exemplars` tables and fills them with realistic test data (garden plants).
 *
 * Works directly on the Drizzle tables — it intentionally does NOT go through
 * the HTTP layer or the repository, to keep the seed fast and independent of
 * the running API server.
 *
 * Product images reference committed photos under
 * `apps/web/public/uploads/seed/` (served at `/uploads/seed/<file>.jpg`).
 * Each product is assigned 1-2 random images from that pool, so the files
 * always exist and render in the UI.
 *
 * Usage (from repo root):
 *   npm run seed:api -- --yes              # 10 products, no confirmation
 *   npm run seed:api -- -y --count=50      # 50 products, no confirmation
 *   npm run seed:api -- --count=30 --yes   # explicit count + skip prompt
 *   npx tsx scripts/seed.ts                # interactive (run from apps/api/)
 *
 * On Windows PowerShell, npm's `.cmd` shim can drop `--count=N` (and `--yes`)
 * before they reach this script. Pass them as env vars instead:
 *   bash/zsh:   SEED_COUNT=50 SEED_YES=1 npm run seed:api
 *   PowerShell: $env:SEED_COUNT=50; $env:SEED_YES=1; npm run seed:api
 * An explicit `--count=N` / `--yes` flag, when given, overrides the matching
 * env var.
 *
 * NOTE: `--yes` (or `-y`) is **required** when running via `npm run`, because
 * npm scripts have no interactive stdin — the confirmation prompt gets an empty
 * answer, hangs, and the script fails (`unsettled top-level await`) before
 * inserting anything. Use the bare `tsx scripts/seed.ts` form only when you
 * have an interactive terminal.
 *
 * `DATABASE_URL` is loaded by Node's `--env-file-if-exists=.env` flag set in
 * the npm script (no `dotenv` dependency). It reads `apps/api/.env`.
 */
import { sql } from 'drizzle-orm'
import { createInterface } from 'node:readline/promises'

import { createDb } from '../src/db/client'
import { categories } from '../src/schema/categories'
import { exemplars, products } from '../src/schema/products'
import { toSlug } from '../src/utils/slug'

/** Default number of products to seed. */
const DEFAULT_COUNT = 10

/**
 * Environment variable name that overrides `DEFAULT_COUNT`. Lets the count be
 * passed without a `--count=N` flag — important on Windows PowerShell, where
 * npm's `.cmd` shim silently drops arguments beginning with `--`. A `--count=N`
 * flag, when present, still wins over this env var.
 */
const COUNT_ENV_VAR = 'SEED_COUNT'

/**
 * Environment variable equivalent of `--yes`. Same PowerShell rationale as
 * `COUNT_ENV_VAR`: lets confirmation be skipped without a `--`-prefixed flag.
 */
const YES_ENV_VAR = 'SEED_YES'

/**
 * Static categories inserted into the `categories` table and referenced by
 * products via `category_id`. The UUIDs are fixed so they stay stable across
 * re-seeds and match the migration's seed rows (see
 * `drizzle/0004_concerned_tarantula.sql`). `slug` is the public URL segment
 * (`/categories/<slug>`).
 */
const CATEGORIES = {
  lavender: '11111111-1111-4111-8111-111111111111',
  shrubs: '22222222-2222-4222-8222-222222222222',
  perennials: '33333333-3333-4333-8333-333333333333',
} as const

/** Category rows to seed — keyed by the product template's `categoryId`. */
const CATEGORY_ROWS = [
  { id: CATEGORIES.lavender, name: 'Лаванда', slug: 'lavanda' },
  { id: CATEGORIES.shrubs, name: 'Кустарники', slug: 'kustarniki' },
  { id: CATEGORIES.perennials, name: 'Многолетники', slug: 'mnogoletniki' },
] as const

type Size = 'p9' | 'p11'

interface SeedExemplar {
  price: number
  inStock: boolean
  size: Size
}

/**
 * Catalog template — everything a product needs *except* images, which are
 * assigned randomly from `IMAGE_POOL` at seed time. The seed loop cycles
 * through this array, appending an index suffix when more products are
 * requested than the base set holds.
 */
interface SeedProductTemplate {
  name: string
  description: string
  categoryId: string
  exemplars: SeedExemplar[]
}

/** A product ready to insert, with its randomly-assigned images. */
interface SeedProduct extends SeedProductTemplate {
  images: string[]
}

/**
 * Pool of real plant photos committed under `apps/web/public/uploads/seed/`.
 * Each product picks 1-2 of these at random, so image URLs always resolve.
 */
const IMAGE_POOL: string[] = [
  '/uploads/seed/lavender-hidcote.jpg',
  '/uploads/seed/lavender-royal-crown.jpg',
  '/uploads/seed/lavender-dentata.jpg',
  '/uploads/seed/hydrangea-endless-summer.jpg',
  '/uploads/seed/hydrangea-vanille-fraise.jpg',
  '/uploads/seed/rose-double-delight.jpg',
  '/uploads/seed/rose-iceberg.jpg',
  '/uploads/seed/buddleja-black-knight.jpg',
  '/uploads/seed/yucca-filamentosa.jpg',
  '/uploads/seed/clematis-nelly-moser.jpg',
]

/**
 * Base catalog of realistic garden plants. The seed loop cycles through this
 * array, appending an index suffix when more products are requested than the
 * base set holds (to keep `name` unique-ish while staying meaningful).
 */
const CATALOG: SeedProductTemplate[] = [
  {
    name: 'Лаванда узколистная «Hidcote»',
    description:
      'Компактный многолетник с насыщенными фиолетовыми соцветиями и серебристой листвой. Морозостойка, идеальна для бордюров.',
    categoryId: CATEGORIES.lavender,
    exemplars: [
      { price: 490, inStock: true, size: 'p9' },
      { price: 690, inStock: true, size: 'p11' },
    ],
  },
  {
    name: 'Лаванда французская «Royal Crown»',
    description:
      'Пышная лаванда с крупными цветными прицветниками. Долго цветёт, отлично чувствует себя в горшках и на клумбах.',
    categoryId: CATEGORIES.lavender,
    exemplars: [
      { price: 650, inStock: true, size: 'p11' },
      { price: 550, inStock: false, size: 'p9' },
    ],
  },
  {
    name: 'Лаванда зубчатая',
    description:
      'Нежно-серебристая листва и ароматные лавандовые цветы. Подходит для тёплых, защищённых от ветра уголков сада.',
    categoryId: CATEGORIES.lavender,
    exemplars: [{ price: 720, inStock: true, size: 'p11' }],
  },
  {
    name: 'Гортензия крупнолистная «Endless Summer»',
    description:
      'Ремонтантный сорт с шапками розовых или голубых цветов в зависимости от кислотности почвы. Цветёт с июня по сентябрь.',
    categoryId: CATEGORIES.shrubs,
    exemplars: [
      { price: 1200, inStock: true, size: 'p11' },
      { price: 980, inStock: true, size: 'p9' },
    ],
  },
  {
    name: 'Гортензия метельчатая «Vanille Fraise»',
    description:
      'Мощный куст с конусовидными соцветиями, меняющими цвет от белого к малиновому. Очень морозостойка.',
    categoryId: CATEGORIES.shrubs,
    exemplars: [{ price: 1450, inStock: true, size: 'p11' }],
  },
  {
    name: 'Роза чайно-гибридная «Double Delight»',
    description:
      'Классическая двуцветная роза с кремовыми лепестками и малиновой каймой. Сильный аромат, длительное цветение.',
    categoryId: CATEGORIES.shrubs,
    exemplars: [
      { price: 890, inStock: true, size: 'p11' },
      { price: 760, inStock: false, size: 'p9' },
    ],
  },
  {
    name: 'Роза плетистая «Iceberg»',
    description:
      'Обильноцветущий плетистый сорт с чисто-белыми кистями. Идеален для арок, пергол и оград.',
    categoryId: CATEGORIES.shrubs,
    exemplars: [{ price: 1100, inStock: true, size: 'p11' }],
  },
  {
    name: 'Буддлея Давида «Black Knight»',
    description:
      '«Летняя сирень» с тёмно-фиолетовыми соцветиями, притягивающими бабочек. Быстро растёт, любит солнце.',
    categoryId: CATEGORIES.shrubs,
    exemplars: [
      { price: 820, inStock: true, size: 'p9' },
      { price: 1050, inStock: true, size: 'p11' },
    ],
  },
  {
    name: 'Юкка нитеватая',
    description:
      'Вечнозелёный многолетник с мечевидными листьями и высокими метёлками белых колокольчатых цветов. Засухоустойчива.',
    categoryId: CATEGORIES.perennials,
    exemplars: [{ price: 950, inStock: true, size: 'p11' }],
  },
  {
    name: 'Клематис «Nelly Moser»',
    description:
      'Крупноцветковая лиана с розово-сиреневыми звездчатыми цветами. Прекрасно смотрится на решётках и беседках.',
    categoryId: CATEGORIES.perennials,
    exemplars: [
      { price: 680, inStock: true, size: 'p9' },
      { price: 880, inStock: true, size: 'p11' },
    ],
  },
]

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  count: number
  yes: boolean
}

/**
 * Resolves the seed count from the environment before CLI flags are applied.
 * Priority: explicit `--count=N` flag > `SEED_COUNT` env var > `DEFAULT_COUNT`.
 * The env var exists because Windows PowerShell + npm's `.cmd` shim can drop
 * `--`-prefixed arguments before they reach this script.
 */
function resolveEnvCount(): number {
  const raw = process.env[COUNT_ENV_VAR]
  if (raw === undefined || raw === '') return DEFAULT_COUNT
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    fail(`Invalid ${COUNT_ENV_VAR} value: "${raw}". Expected a non-negative integer.`)
  }
  return value
}

/**
 * True when `SEED_YES` is set to a truthy value (1, true, yes —
 * case-insensitive). Equivalent to `--yes`, for the same PowerShell reason as
 * `resolveEnvCount`.
 */
function resolveEnvYes(): boolean {
  const raw = (process.env[YES_ENV_VAR] ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y'
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { count: resolveEnvCount(), yes: resolveEnvYes() }

  for (const arg of argv.slice(2)) {
    if (arg === '--yes' || arg === '-y') {
      args.yes = true
    } else if (arg.startsWith('--count=')) {
      const value = Number(arg.slice('--count='.length))
      if (!Number.isInteger(value) || value < 0) {
        fail(`Invalid --count value: "${arg.slice('--count='.length)}". Expected a non-negative integer.`)
      }
      args.count = value
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    } else {
      fail(`Unknown argument: "${arg}". Run with --help for usage.`)
    }
  }

  return args
}

function printUsage(): void {
  console.log(`
Usage: npm run seed:api -- [options]

Wipes categories, products + exemplars and fills them with test garden plants.

Options:
  --count=N   Number of products to insert (default: ${DEFAULT_COUNT})
  --yes, -y   Skip the interactive confirmation prompt (REQUIRED via npm run)
  --help, -h  Show this help

Environment:
  ${COUNT_ENV_VAR}  Same as --count=N, but passed as an env var instead of a
              flag. Use this on Windows PowerShell, where npm's .cmd shim can
              drop --count=N before it reaches the script.
  ${YES_ENV_VAR}    Same as --yes / -y, also useful on PowerShell.
              A --count=N or --yes flag, when given, overrides the matching
              env var.
              PowerShell (one line):
                $env:${COUNT_ENV_VAR}=50; $env:${YES_ENV_VAR}=1; npm run seed:api

DATABASE_URL must be set (loaded from apps/api/.env automatically).
Only runs against development databases (localhost / 127.0.0.1 / ::1 / "panda").

Note: via 'npm run' there is no interactive stdin, so always pass --yes.
`)
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/** Dev markers that identify a safe-to-wipe database URL. */
const DEV_MARKERS = ['localhost', '127.0.0.1', '[::1]', '::1', '/panda']

function isDevDatabase(url: string): boolean {
  return DEV_MARKERS.some((marker) => url.includes(marker))
}

/** Mask credentials in a URL for safe logging (postgres://user:pass@host/db). */
function maskUrl(url: string): string {
  return url.replace(/(\/\/[^:]+:)[^@]+@/, '$1****@')
}

// ---------------------------------------------------------------------------
// Image assignment
// ---------------------------------------------------------------------------

/**
 * Picks 1-2 distinct random images from `IMAGE_POOL` for a product.
 * Uses Fisher-Yates partial shuffle to avoid duplicates.
 */
function pickImages(): string[] {
  const take = Math.random() < 0.5 && IMAGE_POOL.length >= 2 ? 2 : 1
  const pool = [...IMAGE_POOL]
  const picked: string[] = []
  for (let i = 0; i < take; i++) {
    const index = Math.floor(Math.random() * pool.length)
    picked.push(pool[index])
    pool.splice(index, 1)
  }
  return picked
}

// ---------------------------------------------------------------------------
// Interactive confirmation
// ---------------------------------------------------------------------------

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(message)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function runSeed(connectionString: string, count: number): Promise<void> {
  const db = createDb(connectionString)

  try {
    console.log('\n🧹 Clearing categories, products + exemplars...')
    // CASCADE reaches the dependent tables; order in the list does not matter.
    await db.execute(
      sql`TRUNCATE TABLE exemplars, products, categories RESTART IDENTITY CASCADE`,
    )

    if (count === 0) {
      console.log('✓ Tables cleared (count=0, nothing to insert).')
      return
    }

    // Categories first: products reference them via the `category_id` FK, so
    // they must exist before any product row is inserted.
    await db
      .insert(categories)
      .values(CATEGORY_ROWS.map((c) => ({ id: c.id, name: c.name, slug: c.slug })))
    console.log(`🌱 Inserted ${CATEGORY_ROWS.length} categor(y/ies).`)

    const toInsert = buildInsertList(count)
    console.log(`🌱 Inserting ${toInsert.length} product(s)...`)

    // Track slugs locally: the seed bypasses the repository (and therefore its
    // findUniqueSlug helper), so duplicates are resolved here against this Set.
    // The table was just TRUNCATEd, so the Set is the only collision source.
    const usedSlugs = new Set<string>()
    const uniqueSlugFor = (name: string): string => {
      const base = toSlug(name) || 'product'
      if (!usedSlugs.has(base)) {
        usedSlugs.add(base)
        return base
      }
      for (let n = 2; ; n++) {
        const next = `${base}-${n}`
        if (!usedSlugs.has(next)) {
          usedSlugs.add(next)
          return next
        }
      }
    }

    let exemplarCount = 0
    for (const item of toInsert) {
      const [product] = await db
        .insert(products)
        .values({
          name: item.name,
          slug: uniqueSlugFor(item.name),
          description: item.description,
          categoryId: item.categoryId,
          images: item.images,
        })
        .returning({ id: products.id })

      if (item.exemplars.length > 0) {
        await db.insert(exemplars).values(
          item.exemplars.map((e) => ({
            productId: product.id,
            price: e.price,
            inStock: e.inStock,
            size: e.size,
          })),
        )
        exemplarCount += item.exemplars.length
      }
    }

    console.log(
      `✓ Done. Inserted ${toInsert.length} product(s) and ${exemplarCount} exemplar(s).`,
    )
  } finally {
    // postgres-js keeps a connection pool; end it so the process can exit.
    await db.$client.end()
  }
}

/** Builds the list of products to insert by cycling through the base catalog. */
function buildInsertList(count: number): SeedProduct[] {
  return Array.from({ length: count }, (_, i): SeedProduct => {
    const base = CATALOG[i % CATALOG.length]
    return {
      // Beyond one full cycle, suffix the name to keep entries distinguishable.
      ...(i < CATALOG.length
        ? base
        : { ...base, name: `${base.name} #${i + 1}` }),
      images: pickImages(),
    }
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const { count, yes } = parseArgs(process.argv)

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    fail(
      'DATABASE_URL is not set. Create apps/api/.env (see apps/api/.env.example) or export DATABASE_URL in your shell.',
    )
  }

  if (!isDevDatabase(connectionString)) {
    fail(
      `Refusing to run: DATABASE_URL does not look like a development database.\n` +
        `This script only runs against URLs containing one of: ${DEV_MARKERS.join(', ')}.\n` +
        `Got: ${maskUrl(connectionString)}`,
    )
  }

  console.log(`\n⚠️  DESTRUCTIVE OPERATION`)
  console.log(`Target database: ${maskUrl(connectionString)}`)
  console.log(`This will DELETE all rows in categories, products + exemplars and insert ${count} test product(s).`)

  if (!yes) {
    const ok = await confirm('\nProceed? [y/N] ')
    if (!ok) {
      console.log('Aborted.')
      process.exit(0)
    }
  }

  try {
    await runSeed(connectionString, count)
    process.exit(0)
  } catch (error) {
    console.error('\n✗ Seed failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

await main()
