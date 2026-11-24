-- Migration: 0028_web_store.sql
-- Descrição: Loja Web (acesso pelo navegador, sem Telegram) com cadastro/login do cliente e pedidos de suporte.
-- Puramente aditiva: só cria tabelas novas. Nada muda no Mini App, nos bots ou nos pedidos existentes.
-- Cada cliente web ganha um "cliente sombra" em telegram_customers (telegram_user_id = 'web:<id>'),
-- assim carrinho, combos, checkout PIX, entrega e vídeos reaproveitam o motor que já existe.

CREATE TABLE IF NOT EXISTS "web_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "shadow_customer_id" uuid NOT NULL REFERENCES "telegram_customers"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "whatsapp" text,
  "telegram" text,
  "status" text NOT NULL DEFAULT 'active',
  "last_login_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "web_customers_store_email_uidx" ON "web_customers" ("store_id", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "web_customers_shadow_uidx" ON "web_customers" ("shadow_customer_id");
CREATE INDEX IF NOT EXISTS "web_customers_store_created_idx" ON "web_customers" ("store_id", "created_at");

CREATE TABLE IF NOT EXISTS "web_customer_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "web_customer_id" uuid NOT NULL REFERENCES "web_customers"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "web_customer_sessions_customer_idx" ON "web_customer_sessions" ("web_customer_id");

CREATE TABLE IF NOT EXISTS "web_support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "web_customer_id" uuid NOT NULL REFERENCES "web_customers"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "contact_via" text NOT NULL DEFAULT 'whatsapp',
  "status" text NOT NULL DEFAULT 'open'
    CHECK ("status" IN ('open', 'answered', 'closed')),
  "seller_reply" text,
  "replied_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "web_support_tickets_store_status_idx" ON "web_support_tickets" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "web_support_tickets_customer_idx" ON "web_support_tickets" ("web_customer_id");
