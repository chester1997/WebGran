-- Migration: 0030_web_store_settings.sql
-- Descrição: aparência da Loja Web (nome exibido, logo e imagem da faixa de promoção).
-- Puramente aditiva: só cria uma tabela nova. Nada muda nos bots nem no Mini App.

CREATE TABLE IF NOT EXISTS "web_store_settings" (
  "store_id" uuid PRIMARY KEY REFERENCES "stores"("id") ON DELETE CASCADE,
  "display_name" text,
  "logo_url" text,
  "promo_image_url" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
