BEGIN;

SET LOCAL lock_timeout = '3s';

SELECT pg_advisory_xact_lock(2026110402);

-- 1. Deduplicação persistente e atômica de updates do Webhook
CREATE TABLE IF NOT EXISTS "telegram_webhook_updates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
    "update_id" text NOT NULL,
    "status" text DEFAULT 'processing' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_webhook_updates_bot_update_unique_idx"
  ON "telegram_webhook_updates" ("bot_id", "update_id");

CREATE INDEX IF NOT EXISTS "telegram_webhook_updates_status_idx"
  ON "telegram_webhook_updates" ("bot_id", "status");

CREATE INDEX IF NOT EXISTS "telegram_webhook_updates_created_at_idx"
  ON "telegram_webhook_updates" ("created_at");

-- 2. Idempotência do envio outbound em telegram_messages
ALTER TABLE "telegram_messages" 
  ADD COLUMN IF NOT EXISTS "client_message_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_messages_bot_client_msg_unique_idx"
  ON "telegram_messages" ("bot_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;

COMMIT;

