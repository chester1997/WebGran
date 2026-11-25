-- Migration: 0034_web_customer_lead_source.sql
-- Loja Web: de onde o cliente veio (Instagram, TikTok, Kwai...), escolhido no cadastro.
-- Só adiciona uma coluna opcional; nenhuma linha existente é alterada.

ALTER TABLE "web_customers" ADD COLUMN IF NOT EXISTS "lead_source" text;
CREATE INDEX IF NOT EXISTS "web_customers_store_source_idx" ON "web_customers" ("store_id", "lead_source");
