BEGIN;

SET LOCAL lock_timeout = '3s';

SELECT pg_advisory_xact_lock(2026110401);

CREATE TABLE IF NOT EXISTS "telegram_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
    "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
    "customer_id" uuid REFERENCES "telegram_customers"("id") ON DELETE SET NULL,
    "telegram_user_id" text NOT NULL,
    "telegram_chat_id" text NOT NULL,
    "telegram_message_id" text,
    "telegram_update_id" text,
    "direction" text NOT NULL,
    "message_type" text DEFAULT 'text' NOT NULL,
    "text" text,
    "media_url" text,
    "status" text DEFAULT 'delivered' NOT NULL,
    "error_message" text,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "telegram_messages_store_id_idx" ON "telegram_messages" ("store_id");
CREATE INDEX IF NOT EXISTS "telegram_messages_bot_id_idx" ON "telegram_messages" ("bot_id");
CREATE INDEX IF NOT EXISTS "telegram_messages_customer_id_idx" ON "telegram_messages" ("customer_id");
CREATE INDEX IF NOT EXISTS "telegram_messages_user_id_idx" ON "telegram_messages" ("telegram_user_id");
CREATE INDEX IF NOT EXISTS "telegram_messages_update_id_idx" ON "telegram_messages" ("telegram_update_id");
CREATE INDEX IF NOT EXISTS "telegram_messages_created_at_idx" ON "telegram_messages" ("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_messages_inbound_unique_idx" 
  ON "telegram_messages" ("bot_id", "telegram_message_id", "direction")
  WHERE "telegram_message_id" IS NOT NULL AND "direction" = 'inbound';

COMMIT;

