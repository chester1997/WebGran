-- Limpeza: tira produtos que foram marcados em carrossel de OUTRO bot (o produto não aparece naquele bot).
-- No Mini App eles já não apareciam; isto só arruma o painel. Hoje são 4 itens de 1 loja.
DELETE FROM "carousel_products" cp
USING "product_carousels" c
WHERE c."id" = cp."carousel_id"
  AND c."bot_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "product_bot_visibility" v
    WHERE v."product_id" = cp."product_id" AND v."bot_id" = c."bot_id"
  );
