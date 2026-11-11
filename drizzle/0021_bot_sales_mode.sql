-- Migration 0021: Persistência Definitiva de Sales Mode em Telegram Bots
-- 1. Adicionar coluna sales_mode com default 'MINI_APP' NOT NULL
-- Preserva 100% dos 24 bots existentes no modo MINI_APP sem downtime e em O(1)
ALTER TABLE "telegram_bots"
  ADD COLUMN IF NOT EXISTS "sales_mode" text NOT NULL DEFAULT 'MINI_APP';

-- 2. Restrição CHECK para integridade estrita dos valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_bots_sales_mode_check'
  ) THEN
    ALTER TABLE "telegram_bots"
      ADD CONSTRAINT telegram_bots_sales_mode_check
      CHECK ("sales_mode" IN ('PADRAO', 'MINI_APP'));
  END IF;
END $$;

-- 3. Índice para consultas por loja e modalidade comercial
CREATE INDEX IF NOT EXISTS "telegram_bots_sales_mode_idx"
  ON "telegram_bots" ("store_id", "sales_mode");

