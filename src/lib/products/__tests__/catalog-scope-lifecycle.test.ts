import { describe, it, expect, beforeEach } from "vitest";
import { newDb, DataType } from "pg-mem";
import crypto from "crypto";

describe("Ciclo de Vida Funcional dos 3 Escopos e Snapshot de Bots", () => {
  let db: any;
  const storeId = "11111111-1111-1111-1111-111111111111";
  const bot1Id = "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa";
  const bot2Id = "aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa";
  const bot3NewId = "aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa";

  beforeEach(() => {
    db = newDb({ noAstCoverageCheck: true });

    db.public.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });

    db.public.none(`
      CREATE TABLE stores (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL
      );

      CREATE TABLE telegram_bots (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id),
        username text NOT NULL,
        status text DEFAULT 'active' NOT NULL
      );

      CREATE TABLE products (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id),
        bot_id uuid REFERENCES telegram_bots(id),
        title text NOT NULL,
        slug text NOT NULL,
        catalog_scope text NOT NULL,
        sharing_mode text NOT NULL,
        status text DEFAULT 'active' NOT NULL
      );

      CREATE TABLE product_bot_visibility (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL REFERENCES stores(id),
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        bot_id uuid NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
        is_owner boolean DEFAULT false NOT NULL,
        can_deliver boolean DEFAULT true NOT NULL,
        CONSTRAINT pbv_unique UNIQUE (product_id, bot_id)
      );

      INSERT INTO stores (id, name, slug) VALUES ('${storeId}', 'Loja Teste', 'loja-teste');
      INSERT INTO telegram_bots (id, store_id, username, status) VALUES 
        ('${bot1Id}', '${storeId}', 'bot_um', 'active'),
        ('${bot2Id}', '${storeId}', 'bot_dois', 'active');
    `);
  });

  it("1. Escopo STORE_GENERAL: produto único sem vínculo com bot específico e sem duplicação", () => {
    const prodId = crypto.randomUUID();
    db.public.none(`
      INSERT INTO products (id, store_id, bot_id, title, slug, catalog_scope, sharing_mode)
      VALUES ('${prodId}', '${storeId}', NULL, 'Produto Loja Geral', 'prod-loja-geral', 'STORE_GENERAL', 'EXCLUSIVE');
    `);

    const product = db.public.one(`SELECT * FROM products WHERE id = '${prodId}'`);
    expect(product.bot_id).toBeNull();
    expect(product.catalog_scope).toBe("STORE_GENERAL");

    // Não deve haver registros na tabela product_bot_visibility
    const visibilities = db.public.many(`SELECT * FROM product_bot_visibility WHERE product_id = '${prodId}'`);
    expect(visibilities).toHaveLength(0);

    // Contagem de produtos permanece exatamente 1 (sem duplicação)
    const count = db.public.one("SELECT count(*)::int as c FROM products").c;
    expect(count).toBe(1);
  });

  it("2. Escopo BOT_GENERAL: snapshot vincula apenas os bots existentes no momento da criação", () => {
    const prodId = crypto.randomUUID();
    db.public.none(`
      INSERT INTO products (id, store_id, bot_id, title, slug, catalog_scope, sharing_mode)
      VALUES ('${prodId}', '${storeId}', NULL, 'Produto Bot Geral', 'prod-bot-geral', 'BOT_GENERAL', 'EXCLUSIVE');
    `);

    // Snapshot: busca bots ativos existentes no momento
    const activeBots = db.public.many(`SELECT id FROM telegram_bots WHERE store_id = '${storeId}' AND status = 'active'`);
    expect(activeBots).toHaveLength(2);

    for (const bot of activeBots) {
      db.public.none(`
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeId}', '${prodId}', '${bot.id}', false, true);
      `);
    }

    // Verifica que ambos os bots existentes têm visibilidade
    const visibilities = db.public.many(`SELECT bot_id FROM product_bot_visibility WHERE product_id = '${prodId}'`);
    expect(visibilities.map((v: any) => v.bot_id).sort()).toEqual([bot1Id, bot2Id].sort());

    // CRÍTICO: Criar um terceiro bot POSTERIORMENTE
    db.public.none(`
      INSERT INTO telegram_bots (id, store_id, username, status)
      VALUES ('${bot3NewId}', '${storeId}', 'bot_tres_novo', 'active');
    `);

    // O novo bot NÃO recebe o produto automaticamente
    const newBotVisibility = db.public.many(`
      SELECT * FROM product_bot_visibility WHERE product_id = '${prodId}' AND bot_id = '${bot3NewId}'
    `);
    expect(newBotVisibility).toHaveLength(0);

    // Produto permanece como registro único no banco
    const prodCount = db.public.one("SELECT count(*)::int as c FROM products WHERE slug = 'prod-bot-geral'").c;
    expect(prodCount).toBe(1);
  });

  it("3. Escopo BOT_SPECIFIC: preserva bot proprietário e compartilha exclusivamente com snapshot", () => {
    const prodId = crypto.randomUUID();
    db.public.none(`
      INSERT INTO products (id, store_id, bot_id, title, slug, catalog_scope, sharing_mode)
      VALUES ('${prodId}', '${storeId}', '${bot1Id}', 'Curso Bot 1', 'curso-bot-1', 'BOT_SPECIFIC', 'ALL_EXISTING');
    `);

    // 1. Registro do proprietário
    db.public.none(`
      INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
      VALUES ('${storeId}', '${prodId}', '${bot1Id}', true, true);
    `);

    // 2. Registro de compartilhamento para o outro bot existente
    db.public.none(`
      INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
      VALUES ('${storeId}', '${prodId}', '${bot2Id}', false, true);
    `);

    const ownerVis = db.public.one(`SELECT is_owner FROM product_bot_visibility WHERE product_id = '${prodId}' AND bot_id = '${bot1Id}'`);
    expect(ownerVis.is_owner).toBe(true);

    const sharedVis = db.public.one(`SELECT is_owner FROM product_bot_visibility WHERE product_id = '${prodId}' AND bot_id = '${bot2Id}'`);
    expect(sharedVis.is_owner).toBe(false);

    // CRÍTICO: Bot criado posteriormente NÃO recebe o produto compartilhado
    db.public.none(`
      INSERT INTO telegram_bots (id, store_id, username, status)
      VALUES ('${bot3NewId}', '${storeId}', 'bot_tres_novo', 'active');
    `);

    const newBotVisibility = db.public.many(`
      SELECT * FROM product_bot_visibility WHERE product_id = '${prodId}' AND bot_id = '${bot3NewId}'
    `);
    expect(newBotVisibility).toHaveLength(0);

    // O produto nunca foi duplicado
    const totalCount = db.public.one("SELECT count(*)::int as c FROM products").c;
    expect(totalCount).toBe(1);
  });
});

