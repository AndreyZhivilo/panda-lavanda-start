CREATE TYPE "public"."size" AS ENUM('p9', 'p11');--> statement-breakpoint
CREATE TABLE "exemplars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"in_stock" boolean NOT NULL,
	"size" "size" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category_id" uuid NOT NULL,
	"images" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exemplars" ADD CONSTRAINT "exemplars_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;