-- Migration 0006: Analytics Starts and Sessions
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "session_id" text;
CREATE INDEX IF NOT EXISTS "orders_session_id_idx" ON "orders" ("session_id");

CREATE TABLE IF NOT EXISTS "bot_start_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"bot_id" uuid,
	"telegram_user_id" text NOT NULL,
	"telegram_username" text,
	"telegram_first_name" text,
	"telegram_update_id" text NOT NULL,
	"start_payload" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "bot_start_events" ADD CONSTRAINT "bot_start_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bot_start_events" ADD CONSTRAINT "bot_start_events_bot_id_telegram_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."telegram_bots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bot_start_events" ADD CONSTRAINT "bot_start_events_store_update_unique" UNIQUE ("store_id", "telegram_update_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "bot_start_events_store_created_idx" ON "bot_start_events" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "bot_start_events_store_user_idx" ON "bot_start_events" USING btree ("store_id", "telegram_user_id");
CREATE INDEX IF NOT EXISTS "bot_start_events_bot_id_idx" ON "bot_start_events" USING btree ("bot_id");

CREATE TABLE IF NOT EXISTS "store_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid,
	"telegram_user_id" text,
	"entry_path" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"start_param" text,
	"device_type" text,
	"is_eligible" boolean DEFAULT true NOT NULL,
	"first_visited_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "store_sessions" ADD CONSTRAINT "store_sessions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "store_sessions" ADD CONSTRAINT "store_sessions_customer_id_telegram_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."telegram_customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "store_sessions_store_created_idx" ON "store_sessions" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "store_sessions_store_eligible_created_idx" ON "store_sessions" USING btree ("store_id", "is_eligible", "created_at");
CREATE INDEX IF NOT EXISTS "store_sessions_store_customer_idx" ON "store_sessions" USING btree ("store_id", "customer_id");
CREATE INDEX IF NOT EXISTS "store_sessions_store_telegram_user_idx" ON "store_sessions" USING btree ("store_id", "telegram_user_id");
