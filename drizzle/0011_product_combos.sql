BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra contention
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de combos de produtos: 2026102502
SELECT pg_advisory_xact_lock(2026102502);

-- 3. Validação prévia de compatibilidade do schema existente
DO $$
BEGIN
    -- 3.1 Validar tabela stores
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela stores não encontrada no schema public.';
    END IF;

    -- 3.2 Validar tabela products
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela products não encontrada no schema public.';
    END IF;

    -- 3.3 Validar tabela carts
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'carts') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela carts não encontrada no schema public.';
    END IF;

    -- 3.4 Validar tabela cart_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cart_items') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela cart_items não encontrada no schema public.';
    END IF;

    -- 3.5 Validar tabela orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela orders não encontrada no schema public.';
    END IF;

    -- 3.6 Validar tabela order_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela order_items não encontrada no schema public.';
    END IF;
END $$;

-- 4. Criação da tabela combos (idempotente)
CREATE TABLE IF NOT EXISTS "combos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "slug" text NOT NULL,
    "description" text,
    "cover_url" text,
    "price" numeric(10, 2) NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 5. Criação da tabela combo_products (idempotente)
CREATE TABLE IF NOT EXISTS "combo_products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "combo_id" uuid NOT NULL REFERENCES "combos"("id") ON DELETE CASCADE,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- 6. Índices para combos e combo_products
CREATE UNIQUE INDEX IF NOT EXISTS "combos_store_slug_uidx" ON "combos" ("store_id", "slug");
CREATE INDEX IF NOT EXISTS "combos_store_status_idx" ON "combos" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "combos_store_idx" ON "combos" ("store_id");

CREATE UNIQUE INDEX IF NOT EXISTS "combo_products_combo_product_uidx" ON "combo_products" ("combo_id", "product_id");
CREATE INDEX IF NOT EXISTS "combo_products_combo_idx" ON "combo_products" ("combo_id");
CREATE INDEX IF NOT EXISTS "combo_products_product_idx" ON "combo_products" ("product_id");

-- 7. Alteração da tabela cart_items para suportar combos
DO $$
BEGIN
    -- 7.1 Adicionar coluna combo_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'combo_id') THEN
        ALTER TABLE "cart_items" ADD COLUMN "combo_id" uuid REFERENCES "combos"("id") ON DELETE CASCADE;
    END IF;

    -- 7.2 Permitir product_id nulo para suportar itens do tipo combo
    ALTER TABLE "cart_items" ALTER COLUMN "product_id" DROP NOT NULL;

    -- 7.3 Restrição CHECK para garantir que o item seja exclusivamente produto avulso ou combo
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cart_items_item_type_check' 
          AND conrelid = 'public.cart_items'::regclass
    ) THEN
        ALTER TABLE "cart_items" 
        ADD CONSTRAINT "cart_items_item_type_check" 
        CHECK (
            ("product_id" IS NOT NULL AND "combo_id" IS NULL) OR 
            ("product_id" IS NULL AND "combo_id" IS NOT NULL)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "cart_items_combo_idx" ON "cart_items" ("combo_id");
DROP INDEX IF EXISTS "cart_items_cart_product_uidx";
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_product_uidx" ON "cart_items" ("cart_id", "product_id") WHERE "product_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_combo_uidx" ON "cart_items" ("cart_id", "combo_id") WHERE "combo_id" IS NOT NULL;

-- 8. Alteração da tabela order_items para suportar combos e snapshot congelado
DO $$
BEGIN
    -- 8.1 Adicionar coluna combo_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'combo_id') THEN
        ALTER TABLE "order_items" ADD COLUMN "combo_id" uuid REFERENCES "combos"("id") ON DELETE RESTRICT;
    END IF;

    -- 8.2 Adicionar coluna combo_snapshot se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'combo_snapshot') THEN
        ALTER TABLE "order_items" ADD COLUMN "combo_snapshot" jsonb;
    END IF;

    -- 8.3 Permitir product_id nulo para pedidos de combos
    ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;

    -- 8.4 Restrição CHECK para garantir que o item seja exclusivamente produto avulso ou combo
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'order_items_item_type_check' 
          AND conrelid = 'public.order_items'::regclass
    ) THEN
        ALTER TABLE "order_items" 
        ADD CONSTRAINT "order_items_item_type_check" 
        CHECK (
            ("product_id" IS NOT NULL AND "combo_id" IS NULL) OR 
            ("product_id" IS NULL AND "combo_id" IS NOT NULL)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_items_order_idx" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_idx" ON "order_items" ("product_id");
CREATE INDEX IF NOT EXISTS "order_items_combo_idx" ON "order_items" ("combo_id");

COMMIT;
