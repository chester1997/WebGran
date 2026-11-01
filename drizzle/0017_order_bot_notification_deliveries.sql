BEGIN;

SET LOCAL lock_timeout = '3s';

SELECT pg_advisory_xact_lock(2026110102);

CREATE TABLE IF NOT EXISTS "order_bot_notification_deliveries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
    "recipient_id" uuid REFERENCES "bot_sale_notification_recipients"("id") ON DELETE CASCADE,
    "telegram_chat_id" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "sent_at" timestamp,
    "attempts" integer DEFAULT 0 NOT NULL,
    "claim_token" text,
    "claimed_at" timestamp,
    "error_message" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "order_bot_deliveries_order_bot_recipient_unique" UNIQUE ("order_id", "bot_id", "recipient_id")
);

CREATE INDEX IF NOT EXISTS "order_bot_deliveries_order_status_idx" ON "order_bot_notification_deliveries" ("order_id", "status");
CREATE INDEX IF NOT EXISTS "order_bot_deliveries_claim_token_idx" ON "order_bot_notification_deliveries" ("claim_token");

COMMIT;

