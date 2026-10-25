BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra contention
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de carrinhos persistentes: 2026102501
SELECT pg_advisory_xact_lock(2026102501);

-- 3. Validação prévia de compatibilidade do schema existente
DO $$
BEGIN
    -- 3.1 Validar tabela stores
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela stores não encontrada no schema public.';
    END IF;

    -- 3.2 Validar tabela telegram_customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'telegram_customers') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela telegram_customers não encontrada no schema public.';
    END IF;

    -- 3.3 Validar tabela products
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela products não encontrada no schema public.';
    END IF;
END $$;

-- 4. Criação da tabela carts (idempotente)
CREATE TABLE IF NOT EXISTS "carts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
    "customer_id" uuid NOT NULL REFERENCES "telegram_customers"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 5. Criação da tabela cart_items (idempotente)
CREATE TABLE IF NOT EXISTS "cart_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "cart_id" uuid NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 6. Criação de índices e restrições de unicidade
CREATE UNIQUE INDEX IF NOT EXISTS "carts_store_customer_uidx" ON "carts" ("store_id", "customer_id");
CREATE INDEX IF NOT EXISTS "carts_store_customer_idx" ON "carts" ("store_id", "customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_product_uidx" ON "cart_items" ("cart_id", "product_id");
CREATE INDEX IF NOT EXISTS "cart_items_cart_idx" ON "cart_items" ("cart_id");
CREATE INDEX IF NOT EXISTS "cart_items_product_idx" ON "cart_items" ("product_id");

COMMIT;
