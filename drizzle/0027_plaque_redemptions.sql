-- Migration: 0027_plaque_redemptions.sql
-- Descrição: pedidos de resgate das placas físicas de faturamento (Premiações).
-- O vendedor que bate a meta pede a placa informando nome, telefone e endereço;
-- o admin acompanha o status (pedido, produção, enviada, entregue) e o rastreio.
-- Puramente aditiva: só cria uma tabela nova. Até rodar, o botão "Resgatar" avisa que ainda não está disponível.

CREATE TABLE IF NOT EXISTS "plaque_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "plaque_value" integer NOT NULL,
  "full_name" text NOT NULL,
  "phone" text NOT NULL,
  "zip_code" text NOT NULL,
  "street" text NOT NULL,
  "number" text NOT NULL,
  "complement" text,
  "district" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "notes" text,
  "revenue_at_request" numeric(14, 2) NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'PRODUCING', 'SHIPPED', 'DELIVERED', 'CANCELED')),
  "tracking_code" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Um pedido ativo por placa e loja (um pedido cancelado libera um novo).
CREATE UNIQUE INDEX IF NOT EXISTS "plaque_redemptions_active_unique_idx"
  ON "plaque_redemptions" ("store_id", "plaque_value")
  WHERE "status" <> 'CANCELED';

CREATE INDEX IF NOT EXISTS "plaque_redemptions_status_idx"
  ON "plaque_redemptions" ("status", "created_at");
