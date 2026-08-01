CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"image" varchar(512),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Seed the three categories that existing products already reference via
-- `category_id` (the seed script's fixed UUIDs) BEFORE the FK is added, so the
-- `ALTER TABLE … ADD CONSTRAINT` below succeeds on a database that already has
-- product rows. The UUIDs here match `CATEGORIES` in `apps/api/scripts/seed.ts`
-- exactly; the slugs match the public URLs (`/categories/<slug>`).
INSERT INTO "categories" ("id", "name", "slug", "image") VALUES
	('11111111-1111-4111-8111-111111111111', 'Лаванда', 'lavanda', NULL),
	('22222222-2222-4222-8222-222222222222', 'Кустарники', 'kustarniki', NULL),
	('33333333-3333-4333-8333-333333333333', 'Многолетники', 'mnogoletniki', NULL);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;