-- Migration: 0037_bot_welcome_button_text.sql
-- Bot → Personalização: texto do botão que abre a loja na mensagem de boas-vindas (padrão "🛍️ ABRIR LOJA").
-- Só adiciona uma coluna opcional na tabela da Personalização (0036); nada existente muda.

ALTER TABLE "bot_miniapp_appearance" ADD COLUMN IF NOT EXISTS "welcome_button_text" text;
