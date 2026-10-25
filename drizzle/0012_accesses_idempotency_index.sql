BEGIN;

-- 1. Lock timeout defensivo de 3 segundos para proteger o banco de produção contra contention
SET LOCAL lock_timeout = '3s';

-- 2. Advisory lock transacional exclusivo (liberado automaticamente ao final da transação)
-- Chave única determinística para migração de idempotência de acessos: 2026102503
SELECT pg_advisory_xact_lock(2026102503);

-- 3. Validação prévia explícita de compatibilidade do schema e ausência de duplicidades
DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    -- 3.1 Validar existência da tabela accesses
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accesses') THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Tabela accesses não encontrada no schema public.';
    END IF;

    -- 3.2 Validar se existem registros duplicados para a tupla (store_id, customer_id, product_id, order_id)
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT store_id, customer_id, product_id, order_id
        FROM accesses
        WHERE order_id IS NOT NULL
        GROUP BY store_id, customer_id, product_id, order_id
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'MIGRAÇÃO ABORTADA: Encontradas % tuplas duplicadas em accesses com order_id não nulo.', v_dup_count;
    END IF;
END $$;

-- 4. Criação do índice único parcial para garantir idempotência física dos acessos gerados por pedidos
CREATE UNIQUE INDEX IF NOT EXISTS "accesses_store_customer_product_order_uidx" 
ON "accesses" ("store_id", "customer_id", "product_id", "order_id") 
WHERE "order_id" IS NOT NULL;

-- 5. Criação do índice de cobertura para consultas por loja, cliente e status de acesso
CREATE INDEX IF NOT EXISTS "accesses_store_customer_status_idx" 
ON "accesses" ("store_id", "customer_id", "status");

COMMIT;
