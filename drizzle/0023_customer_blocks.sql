-- Migration: 0023_customer_blocks.sql
-- Descrição: bloqueio de clientes por loja (o cliente bloqueado não usa o bot, o Mini App nem o checkout).
-- Puramente aditiva: cria uma tabela nova e não altera nenhuma tabela existente.
-- O código é "fail-open": até esta migration rodar, ninguém é tratado como bloqueado.

CREATE TABLE IF NOT EXISTS "customer_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "telegram_user_id" text NOT NULL,
  "reason" text,
  "blocked_by" uuid,
  "blocked_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_blocks_store_user_unique_idx"
  ON "customer_blocks" ("store_id", "telegram_user_id");
