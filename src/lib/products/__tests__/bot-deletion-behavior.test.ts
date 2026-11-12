import { describe, it, expect, beforeEach } from "vitest";
import { newDb, DataType } from "pg-mem";
import crypto from "crypto";

describe("Verificação da Exclusão de Bots e Integridade de products.store_id", () => {
  let db: any;
  const storeAId = "11111111-1111-1111-1111-111111111111";
  const storeBId = "22222222-2222-2222-2222-222222222222";
  const botA1Id = "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa";
  const botB1Id = "bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb";
  const prodA1Id = "33333333-1111-1111-1111-333333333333";

  beforeEach(() => {
    db = newDb({ noAstCoverageCheck: true });
    db.public.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });

    // Estrutura espelhada do banco de dados
    db.public.none(`
      CREATE TABLE stores (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL
      );

      CREATE TABLE telegram_bots (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        username text NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        UNIQUE (id, store_id)
      );

      CREATE TABLE products (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL,
        title text NOT NULL,
        slug text NOT NULL,
        catalog_scope text DEFAULT 'STORE_GENERAL' NOT NULL,
        sharing_mode text DEFAULT 'EXCLUSIVE' NOT NULL,
        UNIQUE (id, store_id)
      );

      CREATE TABLE product_bot_visibility (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL,
        product_id uuid NOT NULL,
        bot_id uuid NOT NULL,
        is_owner boolean DEFAULT false NOT NULL,
        can_deliver boolean DEFAULT true NOT NULL,
        CONSTRAINT pbv_prod_fk FOREIGN KEY (product_id, store_id) REFERENCES products(id, store_id) ON DELETE CASCADE,
        CONSTRAINT pbv_bot_fk FOREIGN KEY (bot_id, store_id) REFERENCES telegram_bots(id, store_id) ON DELETE CASCADE,
        CONSTRAINT pbv_unique UNIQUE (product_id, bot_id)
      );
    `);

    // Inserção dos dados iniciais
    db.public.none(`
      INSERT INTO stores (id, name, slug) VALUES 
        ('${storeAId}', 'Loja A', 'loja-a'),
        ('${storeBId}', 'Loja B', 'loja-b');

      INSERT INTO telegram_bots (id, store_id, username, status) VALUES 
        ('${botA1Id}', '${storeAId}', 'bot_a1', 'active'),
        ('${botB1Id}', '${storeBId}', 'bot_b1', 'active');
    `);
  });

  it("Ciclo Completo: Exclusão de bot preserva produto, anula bot_id, mantém store_id e limpa visibilidade por CASCADE", () => {
    // 1. Criar produto vinculado a um bot
    db.public.none(`
      INSERT INTO products (id, store_id, bot_id, title, slug, catalog_scope, sharing_mode)
      VALUES ('${prodA1Id}', '${storeAId}', '${botA1Id}', 'Curso VIP', 'curso-vip', 'BOT_SPECIFIC', 'EXCLUSIVE');

      INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
      VALUES ('${storeAId}', '${prodA1Id}', '${botA1Id}', true, true);
    `);

    // Valida estado inicial
    const prodInitial = db.public.one(`SELECT * FROM products WHERE id = '${prodA1Id}'`);
    expect(prodInitial.bot_id).toBe(botA1Id);
    expect(prodInitial.store_id).toBe(storeAId);

    const visInitial = db.public.many(`SELECT * FROM product_bot_visibility WHERE product_id = '${prodA1Id}'`);
    expect(visInitial).toHaveLength(1);
    expect(visInitial[0].bot_id).toBe(botA1Id);

    // 2. Excluir o bot em banco isolado
    db.public.none(`DELETE FROM telegram_bots WHERE id = '${botA1Id}';`);

    // 3. Confirmar que o produto permanece na loja
    const prodAfter = db.public.one(`SELECT * FROM products WHERE id = '${prodA1Id}'`);
    expect(prodAfter).toBeDefined();

    // 4. Confirmar que bot_id fica NULL (desvinculação segura)
    expect(prodAfter.bot_id).toBeNull();

    // 5. Confirmar que o produto NÃO perde sua associação à loja (store_id permanece NOT NULL e intacto)
    expect(prodAfter.store_id).toBe(storeAId);

    // 6. Confirmar que os registros de visibilidade do bot excluído foram removidos por CASCADE
    const visAfter = db.public.many(`SELECT * FROM product_bot_visibility WHERE bot_id = '${botA1Id}'`);
    expect(visAfter).toHaveLength(0);

    // Confirmar que o produto continua existindo no banco e associado à loja
    const storeProducts = db.public.many(`SELECT id, store_id, bot_id FROM products WHERE store_id = '${storeAId}'`);
    expect(storeProducts).toHaveLength(1);
    expect(storeProducts[0].id).toBe(prodA1Id);
    expect(storeProducts[0].store_id).toBe(storeAId);
    expect(storeProducts[0].bot_id).toBeNull();
  });

  it("Integridade Multi-Tenant: banco impede associar produto da Loja A com bot da Loja B", () => {
    const alienProdId = crypto.randomUUID();

    // Tentar criar produto na Loja A com visibilidade apontando para bot da Loja B
    expect(() => {
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, title, slug)
        VALUES ('${alienProdId}', '${storeAId}', NULL, 'Produto Teste', 'prod-teste');

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${alienProdId}', '${botB1Id}', false, true);
      `);
    }).toThrow();
  });
});
