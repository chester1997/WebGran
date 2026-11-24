-- Migration: 0029_web_store_sections.sql
-- Descrição: vitrine da Loja Web (destaques do topo, Top 15, carrosséis, "continuar assistindo", combos).
-- Puramente aditiva: só cria uma tabela nova. Os produtos da Loja Web usam a tabela products com
-- status 'web_active' / 'web_draft' / 'web_archived' (o Mini App e os bots só leem status 'active').

CREATE TABLE IF NOT EXISTS "web_store_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('hero', 'top15', 'continue', 'combos', 'carousel')),
  "title" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "mode" text NOT NULL DEFAULT 'manual' CHECK ("mode" IN ('auto', 'manual')),
  "product_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "web_store_sections_store_idx" ON "web_store_sections" ("store_id", "position");
