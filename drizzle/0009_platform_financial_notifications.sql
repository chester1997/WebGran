BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra contention
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de notificações financeiras da plataforma: 2026102402
SELECT pg_advisory_xact_lock(2026102402);

-- 3. Validação prévia de compatibilidade do schema existente
DO $$
DECLARE
    v_type TEXT;
BEGIN
    -- 3.1 Validar tabela orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela orders não encontrada no schema public.';
    END IF;

    -- 3.2 Validar tabela users
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela users não encontrada no schema public.';
    END IF;
END $$;

-- 4. Criação da tabela platform_financial_notification_events (idempotente)
CREATE TABLE IF NOT EXISTS "platform_financial_notification_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "event_type" text NOT NULL,
    "recipient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "platform_fee" numeric(10, 2),
    "split_amount_cents" integer,
    "title" text NOT NULL,
    "body" text NOT NULL,
    "url" text,
    "sent_at" timestamp DEFAULT now() NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- 5. Criação de índices para unicidade e busca rápida
CREATE UNIQUE INDEX IF NOT EXISTS "platform_fin_notif_order_event_uidx" ON "platform_financial_notification_events" ("order_id", "event_type");
CREATE INDEX IF NOT EXISTS "platform_fin_notif_recipient_idx" ON "platform_financial_notification_events" ("recipient_user_id");
CREATE INDEX IF NOT EXISTS "platform_fin_notif_order_idx" ON "platform_financial_notification_events" ("order_id");

COMMIT;
