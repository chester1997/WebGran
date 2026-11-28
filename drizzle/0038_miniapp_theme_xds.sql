-- Tema XDs do Mini App (em teste: só bots da conta proprietária)
ALTER TABLE "bot_miniapp_appearance" ADD COLUMN IF NOT EXISTS "theme" text;

-- Carrosséis: estilo de exibição no Tema XDs ('small' | 'large' | 'featured' | 'collection'),
-- tempo de troca do Destaque, imagem de fundo e subtítulo da Coleção, cor do emblema do Top 15
ALTER TABLE "product_carousels" ADD COLUMN IF NOT EXISTS "display_style" text;
ALTER TABLE "product_carousels" ADD COLUMN IF NOT EXISTS "autoplay_seconds" integer;
ALTER TABLE "product_carousels" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "product_carousels" ADD COLUMN IF NOT EXISTS "subtitle" text;
ALTER TABLE "product_carousels" ADD COLUMN IF NOT EXISTS "badge_color" text;
