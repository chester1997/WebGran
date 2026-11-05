-- Migration 0020: Controle de Execução por Lease, Checkpoints e Estados Outbound
-- 1. Colunas aditivas para lease e checkpoints no Webhook
ALTER TABLE "telegram_webhook_updates"
  ADD COLUMN IF NOT EXISTS "execution_id" text,
  ADD COLUMN IF NOT EXISTS "step" text NOT NULL DEFAULT 'reserved',
  ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp with time zone DEFAULT (now() + interval '30 seconds') NOT NULL,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_error" text;

CREATE INDEX IF NOT EXISTS "telegram_webhook_updates_lease_idx"
  ON "telegram_webhook_updates" ("bot_id", "status", "lease_expires_at");

CREATE INDEX IF NOT EXISTS "telegram_webhook_updates_execution_idx"
  ON "telegram_webhook_updates" ("execution_id");

-- 2. Colunas aditivas para máquina de estados no Outbound
ALTER TABLE "telegram_messages"
  ADD COLUMN IF NOT EXISTS "sending_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "telegram_messages_status_created_idx"
  ON "telegram_messages" ("bot_id", "status", "created_at");

