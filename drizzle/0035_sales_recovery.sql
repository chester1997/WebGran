-- Migration: 0035_sales_recovery.sql
-- Marketing → Recuperação de vendas: mensagens automáticas no bot para quem gerou a compra e não pagou.
-- Só cria tabelas novas; nenhuma tabela ou linha existente é alterada.
-- O agendamento usa a fila que já existe (flow_jobs, kind = 'recovery').

CREATE TABLE IF NOT EXISTS "sales_recovery_settings" (
  "store_id" uuid PRIMARY KEY REFERENCES "stores"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "quiet_hours" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sales_recovery_sends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "telegram_customers"("id") ON DELETE CASCADE,
  "bot_id" uuid REFERENCES "telegram_bots"("id") ON DELETE SET NULL,
  "step" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'sent',
  "error" text,
  "sent_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "sales_recovery_sends_order_step_idx" ON "sales_recovery_sends" ("order_id", "step");
CREATE INDEX IF NOT EXISTS "sales_recovery_sends_store_idx" ON "sales_recovery_sends" ("store_id", "sent_at");
CREATE INDEX IF NOT EXISTS "sales_recovery_sends_customer_idx" ON "sales_recovery_sends" ("customer_id", "sent_at");
