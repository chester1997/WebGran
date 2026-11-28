-- Carrosséis e Top 15 por bot (em teste: só a conta proprietária usa).
-- bot_id NULL = vale para todos os bots da loja (como sempre foi; lojas fora do teste continuam assim).
ALTER TABLE "product_carousels" ADD COLUMN IF NOT EXISTS "bot_id" uuid REFERENCES "telegram_bots"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "product_carousels_bot_idx" ON "product_carousels" ("bot_id");

-- Conta proprietária: os carrosséis e o Top 15 que já existem ficam no bot STUDIO MINI APP (@studiioshorts_bot)
UPDATE "product_carousels"
SET "bot_id" = 'e1a9b73a-c616-43ef-b621-649e182cb5cb'
WHERE "bot_id" IS NULL
  AND "store_id" = (SELECT "store_id" FROM "telegram_bots" WHERE "id" = 'e1a9b73a-c616-43ef-b621-649e182cb5cb');
