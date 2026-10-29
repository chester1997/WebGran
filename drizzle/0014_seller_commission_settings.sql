BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco contra contenção de locks
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de taxas e isenções individuais por vendedor: 2026102801
SELECT pg_advisory_xact_lock(2026102801);

-- 3. Validação prévia explícita de compatibilidade do schema existente
DO $$
BEGIN
    -- 3.1 Validar tabela users (necessária para chaves estrangeiras)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela users não encontrada no schema public.';
    END IF;
END $$;

-- 4. Criação da tabela de configuração de comissão por vendedor
CREATE TABLE IF NOT EXISTS "seller_commission_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "seller_id" uuid NOT NULL,
    "custom_fee_cents" integer,
    "exemption_active" boolean DEFAULT false NOT NULL,
    "exemption_start" timestamp,
    "exemption_end" timestamp,
    "exemption_reason" text,
    "version" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "updated_by_id" uuid,
    "updated_by_name" text,
    "updated_by_email" text,
    CONSTRAINT "seller_commission_settings_seller_id_unique" UNIQUE("seller_id"),
    CONSTRAINT "seller_commission_settings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "seller_commission_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
    CONSTRAINT "seller_comm_fee_check" CHECK ("custom_fee_cents" IS NULL OR ("custom_fee_cents" >= 0 AND "custom_fee_cents" <= 50)),
    CONSTRAINT "seller_comm_exemption_dates_check" CHECK ("exemption_end" IS NULL OR "exemption_start" IS NULL OR "exemption_end" > "exemption_start")
);

-- 5. Criação da tabela de histórico de auditoria de alterações
CREATE TABLE IF NOT EXISTS "seller_commission_audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "seller_id" uuid NOT NULL,
    "previous_fee_cents" integer,
    "new_fee_cents" integer,
    "previous_exemption_active" boolean DEFAULT false NOT NULL,
    "new_exemption_active" boolean DEFAULT false NOT NULL,
    "previous_exemption_start" timestamp,
    "previous_exemption_end" timestamp,
    "new_exemption_start" timestamp,
    "new_exemption_end" timestamp,
    "reason" text NOT NULL,
    "changed_by_id" uuid,
    "changed_by_name" text,
    "changed_by_email" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "seller_commission_audit_logs_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "seller_commission_audit_logs_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

-- 6. Criação de índices de auditoria
CREATE INDEX IF NOT EXISTS "seller_comm_audit_seller_idx" ON "seller_commission_audit_logs" ("seller_id");
CREATE INDEX IF NOT EXISTS "seller_comm_audit_created_idx" ON "seller_commission_audit_logs" ("created_at");

COMMIT;

