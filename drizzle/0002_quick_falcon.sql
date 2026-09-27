CREATE TABLE "carousel_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carousel_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carousel_products_carousel_id_product_id_unique" UNIQUE("carousel_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"bunny_video_id" text NOT NULL,
	"thumbnail_url" text,
	"duration" integer,
	"status" text DEFAULT 'UPLOADING' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" text NOT NULL,
	"discount_type" text DEFAULT 'percentage' NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_value" numeric(10, 2) DEFAULT '0',
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_store_id_code_unique" UNIQUE("store_id","code")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" text DEFAULT 'cora' NOT NULL,
	"external_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"qr_code" text,
	"qr_code_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_payment_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'MERCADO_PAGO' NOT NULL,
	"status" text DEFAULT 'DISCONNECTED' NOT NULL,
	"mp_user_id" text,
	"mp_user_email" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp,
	"connected_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_carousels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_ranking" boolean DEFAULT false NOT NULL,
	"indicator_type" text DEFAULT 'BAR' NOT NULL,
	"icon_name" text,
	"icon_color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_payment_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"store_id" uuid,
	"provider" text NOT NULL,
	"provider_user_id" text,
	"provider_email" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"account_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_floating_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"text" text NOT NULL,
	"icon" text DEFAULT '🔥' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"count_min" integer DEFAULT 5,
	"count_max" integer DEFAULT 18,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"billing_interval" text DEFAULT 'month' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_products" integer,
	"max_bots" integer,
	"max_customers" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text DEFAULT 'TRIAL' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "accesses" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "accesses" ALTER COLUMN "granted_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accesses" ALTER COLUMN "granted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "delivery_type" text DEFAULT 'telegram';--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "invite_link" text;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "invite_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "delivery_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "delivery_error" text;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "expired_at" timestamp;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "confirmation_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "revocation_status" text;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "revocation_error" text;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "accesses" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "icon_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preference_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pix_qr_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pix_qr_code_base64" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pix_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "platform_fee" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "net_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "bot_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "duration" text DEFAULT 'lifetime';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "badge" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "delivery_type" text DEFAULT 'telegram';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "delivery_value" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "show_views" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "views_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "show_fire" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fire_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "welcome_banners" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "banner_interval" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "category_display_style" text DEFAULT 'IMAGE' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "support_type" text DEFAULT 'telegram';--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "support_value" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "floating_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "floating_notifications_pages" jsonb DEFAULT '["home","product","category","search"]'::jsonb;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "floating_notifications_display_duration" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "floating_notifications_interval_min" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "floating_notifications_interval_max" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_bots" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "telegram_bots" ADD COLUMN "secret_token" text;--> statement-breakpoint
ALTER TABLE "telegram_bots" ADD COLUMN "button_text" text DEFAULT 'Abrir App';--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "carousel_products" ADD CONSTRAINT "carousel_products_carousel_id_product_carousels_id_fk" FOREIGN KEY ("carousel_id") REFERENCES "public"."product_carousels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carousel_products" ADD CONSTRAINT "carousel_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_carousels" ADD CONSTRAINT "product_carousels_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payment_connections" ADD CONSTRAINT "seller_payment_connections_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payment_connections" ADD CONSTRAINT "seller_payment_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_floating_notifications" ADD CONSTRAINT "store_floating_notifications_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_floating_notifications" ADD CONSTRAINT "store_floating_notifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clips_bunny_video_id_idx" ON "clips" USING btree ("bunny_video_id");--> statement-breakpoint
CREATE INDEX "clips_store_id_idx" ON "clips" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "clips_status_idx" ON "clips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clips_store_position_idx" ON "clips" USING btree ("store_id","position");--> statement-breakpoint
CREATE INDEX "product_carousels_store_status_idx" ON "product_carousels" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "store_floating_notifications_store_id_idx" ON "store_floating_notifications" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "store_floating_notifications_store_enabled_idx" ON "store_floating_notifications" USING btree ("store_id","enabled");--> statement-breakpoint
CREATE INDEX "store_floating_notifications_store_product_idx" ON "store_floating_notifications" USING btree ("store_id","product_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_bot_id_telegram_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."telegram_bots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accesses_store_customer_status_idx" ON "accesses" USING btree ("store_id","customer_id","status");--> statement-breakpoint
CREATE INDEX "banners_store_status_idx" ON "banners" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "categories_store_status_idx" ON "categories" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "orders_store_status_created_idx" ON "orders" USING btree ("store_id","status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "products_store_status_idx" ON "products" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "products_store_category_idx" ON "products" USING btree ("store_id","category_id");--> statement-breakpoint
CREATE INDEX "telegram_customers_store_id_idx" ON "telegram_customers" USING btree ("store_id");--> statement-breakpoint
ALTER TABLE "accesses" ADD CONSTRAINT "accesses_store_id_customer_id_product_id_order_id_unique" UNIQUE("store_id","customer_id","product_id","order_id");