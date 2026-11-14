-- Migration: 0023_product_trailer_video.sql
-- Description: Adiciona coluna opcional trailer_video_id e índice correspondente à tabela products
-- Nota: Esta migration é puramente aditiva e retrocompatível. NÃO execute no banco de produção (Neon) sem autorização.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "trailer_video_id" uuid REFERENCES "product_videos"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "products_trailer_video_id_idx" ON "products" ("trailer_video_id");

