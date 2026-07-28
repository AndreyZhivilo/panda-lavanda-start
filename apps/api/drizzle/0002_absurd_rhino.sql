ALTER TABLE "products" ADD COLUMN "slug" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_slug_unique" UNIQUE("slug");