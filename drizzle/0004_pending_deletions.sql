CREATE TABLE IF NOT EXISTS "pending_deletions" (
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

DO $$ BEGIN
 ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "pending_deletions_store_idx" ON "pending_deletions" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "pending_deletions_processed_idx" ON "pending_deletions" USING btree ("processed_at");
