BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra travamentos
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de comissão e split: 2026102201
SELECT pg_advisory_xact_lock(2026102201);

-- 3. Validação prévia explícita de compatibilidade do schema existente
-- Aborta a transação com erro explícito se qualquer objeto preexistente for incompatível,
-- sem tentar corrigir silenciosamente nem alterar dados históricos.
DO $$
DECLARE
    v_type TEXT;
    v_nullable TEXT;
    v_count INTEGER;
BEGIN
    -- 3.1 Validar tabela users (necessária para chaves estrangeiras)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela users não encontrada no schema public.';
    END IF;

    SELECT data_type INTO v_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';
    IF v_type <> 'uuid' THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Coluna users.id deve ser uuid, encontrado: %', v_type;
    END IF;

    -- 3.2 Validar tabela orders (necessária para split e integridade da auditoria)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela orders não encontrada no schema public.';
    END IF;

    SELECT data_type INTO v_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id';
    IF v_type <> 'uuid' THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Coluna orders.id deve ser uuid, encontrado: %', v_type;
    END IF;

    -- Validar compatibilidade de tipos se as colunas de split já existirem em orders
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'split_status') THEN
        SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'split_status';
        IF v_type <> 'text' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: orders.split_status deve ser text, encontrado: %', v_type;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'split_amount_cents') THEN
        SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'split_amount_cents';
        IF v_type <> 'integer' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: orders.split_amount_cents deve ser integer, encontrado: %', v_type;
        END IF;
    END IF;

    -- 3.3 Validar tabela seller_payment_connections se existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seller_payment_connections') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_payment_connections' AND column_name = 'webhook_id') THEN
            SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_payment_connections' AND column_name = 'webhook_id';
            IF v_type <> 'text' THEN
                RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: seller_payment_connections.webhook_id deve ser text, encontrado: %', v_type;
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_payment_connections' AND column_name = 'webhook_secret_encrypted') THEN
            SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_payment_connections' AND column_name = 'webhook_secret_encrypted';
            IF v_type <> 'text' THEN
                RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: seller_payment_connections.webhook_secret_encrypted deve ser text, encontrado: %', v_type;
            END IF;
        END IF;
    END IF;

    -- 3.4 Validar tabela platform_commission_settings se já existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_commission_settings') THEN
        SELECT data_type, is_nullable INTO v_type, v_nullable FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_commission_settings' AND column_name = 'fee_cents';
        IF v_type <> 'integer' OR v_nullable <> 'NO' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: platform_commission_settings.fee_cents deve ser integer NOT NULL, encontrado tipo: %, nullable: %', v_type, v_nullable;
        END IF;

        SELECT COUNT(*) INTO v_count FROM platform_commission_settings;
        IF v_count > 1 THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: A tabela platform_commission_settings contém % registros. Apenas 1 registro singleton é permitido. Faça a conciliação manual antes de criar a restrição de unicidade.', v_count;
        END IF;
    END IF;

    -- 3.5 Validar tabela platform_commission_audit_logs se já existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_commission_audit_logs') THEN
        SELECT data_type, is_nullable INTO v_type, v_nullable FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_commission_audit_logs' AND column_name = 'previous_fee_cents';
        IF v_type <> 'integer' OR v_nullable <> 'NO' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: platform_commission_audit_logs.previous_fee_cents deve ser integer NOT NULL, encontrado tipo: %, nullable: %', v_type, v_nullable;
        END IF;

        SELECT data_type, is_nullable INTO v_type, v_nullable FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'platform_commission_audit_logs' AND column_name = 'new_fee_cents';
        IF v_type <> 'integer' OR v_nullable <> 'NO' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: platform_commission_audit_logs.new_fee_cents deve ser integer NOT NULL, encontrado tipo: %, nullable: %', v_type, v_nullable;
        END IF;
    END IF;

    -- 3.6 Validar tabela payment_webhook_events se já existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_webhook_events') THEN
        SELECT data_type, is_nullable INTO v_type, v_nullable FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_webhook_events' AND column_name = 'provider';
        IF v_type <> 'text' OR v_nullable <> 'NO' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: payment_webhook_events.provider deve ser text NOT NULL, encontrado tipo: %, nullable: %', v_type, v_nullable;
        END IF;

        SELECT data_type, is_nullable INTO v_type, v_nullable FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_webhook_events' AND column_name = 'event_id';
        IF v_type <> 'text' OR v_nullable <> 'NO' THEN
            RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: payment_webhook_events.event_id deve ser text NOT NULL, encontrado tipo: %, nullable: %', v_type, v_nullable;
        END IF;
    END IF;
END $$;

-- 4. Tabela de configuração oficial da comissão da plataforma
CREATE TABLE IF NOT EXISTS platform_commission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_cents INTEGER NOT NULL DEFAULT 50,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_name TEXT,
    updated_by_email TEXT
);

-- 5. Singleton constraint: garante no nível de banco de dados que no máximo UMA linha pode existir nesta tabela.
-- No PostgreSQL, uma expressão booleana constante ((true)) indexada com UNIQUE assegura que
-- qualquer tentativa de inserir uma segunda linha seja rejeitada com erro de violação de unicidade.
CREATE UNIQUE INDEX IF NOT EXISTS platform_commission_single_row_idx
ON platform_commission_settings ((true));

-- 6. Seed idempotente: insere 50 centavos padrão apenas se a tabela estiver vazia
INSERT INTO platform_commission_settings (id, fee_cents, updated_at)
SELECT gen_random_uuid(), 50, NOW()
WHERE NOT EXISTS (SELECT 1 FROM platform_commission_settings);

-- 7. Tabela de auditoria de alterações administrativas da comissão
CREATE TABLE IF NOT EXISTS platform_commission_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    previous_fee_cents INTEGER NOT NULL,
    new_fee_cents INTEGER NOT NULL,
    changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name TEXT,
    changed_by_email TEXT,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commission_audit_created_idx 
ON platform_commission_audit_logs (created_at);

-- 8. Colunas de integração de webhook na tabela seller_payment_connections
ALTER TABLE seller_payment_connections
ADD COLUMN IF NOT EXISTS webhook_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_secret_encrypted TEXT;

-- 9. Tabela de eventos de webhook para deduplicação idempotente
-- A constraint UNIQUE (provider, event_id) cria automaticamente o índice exclusivo correspondente no PostgreSQL,
-- garantindo a integridade sem necessidade de índice btree secundário redundante.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT,
    connection_id TEXT,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    payload JSONB,
    CONSTRAINT payment_webhook_events_provider_event_unique UNIQUE (provider, event_id)
);

-- 10. Colunas de rastreamento de split na tabela orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS split_status TEXT,
ADD COLUMN IF NOT EXISTS split_amount_cents INTEGER,
ADD COLUMN IF NOT EXISTS split_confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS split_error TEXT,
ADD COLUMN IF NOT EXISTS split_details JSONB;

-- 11. Tabela de auditoria dedicada para conciliação financeira do split
-- ON DELETE RESTRICT: impede a destruição de registros de auditoria financeira por deleção de pedidos
CREATE TABLE IF NOT EXISTS platform_split_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    action TEXT NOT NULL,
    split_amount_cents INTEGER NOT NULL,
    platform_account_id TEXT,
    evidence_details JSONB,
    reconciled_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reconciled_by_name TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS split_audit_order_idx 
ON platform_split_audit_logs (order_id);

CREATE INDEX IF NOT EXISTS split_audit_created_idx 
ON platform_split_audit_logs (created_at);

COMMIT;
