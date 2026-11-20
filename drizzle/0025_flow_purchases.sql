-- Migration: 0025_flow_purchases.sql
-- Descrição: compras de planos dos fluxos (Meus Fluxos). O plano é só valor + tempo;
-- a entrega é um grupo, supergrupo ou canal do Telegram (ID) ou um link de convite.
-- Não usa produtos. O pagamento continua na tabela "orders" (Pix, split, Financeiro).
-- Puramente aditiva: só cria uma tabela nova. Até rodar, o fluxo não vende e nada mais muda.

CREATE TABLE IF NOT EXISTS "flow_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "telegram_customers"("id") ON DELETE CASCADE,
  "flow_id" uuid REFERENCES "sales_flows"("id") ON DELETE SET NULL,
  "bot_id" uuid REFERENCES "telegram_bots"("id") ON DELETE SET NULL,
  "plan_id" text NOT NULL,
  "plan_name" text NOT NULL,
  "price" numeric(10, 2) NOT NULL,
  "period_unit" text NOT NULL,
  "period_amount" integer NOT NULL DEFAULT 1,
  "delivery_type" text NOT NULL CHECK ("delivery_type" IN ('group', 'link')),
  "delivery_value" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED')),
  "invite_link" text,
  "delivered_at" timestamp,
  "expires_at" timestamp,
  "expired_at" timestamp,
  "removal_status" text,
  "error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_purchases_order_unique_idx" ON "flow_purchases" ("order_id");
CREATE INDEX IF NOT EXISTS "flow_purchases_store_idx" ON "flow_purchases" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "flow_purchases_expiry_idx" ON "flow_purchases" ("status", "expires_at");

-- Limpeza: a versão anterior criava produtos ocultos para os planos (slug "fluxo-<8 hex>-<id>").
-- Eles não são mais usados. Só ARQUIVA (não apaga), para pedidos antigos continuarem válidos.
UPDATE "products"
SET "status" = 'archived', "updated_at" = now()
WHERE "slug" ~ '^fluxo-[0-9a-f]{8}-[a-z0-9]{4,24}$'
  AND "catalog_scope" = 'BOT_SPECIFIC'
  AND "status" <> 'archived';
