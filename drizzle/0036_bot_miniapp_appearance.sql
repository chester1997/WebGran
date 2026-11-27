-- Migration: 0036_bot_miniapp_appearance.sql
-- Bot → Personalização: nome e logo no topo do Mini App, cor principal e botões extras da mensagem de boas-vindas.
-- Só cria uma tabela nova; nenhuma tabela ou linha existente é alterada.
-- Bot sem linha aqui = Mini App e boas-vindas exatamente como hoje.

CREATE TABLE IF NOT EXISTS "bot_miniapp_appearance" (
  "bot_id" uuid PRIMARY KEY REFERENCES "telegram_bots"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "display_name" text,
  "logo_url" text,
  "accent_color" text,
  "show_extra_buttons" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bot_miniapp_appearance_store_idx" ON "bot_miniapp_appearance" ("store_id");
