-- Migration: 0032_web_hero_images.sql
-- Descrição: imagem horizontal de cada título nos Destaques do topo da Loja Web.
-- Puramente aditiva: só cria uma tabela nova. Nada muda nos bots nem no Mini App.

CREATE TABLE IF NOT EXISTS "web_hero_images" (
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "image_url" text NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("store_id", "product_id")
);
