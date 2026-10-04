CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"default_value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "features_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text,
	"connection_id" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb,
	CONSTRAINT "payment_webhook_events_provider_event_id_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "pending_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"provider" text NOT NULL,
	"path" text NOT NULL,
	"resource_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_features_plan_id_feature_id_unique" UNIQUE("plan_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "product_video_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_video_assignments_product_id_video_id_unique" UNIQUE("product_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "product_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"bunny_video_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"file_size_bytes" bigint,
	"thumbnail_url" text,
	"status" text DEFAULT 'UPLOADING' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_feature_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"override_value" jsonb NOT NULL,
	"reason" text,
	"expires_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seller_feature_overrides_seller_id_feature_id_unique" UNIQUE("seller_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "seller_storage_usage" (
	"seller_id" uuid PRIMARY KEY NOT NULL,
	"used_bytes" bigint DEFAULT 0 NOT NULL,
	"reserved_bytes" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"store_id" uuid,
	"reference_type" text NOT NULL,
	"reference_id" text,
	"requested_bytes" bigint NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_bot_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"username" text,
	"photo_url" text,
	"bot_status" text DEFAULT 'administrator' NOT NULL,
	"can_invite_users" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_bot_chats_bot_id_telegram_chat_id_unique" UNIQUE("bot_id","telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "video_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_video_id" uuid NOT NULL,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"progress_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_watched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_progress_customer_id_product_video_id_unique" UNIQUE("customer_id","product_video_id")
);
--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "seller_payment_connections" ADD COLUMN "webhook_id" text;--> statement-breakpoint
ALTER TABLE "seller_payment_connections" ADD COLUMN "webhook_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_video_assignments" ADD CONSTRAINT "product_video_assignments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_video_assignments" ADD CONSTRAINT "product_video_assignments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_video_assignments" ADD CONSTRAINT "product_video_assignments_video_id_product_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."product_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_feature_overrides" ADD CONSTRAINT "seller_feature_overrides_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_feature_overrides" ADD CONSTRAINT "seller_feature_overrides_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_feature_overrides" ADD CONSTRAINT "seller_feature_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_storage_usage" ADD CONSTRAINT "seller_storage_usage_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_reservations" ADD CONSTRAINT "storage_reservations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_reservations" ADD CONSTRAINT "storage_reservations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_bot_chats" ADD CONSTRAINT "telegram_bot_chats_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_bot_chats" ADD CONSTRAINT "telegram_bot_chats_bot_id_telegram_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."telegram_bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_customer_id_telegram_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."telegram_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_product_video_id_product_videos_id_fk" FOREIGN KEY ("product_video_id") REFERENCES "public"."product_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_webhook_events_idx" ON "payment_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "pending_deletions_store_idx" ON "pending_deletions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "pending_deletions_processed_idx" ON "pending_deletions" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "plan_features_plan_idx" ON "plan_features" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_features_feature_idx" ON "plan_features" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "product_video_assignments_store_id_idx" ON "product_video_assignments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_video_assignments_product_id_idx" ON "product_video_assignments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_video_assignments_video_id_idx" ON "product_video_assignments" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "product_video_assignments_store_product_idx" ON "product_video_assignments" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "product_video_assignments_store_video_idx" ON "product_video_assignments" USING btree ("store_id","video_id");--> statement-breakpoint
CREATE INDEX "product_videos_bunny_video_id_idx" ON "product_videos" USING btree ("bunny_video_id");--> statement-breakpoint
CREATE INDEX "product_videos_store_id_idx" ON "product_videos" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_videos_product_id_idx" ON "product_videos" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_videos_store_product_idx" ON "product_videos" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "product_videos_status_idx" ON "product_videos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_videos_store_product_position_idx" ON "product_videos" USING btree ("store_id","product_id","position");--> statement-breakpoint
CREATE INDEX "seller_feature_overrides_seller_idx" ON "seller_feature_overrides" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_feature_overrides_feature_idx" ON "seller_feature_overrides" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "storage_reservations_seller_idx" ON "storage_reservations" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "storage_reservations_status_idx" ON "storage_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "storage_reservations_expires_idx" ON "storage_reservations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "telegram_bot_chats_store_bot_idx" ON "telegram_bot_chats" USING btree ("store_id","bot_id");--> statement-breakpoint
CREATE INDEX "telegram_bot_chats_store_active_idx" ON "telegram_bot_chats" USING btree ("store_id","is_active");--> statement-breakpoint
CREATE INDEX "video_progress_customer_video_idx" ON "video_progress" USING btree ("customer_id","product_video_id");--> statement-breakpoint
CREATE INDEX "video_progress_store_idx" ON "video_progress" USING btree ("store_id");--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clips_product_id_idx" ON "clips" USING btree ("product_id");