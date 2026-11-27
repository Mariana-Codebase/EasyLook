CREATE TYPE "public"."garment_category" AS ENUM('top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory');--> statement-breakpoint
CREATE TYPE "public"."outfit_status" AS ENUM('draft', 'saved');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "garment_occasions" (
	"garment_id" uuid NOT NULL,
	"occasion_id" uuid NOT NULL,
	CONSTRAINT "garment_occasions_garment_id_occasion_id_pk" PRIMARY KEY("garment_id","occasion_id")
);
--> statement-breakpoint
CREATE TABLE "garments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "garment_category" NOT NULL,
	"price_cop" integer NOT NULL,
	"style" text NOT NULL,
	"color" text NOT NULL,
	"sizes" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garments_price_cop_positive" CHECK ("garments"."price_cop" > 0)
);
--> statement-breakpoint
CREATE TABLE "occasions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"recommended_styles" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occasions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "outfit_items" (
	"outfit_id" uuid NOT NULL,
	"garment_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outfit_items_outfit_id_garment_id_pk" PRIMARY KEY("outfit_id","garment_id")
);
--> statement-breakpoint
CREATE TABLE "outfits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"occasion_id" uuid NOT NULL,
	"name" text NOT NULL,
	"budget_cop" integer,
	"status" "outfit_status" DEFAULT 'draft' NOT NULL,
	"saved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outfits_budget_cop_non_negative" CHECK ("outfits"."budget_cop" IS NULL OR "outfits"."budget_cop" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"style" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"preferred_styles" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_sizes" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "garment_occasions" ADD CONSTRAINT "garment_occasions_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garment_occasions" ADD CONSTRAINT "garment_occasions_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garments" ADD CONSTRAINT "garments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_outfit_id_outfits_id_fk" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_occasion_id_occasions_id_fk" FOREIGN KEY ("occasion_id") REFERENCES "public"."occasions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garment_occasions_occasion_idx" ON "garment_occasions" USING btree ("occasion_id");--> statement-breakpoint
CREATE INDEX "garments_store_idx" ON "garments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "garments_category_idx" ON "garments" USING btree ("category");--> statement-breakpoint
CREATE INDEX "garments_price_idx" ON "garments" USING btree ("price_cop");--> statement-breakpoint
CREATE INDEX "garments_style_idx" ON "garments" USING btree ("style");--> statement-breakpoint
CREATE INDEX "outfits_user_idx" ON "outfits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stores_style_idx" ON "stores" USING btree ("style");