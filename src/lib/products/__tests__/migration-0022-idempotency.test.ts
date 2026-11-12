import { describe, it, expect, beforeEach } from "vitest";
import { newDb, DataType } from "pg-mem";
import fs from "fs";
import path from "path";
import crypto from "crypto";

describe("Migration 0022: Idempotência, Integridade Multi-Tenant e Preservação Histórica", () => {
  let db: any;
  const storeAId = "11111111-1111-1111-1111-111111111111";
  const storeBId = "22222222-2222-2222-2222-222222222222";
  const botA1Id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const botA2Id = "aaaaaaaa-bbbb-aaaa-aaaa-aaaaaaaaaaaa";
  const botB1Id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  beforeEach(() => {
    db = newDb({ noAstCoverageCheck: true });

    // Setup base extensions and helper functions
    db.public.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });

    // 1. Setup baseline schema pre-migration (stores, telegram_bots, products, orders)
    db.public.none(`
      CREATE TABLE stores (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL
      );

      CREATE TABLE telegram_bots (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id),
        bot_id text NOT NULL,
        username text NOT NULL,
        status text DEFAULT 'active' NOT NULL
      );

      CREATE TABLE products (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id),
        bot_id uuid REFERENCES telegram_bots(id),
        title text NOT NULL,
        slug text NOT NULL,
        price numeric NOT NULL,
        status text DEFAULT 'active' NOT NULL
      );

      CREATE TABLE orders (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id),
        customer_id uuid,
        total_amount numeric NOT NULL,
        status text DEFAULT 'pending' NOT NULL
      );
    `);

    // 2. Seed Stores & Bots
    db.public.none(`
      INSERT INTO stores (id, name, slug) VALUES 
        ('${storeAId}', 'Loja A', 'loja-a'),
        ('${storeBId}', 'Loja B (Invasor)', 'loja-b');

      INSERT INTO telegram_bots (id, store_id, bot_id, username, status) VALUES 
        ('${botA1Id}', '${storeAId}', '1001', 'bot_a1', 'active'),
        ('${botA2Id}', '${storeAId}', '1002', 'bot_a2', 'active'),
        ('${botB1Id}', '${storeBId}', '2001', 'bot_b1', 'active');
    `);

    // 3. Seed exact 376 products: 289 Store General (bot_id NULL) + 87 Bot Specific (bot_id NOT NULL)
    for (let i = 1; i <= 289; i++) {
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, title, slug, price)
        VALUES ('33333333-0000-0000-0000-${i.toString().padStart(12, "0")}', '${storeAId}', NULL, 'Produto Geral ${i}', 'prod-geral-${i}', 49.90);
      `);
    }

    for (let i = 1; i <= 87; i++) {
      const assignedBot = i % 2 === 0 ? botA2Id : botA1Id;
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, title, slug, price)
        VALUES ('44444444-0000-0000-0000-${i.toString().padStart(12, "0")}', '${storeAId}', '${assignedBot}', 'Produto Bot ${i}', 'prod-bot-${i}', 99.90);
      `);
    }

    // 4. Seed historic orders
    db.public.none(`
      INSERT INTO orders (id, store_id, total_amount, status) VALUES 
        ('55555555-5555-5555-5555-555555555551', '${storeAId}', 49.90, 'paid'),
        ('55555555-5555-5555-5555-555555555552', '${storeAId}', 99.90, 'paid');
    `);
  });

  function runMigration(database: any) {
    const sqlPath = path.resolve(process.cwd(), "drizzle/0022_multi_bot_catalog_visibility.sql");
    const rawSql = fs.readFileSync(sqlPath, "utf-8");

    // Remove transações explícitas para o harness em memória
    let cleanSql = rawSql
      .replace(/\bBEGIN\s*;/gi, "")
      .replace(/\bCOMMIT\s*;/gi, "");

    // Remove blocos procedurais PL/pgSQL que pg-mem não emula
    cleanSql = cleanSql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/gi, "");
    cleanSql = cleanSql.replace(/DROP TRIGGER[\s\S]*?;/gi, "");
    cleanSql = cleanSql.replace(/CREATE TRIGGER[\s\S]*?;/gi, "");

    // Separa comandos DDL/DML comuns do bloco procedural DO $$
    const doBlockMatch = cleanSql.match(/DO \$\$[\s\S]*?\$\$[\s\S]*?;/i);
    const doBlock = doBlockMatch ? doBlockMatch[0] : "";
    const nonDoSql = cleanSql.replace(/DO \$\$[\s\S]*?\$\$[\s\S]*?;/i, "");

    // Executa comandos SQL estruturais
    database.public.none(nonDoSql);

    // Executa constraints do bloco DO procedural
    if (doBlock) {
      const alterStatements = doBlock
        .replace(/[\r\n]+/g, " ")
        .match(/ALTER TABLE\s+[^;]+;/gi) || [];
      for (let stmt of alterStatements) {
        // Normaliza sintaxe PG15+ ON DELETE SET NULL ("bot_id") para o parser do pg-mem
        if (stmt.includes('ON DELETE SET NULL ("bot_id")')) {
          stmt = stmt.replace('ON DELETE SET NULL ("bot_id")', "");
        }
        const constraintNameMatch = stmt.match(/CONSTRAINT "([^"]+)"/);
        const constraintName = constraintNameMatch ? constraintNameMatch[1] : null;
        if (constraintName) {
          try {
            const exists = database.public.many(
              `SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}'`
            );
            if (exists && exists.length > 0) continue;
          } catch { }
        }
        try {
          database.public.none(stmt);
        } catch (err: any) {
          if (!err?.message?.includes("already exists")) {
            throw err;
          }
        }
      }
    }
  }

  it("1. Primeira execução: preserva os 376 produtos, classifica escopos e cria visibilidade", () => {
    runMigration(db);

    // Contagem total de produtos mantida em 376
    const totalCount = db.public.one("SELECT count(*)::int as c FROM products").c;
    expect(totalCount).toBe(376);

    // 289 produtos são STORE_GENERAL
    const storeGeneralCount = db.public.one("SELECT count(*)::int as c FROM products WHERE catalog_scope = 'STORE_GENERAL'").c;
    expect(storeGeneralCount).toBe(289);

    // 87 produtos são BOT_SPECIFIC
    const botSpecificCount = db.public.one("SELECT count(*)::int as c FROM products WHERE catalog_scope = 'BOT_SPECIFIC'").c;
    expect(botSpecificCount).toBe(87);

    // Visibilidade criada exclusivamente para os 87 produtos com bot_id
    const visibilityCount = db.public.one("SELECT count(*)::int as c FROM product_bot_visibility").c;
    expect(visibilityCount).toBe(87);

    const ownerVisibilities = db.public.one("SELECT count(*)::int as c FROM product_bot_visibility WHERE is_owner = true").c;
    expect(ownerVisibilities).toBe(87);

    // Tabela auth_rate_limits criada com sucesso
    const rateLimitTableCheck = db.public.one("SELECT count(*)::int as c FROM auth_rate_limits").c;
    expect(rateLimitTableCheck).toBe(0);

    // Pedidos históricos preservados com delivery_mode padrão 'LINK'
    const orders = db.public.many("SELECT * FROM orders");
    expect(orders).toHaveLength(2);
    expect(orders[0].delivery_mode).toBe("LINK");
  });

  it("2. Integridade Multi-Tenant: banco rejeita associação cruzada entre produtos e bots de lojas distintas", () => {
    runMigration(db);

    const prodAId = "44444444-0000-0000-0000-000000000001"; // pertence à Store A

    // A. Tentar associar produto da Loja A com Bot da Loja B na tabela de visibilidade
    expect(() => {
      db.public.none(`
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prodAId}', '${botB1Id}', false, true);
      `);
    }).toThrow(); // Violates product_bot_visibility_bot_store_fk

    // B. Tentar associar produto da Loja A com store_id da Loja B
    expect(() => {
      db.public.none(`
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeBId}', '${prodAId}', '${botB1Id}', false, true);
      `);
    }).toThrow(); // Violates product_bot_visibility_product_store_fk

    // C. Tentar alterar o bot proprietário de um produto da Loja A para um bot da Loja B
    expect(() => {
      db.public.none(`
        UPDATE products SET bot_id = '${botB1Id}' WHERE id = '${prodAId}';
      `);
    }).toThrow(); // Violates products_bot_store_fk
  });

  it("3. Idempotência estrita: segunda execução não sobrescreve alterações legítimas do vendedor nem duplica registros", () => {
    // 1ª Execução
    runMigration(db);

    // Vendedor altera legitimamente o Produto 1 de STORE_GENERAL para BOT_GENERAL com ALL_EXISTING
    const prod1Id = "33333333-0000-0000-0000-000000000001";
    db.public.none(`
      UPDATE products 
      SET catalog_scope = 'BOT_GENERAL', sharing_mode = 'ALL_EXISTING'
      WHERE id = '${prod1Id}';
    `);

    // Vendedor vincula visibilidade para os bots existentes da loja
    db.public.none(`
      INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
      VALUES 
        ('${storeAId}', '${prod1Id}', '${botA1Id}', false, true),
        ('${storeAId}', '${prod1Id}', '${botA2Id}', false, true);
    `);

    const countBeforeSecondRun = db.public.one("SELECT count(*)::int as c FROM product_bot_visibility").c;
    expect(countBeforeSecondRun).toBe(89); // 87 originais + 2 do produto compartilhado

    // 2ª Execução da mesma migração (simulando re-deploy ou reexecução)
    runMigration(db);

    // A. Quantidade total de produtos inalterada
    const totalCountAfter = db.public.one("SELECT count(*)::int as c FROM products").c;
    expect(totalCountAfter).toBe(376);

    // B. A alteração legítima do vendedor para BOT_GENERAL NÃO foi sobrescrita para STORE_GENERAL
    const prod1After = db.public.one(`SELECT catalog_scope, sharing_mode FROM products WHERE id = '${prod1Id}'`);
    expect(prod1After.catalog_scope).toBe("BOT_GENERAL");
    expect(prod1After.sharing_mode).toBe("ALL_EXISTING");

    // C. Registros de visibilidade NÃO foram duplicados
    const countAfterSecondRun = db.public.one("SELECT count(*)::int as c FROM product_bot_visibility").c;
    expect(countAfterSecondRun).toBe(89);

    // D. Pedidos históricos permanecem intactos
    const ordersAfter = db.public.many("SELECT * FROM orders");
    expect(ordersAfter).toHaveLength(2);
  });
});
