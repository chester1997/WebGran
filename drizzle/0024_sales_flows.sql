-- Migration: 0024_sales_flows.sql
-- Descrição: Automações → Meus Fluxos (fluxo básico e avançado), pastas e vínculo fluxo ↔ bot.
-- Puramente aditiva: só cria tabelas novas. Nenhuma tabela existente é alterada.
-- O código é "fail-open": até esta migration rodar, a página Meus Fluxos mostra um aviso
-- e nenhum bot muda de comportamento.

CREATE TABLE IF NOT EXISTS "sales_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('basic', 'advanced')),
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published')),
  "folder" text,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "sales_flows_store_idx" ON "sales_flows" ("store_id");

-- Um bot usa no máximo um fluxo (unique em bot_id).
CREATE TABLE IF NOT EXISTS "sales_flow_bots" (
  "flow_id" uuid NOT NULL REFERENCES "sales_flows"("id") ON DELETE CASCADE,
  "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sales_flow_bots_bot_unique_idx" ON "sales_flow_bots" ("bot_id");
CREATE INDEX IF NOT EXISTS "sales_flow_bots_flow_idx" ON "sales_flow_bots" ("flow_id");

CREATE TABLE IF NOT EXISTS "sales_flow_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sales_flow_folders_store_name_idx" ON "sales_flow_folders" ("store_id", "name");
