CREATE TABLE IF NOT EXISTS "seller_storage_usage" (
	"seller_id" uuid PRIMARY KEY NOT NULL,
	"used_bytes" bigint DEFAULT 0 NOT NULL,
	"reserved_bytes" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "seller_storage_usage" ADD CONSTRAINT "seller_storage_usage_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "storage_reservations" (
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

DO $$ BEGIN
 ALTER TABLE "storage_reservations" ADD CONSTRAINT "storage_reservations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "storage_reservations" ADD CONSTRAINT "storage_reservations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "storage_reservations_seller_idx" ON "storage_reservations" USING btree ("seller_id");
CREATE INDEX IF NOT EXISTS "storage_reservations_status_idx" ON "storage_reservations" USING btree ("status");
CREATE INDEX IF NOT EXISTS "storage_reservations_expires_idx" ON "storage_reservations" USING btree ("expires_at");
