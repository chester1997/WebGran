-- Migration: 0026_flow_engine.sql
-- Descrição: liga as seções "em breve" do Fluxo Básico (Upsell, Downsell, Order Bump, Mimos,
-- Rastreamento, Expiração com desconto e Disparo).
-- Puramente aditiva: só cria colunas e tabelas novas. Não mexe em pedidos, produtos nem mídias.

-- 1) Compras do fluxo: tipo da compra e extras (Order Bump) no mesmo Pix.
ALTER TABLE "flow_purchases" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'plan';
ALTER TABLE "flow_purchases" ADD COLUMN IF NOT EXISTS "extras" jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Mimo não tem entrega: aceita 'none'.
ALTER TABLE "flow_purchases" DROP CONSTRAINT IF EXISTS "flow_purchases_delivery_type_check";
ALTER TABLE "flow_purchases" ADD CONSTRAINT "flow_purchases_delivery_type_check" CHECK ("delivery_type" IN ('group', 'link', 'none'));

-- 2) Fila de tarefas agendadas do fluxo (downsell, upsell, disparo).
CREATE TABLE IF NOT EXISTS "flow_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
  "flow_id" uuid REFERENCES "sales_flows"("id") ON DELETE CASCADE,
  "telegram_user_id" text NOT NULL,
  "kind" text NOT NULL,
  "ref" text NOT NULL DEFAULT '',
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "run_at" timestamp NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "flow_jobs_due_idx" ON "flow_jobs" ("status", "run_at");
CREATE INDEX IF NOT EXISTS "flow_jobs_user_idx" ON "flow_jobs" ("bot_id", "telegram_user_id", "status");
-- A mesma tarefa pendente não é agendada duas vezes para a mesma pessoa.
CREATE UNIQUE INDEX IF NOT EXISTS "flow_jobs_pending_unique_idx" ON "flow_jobs" ("bot_id", "telegram_user_id", "kind", "ref") WHERE "status" = 'pending';

-- 3) Disparos (mensagem em massa para os leads do bot).
CREATE TABLE IF NOT EXISTS "flow_broadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "flow_id" uuid REFERENCES "sales_flows"("id") ON DELETE CASCADE,
  "bot_id" uuid NOT NULL REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
  "audience" text NOT NULL DEFAULT 'all',
  "message" text NOT NULL,
  "media_url" text,
  "button" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'running',
  "total" integer NOT NULL DEFAULT 0,
  "sent" integer NOT NULL DEFAULT 0,
  "failed" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "flow_broadcasts_flow_idx" ON "flow_broadcasts" ("flow_id", "created_at");
