BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco contra contenção de locks
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo
-- Chave única determinística para migração de destinatários e tokens de notificação por bot: 2026110101
SELECT pg_advisory_xact_lock(2026110101);

-- 3. Criação da tabela de destinatários de avisos de venda por bot
CREATE TABLE IF NOT EXISTS "bot_sale_notification_recipients" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
    "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
    "telegram_chat_id" text NOT NULL,
    "display_name" text,
    "status" text DEFAULT 'active' NOT NULL, -- 'active' | 'blocked' | 'disconnected'
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "bot_sale_notification_recipients_bot_chat_unique" UNIQUE ("bot_id", "telegram_chat_id")
);

-- Índices para busca rápida de destinatários por bot e loja
CREATE INDEX IF NOT EXISTS "bot_sale_recipients_bot_idx" ON "bot_sale_notification_recipients" ("bot_id", "status");
CREATE INDEX IF NOT EXISTS "bot_sale_recipients_store_idx" ON "bot_sale_notification_recipients" ("store_id");

-- 4. Criação da tabela de tokens temporários de ativação de avisos (1 uso, expiração 15 min, SHA-256)
CREATE TABLE IF NOT EXISTS "bot_sale_notification_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
    "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
    "token_hash" text NOT NULL UNIQUE,
    "expires_at" timestamp NOT NULL,
    "used_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Índice para validação do hash e expiração
CREATE INDEX IF NOT EXISTS "bot_sale_tokens_hash_idx" ON "bot_sale_notification_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "bot_sale_tokens_bot_idx" ON "bot_sale_notification_tokens" ("bot_id");

-- 5. Migração de dados legados:
-- Migrar o ID salvo hoje em stores.telegram_notification_id como destinatário ativo de todos os bots da respectiva loja, sem perda de dados
INSERT INTO "bot_sale_notification_recipients" ("store_id", "bot_id", "telegram_chat_id", "display_name", "status")
SELECT 
    s."id" AS store_id,
    b."id" AS bot_id,
    TRIM(s."telegram_notification_id") AS telegram_chat_id,
    'Lojista Principal' AS display_name,
    'active' AS status
FROM "stores" s
JOIN "telegram_bots" b ON b."store_id" = s."id"
WHERE s."telegram_notification_id" IS NOT NULL
  AND TRIM(s."telegram_notification_id") != ''
  AND TRIM(s."telegram_notification_id") != TRIM(COALESCE(b."bot_id", ''))
ON CONFLICT ("bot_id", "telegram_chat_id") DO NOTHING;

COMMIT;

