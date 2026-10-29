BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco contra contenção de locks
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo
-- Chave única determinística para migração de controle de gateways dos vendedores: 2026102901
SELECT pg_advisory_xact_lock(2026102901);

-- 3. Criação da tabela de controle administrativo dos gateways dos vendedores
CREATE TABLE IF NOT EXISTS "seller_gateway_controls" (
    "gateway" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "allow_new_connections" boolean DEFAULT true NOT NULL,
    "allow_new_payments" boolean DEFAULT true NOT NULL,
    "notes" text,
    "updated_by_id" uuid,
    "updated_by_name" text,
    "updated_by_email" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "seller_gateway_controls_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

-- 4. Seed com os gateways padrão disponíveis na plataforma
INSERT INTO "seller_gateway_controls" ("gateway", "name", "allow_new_connections", "allow_new_payments", "notes")
VALUES 
    ('pushinpay', 'PushinPay (Pix com Split Automático)', true, true, 'Gateway principal de Pix transparente com split instantâneo.'),
    ('mercadopago', 'Mercado Pago (OAuth 2.0 & Pix)', true, true, 'Integração transparente via conta Mercado Pago do lojista.'),
    ('syncpay', 'SyncPay (Gateway Parceiro Restrito)', false, false, 'Gateway reservado para planos e assinaturas da plataforma. Conexão direta por vendedores desativada por padrão.')
ON CONFLICT ("gateway") DO NOTHING;

COMMIT;

