BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra contenção de locks
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de faixas progressivas: 2026102504
SELECT pg_advisory_xact_lock(2026102504);

-- 3. Validação prévia explícita de compatibilidade do schema existente
DO $$
BEGIN
    -- 3.1 Validar tabela stores
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela stores não encontrada no schema public.';
    END IF;

    -- 3.2 Validar tabela combos
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'combos') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela combos não encontrada no schema public.';
    END IF;

    -- 3.3 Validar tabela products
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela products não encontrada no schema public.';
    END IF;

    -- 3.4 Validar tabela orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela orders não encontrada no schema public.';
    END IF;

    -- 3.5 Validar tabela order_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela order_items não encontrada no schema public.';
    END IF;
END $$;

-- 4. Evolução não destrutiva da tabela combos para diferenciar combos legados de ofertas progressivas
DO $$
BEGIN
    -- 4.1 Adicionar coluna 'type' se não existir ('curated' | 'progressive')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'combos' AND column_name = 'type'
    ) THEN
        ALTER TABLE "combos" ADD COLUMN "type" text DEFAULT 'curated' NOT NULL;
    END IF;

    -- 4.2 Adicionar coluna 'eligibility_mode' se não existir ('all_products' | 'specific_products')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'combos' AND column_name = 'eligibility_mode'
    ) THEN
        ALTER TABLE "combos" ADD COLUMN "eligibility_mode" text DEFAULT 'all_products' NOT NULL;
    END IF;
END $$;

-- 5. Criação da tabela combo_tiers (faixas progressivas de quantidade e preço)
CREATE TABLE IF NOT EXISTS "combo_tiers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "combo_id" uuid NOT NULL REFERENCES "combos"("id") ON DELETE CASCADE,
    "min_quantity" integer NOT NULL,
    "price" numeric(10, 2) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- 6. Índices e restrições para combo_tiers
CREATE UNIQUE INDEX IF NOT EXISTS "combo_tiers_combo_quantity_uidx" ON "combo_tiers" ("combo_id", "min_quantity");
CREATE INDEX IF NOT EXISTS "combo_tiers_combo_idx" ON "combo_tiers" ("combo_id");

DO $$
BEGIN
    -- 6.1 Restrição CHECK: min_quantity deve ser no mínimo 2 unidades
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'combo_tiers_min_quantity_check'
          AND conrelid = 'public.combo_tiers'::regclass
    ) THEN
        ALTER TABLE "combo_tiers"
        ADD CONSTRAINT "combo_tiers_min_quantity_check"
        CHECK ("min_quantity" >= 2);
    END IF;

    -- 6.2 Restrição CHECK: price deve ser estritamente positivo
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'combo_tiers_price_check'
          AND conrelid = 'public.combo_tiers'::regclass
    ) THEN
        ALTER TABLE "combo_tiers"
        ADD CONSTRAINT "combo_tiers_price_check"
        CHECK ("price" > 0);
    END IF;
END $$;

-- 7. Evolução não destrutiva da tabela orders para registrar snapshot imutável e desconto da oferta progressiva
DO $$
BEGIN
    -- 7.1 Adicionar coluna progressive_combo_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'progressive_combo_id'
    ) THEN
        ALTER TABLE "orders" ADD COLUMN "progressive_combo_id" uuid REFERENCES "combos"("id") ON DELETE SET NULL;
    END IF;

    -- 7.2 Adicionar coluna progressive_combo_discount se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'progressive_combo_discount'
    ) THEN
        ALTER TABLE "orders" ADD COLUMN "progressive_combo_discount" numeric(10, 2) DEFAULT 0;
    END IF;

    -- 7.3 Adicionar coluna progressive_combo_snapshot se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'progressive_combo_snapshot'
    ) THEN
        ALTER TABLE "orders" ADD COLUMN "progressive_combo_snapshot" jsonb;
    END IF;
END $$;

-- 8. Índice para otimização de consultas e relatórios em orders
CREATE INDEX IF NOT EXISTS "orders_progressive_combo_idx" ON "orders" ("progressive_combo_id");

COMMIT;
