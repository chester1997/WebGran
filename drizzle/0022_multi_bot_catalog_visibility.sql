-- Migração 0022: Catálogo Multi-Bot, Governança de Visibilidade, Constraints Multi-Tenant e Rate Limiter Persistente
-- Execução estritamente transacional e 100% idempotente
BEGIN;

-- 1. Criação da tabela de visibilidade de produtos por bot
CREATE TABLE IF NOT EXISTS "product_bot_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
	"product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE cascade,
	"bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE cascade,
	"is_owner" boolean DEFAULT false NOT NULL,
	"can_deliver" boolean DEFAULT true NOT NULL,
	"delivery_block_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_bot_visibility_product_id_bot_id_unique" UNIQUE("product_id", "bot_id")
);

-- Índices otimizados para consultas de catálogo, Mini Apps e integridade multi-tenant
CREATE INDEX IF NOT EXISTS "product_bot_visibility_bot_product_idx" ON "product_bot_visibility" ("bot_id", "product_id");
CREATE INDEX IF NOT EXISTS "product_bot_visibility_store_bot_idx" ON "product_bot_visibility" ("store_id", "bot_id");
CREATE INDEX IF NOT EXISTS "product_bot_visibility_product_idx" ON "product_bot_visibility" ("product_id");

-- 2. Tabela persistente de rate limiting da autenticação Telegram (Vercel Serverless / Neon)
CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
	"key" text PRIMARY KEY,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_rate_limits_reset_at_idx" ON "auth_rate_limits" ("reset_at");

-- 3. Adicionar colunas de governança de catálogo na tabela products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "catalog_scope" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sharing_mode" text;

-- 4. Preservação Histórica e Idempotência:
-- Executa a classificação inicial apenas em produtos com catalog_scope ainda não inicializado (NULL).
-- Em uma segunda execução da migração, NENHUMA alteração legítima posterior do vendedor é sobrescrita.
UPDATE "products"
SET "catalog_scope" = 'STORE_GENERAL', "sharing_mode" = 'EXCLUSIVE'
WHERE "bot_id" IS NULL AND ("catalog_scope" IS NULL OR "catalog_scope" = '');

UPDATE "products"
SET "catalog_scope" = 'BOT_SPECIFIC', "sharing_mode" = 'EXCLUSIVE'
WHERE "bot_id" IS NOT NULL AND ("catalog_scope" IS NULL OR "catalog_scope" = '');

-- Garantir DEFAULT e NOT NULL para catalog_scope e sharing_mode
ALTER TABLE "products" ALTER COLUMN "catalog_scope" SET DEFAULT 'STORE_GENERAL';
ALTER TABLE "products" ALTER COLUMN "catalog_scope" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "sharing_mode" SET DEFAULT 'EXCLUSIVE';
ALTER TABLE "products" ALTER COLUMN "sharing_mode" SET NOT NULL;

-- 5. Criar registros iniciais de visibilidade proprietária para os produtos que possuem bot_id
INSERT INTO "product_bot_visibility" ("id", "store_id", "product_id", "bot_id", "is_owner", "can_deliver")
SELECT gen_random_uuid(), "store_id", "id", "bot_id", true, true
FROM "products"
WHERE "bot_id" IS NOT NULL
ON CONFLICT ("product_id", "bot_id") DO NOTHING;

-- 6. Adicionar colunas de rastreio de origem e modo de entrega na tabela orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "origin_bot_id" uuid REFERENCES "telegram_bots"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "owner_bot_id" uuid REFERENCES "telegram_bots"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_mode" text DEFAULT 'LINK' NOT NULL;

-- 7. Constraints de Integridade Estrutural Multi-Tenant e CHECK constraints
DO $$
BEGIN
  -- 7.1 Garantir unicidade de (id, store_id) em telegram_bots para permitir FK composta
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_bots_id_store_id_unique'
  ) THEN
    ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_id_store_id_unique" UNIQUE ("id", "store_id");
  END IF;

  -- 7.2 Garantir unicidade de (id, store_id) em products para permitir FK composta
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_id_store_id_unique'
  ) THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_id_store_id_unique" UNIQUE ("id", "store_id");
  END IF;

  -- 7.3 Impedir que products.bot_id aponte para bot de outra loja (Integridade Multi-Tenant)
  -- A exclusão de um bot anula estritamente bot_id, preservando store_id NOT NULL intacto.
  -- No PostgreSQL 15+ (Neon / PG 16), utiliza-se nativamente ON DELETE SET NULL ("bot_id").
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_bot_store_fk'
  ) THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_bot_store_fk" 
      FOREIGN KEY ("bot_id", "store_id") REFERENCES "telegram_bots"("id", "store_id") ON DELETE SET NULL ("bot_id");
  END IF;

  -- 7.4 Impedir que product_bot_visibility vincule produto e loja divergentes
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_bot_visibility_product_store_fk'
  ) THEN
    ALTER TABLE "product_bot_visibility" ADD CONSTRAINT "product_bot_visibility_product_store_fk" 
      FOREIGN KEY ("product_id", "store_id") REFERENCES "products"("id", "store_id") ON DELETE CASCADE;
  END IF;

  -- 7.5 Impedir que product_bot_visibility vincule bot e loja divergentes
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_bot_visibility_bot_store_fk'
  ) THEN
    ALTER TABLE "product_bot_visibility" ADD CONSTRAINT "product_bot_visibility_bot_store_fk" 
      FOREIGN KEY ("bot_id", "store_id") REFERENCES "telegram_bots"("id", "store_id") ON DELETE CASCADE;
  END IF;

  -- 7.6 CHECK constraints para escopos de catálogo e modos de entrega
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_catalog_scope_check'
  ) THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_catalog_scope_check" 
      CHECK (catalog_scope IN ('STORE_GENERAL', 'BOT_GENERAL', 'BOT_SPECIFIC'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_sharing_mode_check'
  ) THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_sharing_mode_check" 
      CHECK (sharing_mode IN ('EXCLUSIVE', 'ALL_EXISTING', 'CUSTOM'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_mode_check'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_mode_check" 
      CHECK (delivery_mode IN ('LINK', 'BOT_PERMISSION'));
  END IF;
END $$;

-- 8. Trigger de Integridade Multi-Tenant em products:
-- Impede categoricamente a associação de um produto com um bot de outra loja
CREATE OR REPLACE FUNCTION check_product_bot_store_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bot_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "telegram_bots" 
      WHERE "id" = NEW.bot_id AND "store_id" = NEW.store_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: O bot % não pertence à loja % do produto', NEW.bot_id, NEW.store_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_product_bot_store ON "products";
CREATE TRIGGER trg_check_product_bot_store
BEFORE INSERT OR UPDATE OF "bot_id", "store_id" ON "products"
FOR EACH ROW
EXECUTE FUNCTION check_product_bot_store_match();

COMMIT;
