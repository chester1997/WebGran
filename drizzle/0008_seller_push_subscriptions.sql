BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra travamentos
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de assinaturas push PWA: 2026102401
SELECT pg_advisory_xact_lock(2026102401);

-- 3. Validação prévia explícita de compatibilidade do schema existente
DO $$
DECLARE
    v_type TEXT;
BEGIN
    -- 3.1 Validar tabela users (necessária para chave estrangeira de proprietário da assinatura)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela users não encontrada no schema public.';
    END IF;

    SELECT data_type INTO v_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';
    IF v_type <> 'uuid' THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Coluna users.id deve ser uuid, encontrado: %', v_type;
    END IF;
END $$;

-- 4. Criação da tabela seller_push_subscriptions (idempotente)
CREATE TABLE IF NOT EXISTS "seller_push_subscriptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "endpoint" text NOT NULL,
    "p256dh" text NOT NULL,
    "auth" text NOT NULL,
    "user_agent" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "failure_count" integer DEFAULT 0 NOT NULL,
    "last_success_at" timestamp,
    "last_failure_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "seller_push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
);

-- 5. Criação de índices otimizados para busca por vendedor ativo e deduplicação de endpoint
CREATE INDEX IF NOT EXISTS "seller_push_subs_user_active_idx" ON "seller_push_subscriptions" ("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "seller_push_subs_endpoint_idx" ON "seller_push_subscriptions" ("endpoint");

COMMIT;
