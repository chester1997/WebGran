-- Carrosséis e Top 15 por bot para TODAS as lojas.
-- Cada carrossel antigo (sem bot) vira uma cópia por bot da loja, só com os produtos que aparecem naquele bot.
-- A cópia mantém nome, ícone, ordem, status e a ordem dos produtos; o Mini App de cada bot continua igual.
-- Carrossel sem nenhum produto vira cópia em todos os bots. Lojas sem bot: nada muda.
-- Se um carrossel não tiver produto visível em nenhum bot, ele fica como está (da loja toda).

BEGIN;

CREATE TEMP TABLE carousel_split ON COMMIT DROP AS
SELECT c.id AS old_id, b.id AS bot_id, gen_random_uuid() AS new_id
FROM product_carousels c
JOIN telegram_bots b ON b.store_id = c.store_id
WHERE c.bot_id IS NULL
  AND (
    NOT EXISTS (SELECT 1 FROM carousel_products cp WHERE cp.carousel_id = c.id)
    OR EXISTS (
      SELECT 1 FROM carousel_products cp
      JOIN product_bot_visibility v ON v.product_id = cp.product_id AND v.bot_id = b.id
      WHERE cp.carousel_id = c.id
    )
  );

INSERT INTO product_carousels (
  id, store_id, bot_id, name, position, status, is_ranking, indicator_type, icon_name, icon_color,
  display_style, autoplay_seconds, cover_image_url, subtitle, badge_color, created_at, updated_at
)
SELECT s.new_id, c.store_id, s.bot_id, c.name, c.position, c.status, c.is_ranking, c.indicator_type, c.icon_name, c.icon_color,
       c.display_style, c.autoplay_seconds, c.cover_image_url, c.subtitle, c.badge_color, c.created_at, now()
FROM carousel_split s
JOIN product_carousels c ON c.id = s.old_id;

INSERT INTO carousel_products (carousel_id, product_id, position, created_at)
SELECT DISTINCT ON (s.new_id, cp.product_id) s.new_id, cp.product_id, cp.position, cp.created_at
FROM carousel_split s
JOIN carousel_products cp ON cp.carousel_id = s.old_id
JOIN product_bot_visibility v ON v.product_id = cp.product_id AND v.bot_id = s.bot_id;

-- Remove os carrosséis antigos que ganharam cópia (os itens saem junto, por cascade)
DELETE FROM product_carousels WHERE id IN (SELECT DISTINCT old_id FROM carousel_split);

COMMIT;
