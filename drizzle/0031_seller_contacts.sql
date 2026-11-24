-- Migration: 0031_seller_contacts.sql
-- Descrição: WhatsApp e @ do Telegram do vendedor, informados no cadastro da WebGran.
-- Puramente aditiva: tabela nova, ligada ao usuário. A tabela users não muda.

CREATE TABLE IF NOT EXISTS "seller_contacts" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "whatsapp" text,
  "telegram" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
