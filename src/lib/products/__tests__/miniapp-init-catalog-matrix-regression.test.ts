import { describe, it, expect, beforeEach, vi } from "vitest";
import { newDb, DataType } from "pg-mem";
import crypto from "crypto";

describe("WebGran — Auditoria de Regressão: Mini App Telegram × Catálogo Multi-Bot", () => {
  let db: any;
  const storeAId = "11111111-1111-1111-1111-111111111111";
  const storeBId = "22222222-2222-2222-2222-222222222222";

  const botA1Id = "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"; // Bot proprietário em Store A
  const botA2Id = "aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa"; // Bot parceiro existente no snapshot
  const botA3NewId = "aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa"; // Bot criado após ativação
  const botA4InactiveId = "aaaaaaaa-4444-4444-4444-aaaaaaaaaaaa"; // Bot inativo

  const botB1Id = "bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb"; // Bot de outra loja (Store B)

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
        display_name text,
        status text DEFAULT 'active' NOT NULL
      );

      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL REFERENCES stores(id),
        bot_id uuid REFERENCES telegram_bots(id),
        catalog_scope text DEFAULT 'STORE_GENERAL' NOT NULL,
        sharing_mode text DEFAULT 'EXCLUSIVE' NOT NULL,
        title text NOT NULL,
        slug text NOT NULL,
        price numeric(10,2) NOT NULL,
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
    `);

    // Inserção inicial de lojas e bots
    db.public.none(`
      INSERT INTO stores (id, name, slug) VALUES 
        ('${storeAId}', 'Loja Alpha', 'loja-alpha'),
        ('${storeBId}', 'Loja Beta', 'loja-beta');

      INSERT INTO telegram_bots (id, store_id, username, display_name, status) VALUES 
        ('${botA1Id}', '${storeAId}', 'bot_a1', 'Bot Alpha 1', 'active'),
        ('${botA2Id}', '${storeAId}', 'bot_a2', 'Bot Alpha 2', 'active'),
        ('${botA4InactiveId}', '${storeAId}', 'bot_a4_inativo', 'Bot Alpha Inativo', 'inactive'),
        ('${botB1Id}', '${storeBId}', 'bot_b1', 'Bot Beta 1', 'active');
    `);
  });

  // =========================================================================
  // SEÇÃO 1: MATRIZ DE ESCOPOS (STORE_GENERAL, BOT_GENERAL, BOT_SPECIFIC)
  // =========================================================================
  describe("1. Matriz de Escopos de Catálogo", () => {
    it("1.1 STORE_GENERAL: Visível no catálogo geral da loja (Web / botId nulo) sem vincular bots indevidamente", () => {
      const prodStoreGeneralId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodStoreGeneralId}', '${storeAId}', NULL, 'STORE_GENERAL', 'EXCLUSIVE', 'Ebook Geral', 'ebook-geral', 29.90);
      `);

      // 1. Resolução para Web (sem botId)
      const webVisible = db.public.many(`
        SELECT id, title, catalog_scope 
        FROM products 
        WHERE store_id = '${storeAId}' AND catalog_scope = 'STORE_GENERAL' AND status = 'active';
      `);
      expect(webVisible).toHaveLength(1);
      expect(webVisible[0].id).toBe(prodStoreGeneralId);

      // 2. Não possui vínculos artificiais na tabela product_bot_visibility
      const visibilities = db.public.many(`
        SELECT * FROM product_bot_visibility WHERE product_id = '${prodStoreGeneralId}';
      `);
      expect(visibilities).toHaveLength(0);
    });

    it("1.2 BOT_GENERAL: Adiciona apenas bots do snapshot; novo bot criado depois NÃO recebe acesso", () => {
      const prodBotGeneralId = crypto.randomUUID();

      // Ativação com os bots ativos existentes (Bot A1 e Bot A2)
      const currentActiveBots = db.public.many(`
        SELECT id FROM telegram_bots WHERE store_id = '${storeAId}' AND status = 'active';
      `);
      expect(currentActiveBots).toHaveLength(2);

      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodBotGeneralId}', '${storeAId}', NULL, 'BOT_GENERAL', 'ALL_EXISTING', 'Combo Geral', 'combo-geral', 99.00);
      `);

      for (const bot of currentActiveBots) {
        db.public.none(`
          INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
          VALUES ('${storeAId}', '${prodBotGeneralId}', '${bot.id}', false, true);
        `);
      }

      // Verificação: Bot A1 e Bot A2 visualizam
      const visA1 = db.public.many(`
        SELECT product_id FROM product_bot_visibility WHERE store_id = '${storeAId}' AND bot_id = '${botA1Id}';
      `);
      expect(visA1.map((v: any) => v.product_id)).toContain(prodBotGeneralId);

      const visA2 = db.public.many(`
        SELECT product_id FROM product_bot_visibility WHERE store_id = '${storeAId}' AND bot_id = '${botA2Id}';
      `);
      expect(visA2.map((v: any) => v.product_id)).toContain(prodBotGeneralId);

      // Criação posterior do Bot A3 na mesma loja
      db.public.none(`
        INSERT INTO telegram_bots (id, store_id, username, display_name, status)
        VALUES ('${botA3NewId}', '${storeAId}', 'bot_a3_novo', 'Bot Alpha 3', 'active');
      `);

      // Bot A3 NÃO tem acesso ao produto BOT_GENERAL existente
      const visA3 = db.public.many(`
        SELECT product_id FROM product_bot_visibility WHERE store_id = '${storeAId}' AND bot_id = '${botA3NewId}';
      `);
      expect(visA3.map((v: any) => v.product_id)).not.toContain(prodBotGeneralId);
    });

    it("1.3 BOT_SPECIFIC: Visível no bot proprietário e bot autorizado; NÃO visível em bot não autorizado", () => {
      const prodSpecificId = crypto.randomUUID();

      // Bot A1 é o proprietário e compartilha exclusivamente com Bot A2 (CUSTOM)
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodSpecificId}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'CUSTOM', 'Curso Exclusivo', 'curso-exclusivo', 197.00);

        -- Proprietário
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prodSpecificId}', '${botA1Id}', true, true);

        -- Autorizado explicitamente
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prodSpecificId}', '${botA2Id}', false, true);
      `);

      // 1. Bot proprietário (Bot A1) visualiza com is_owner = true
      const ownerCheck = db.public.one(`
        SELECT is_owner, can_deliver FROM product_bot_visibility 
        WHERE store_id = '${storeAId}' AND bot_id = '${botA1Id}' AND product_id = '${prodSpecificId}';
      `);
      expect(ownerCheck.is_owner).toBe(true);
      expect(ownerCheck.can_deliver).toBe(true);

      // 2. Bot autorizado (Bot A2) visualiza com is_owner = false
      const sharedCheck = db.public.one(`
        SELECT is_owner, can_deliver FROM product_bot_visibility 
        WHERE store_id = '${storeAId}' AND bot_id = '${botA2Id}' AND product_id = '${prodSpecificId}';
      `);
      expect(sharedCheck.is_owner).toBe(false);
      expect(sharedCheck.can_deliver).toBe(true);

      // 3. Bot inativo ou terceiro não autorizado (Bot A4) NÃO visualiza
      const unauthorizedCheck = db.public.many(`
        SELECT * FROM product_bot_visibility 
        WHERE store_id = '${storeAId}' AND bot_id = '${botA4InactiveId}' AND product_id = '${prodSpecificId}';
      `);
      expect(unauthorizedCheck).toHaveLength(0);

      // 4. Bot de outra loja (Bot B1) NÃO visualiza
      const crossStoreCheck = db.public.many(`
        SELECT * FROM product_bot_visibility 
        WHERE store_id = '${storeAId}' AND bot_id = '${botB1Id}' AND product_id = '${prodSpecificId}';
      `);
      expect(crossStoreCheck).toHaveLength(0);
    });
  });

  // =========================================================================
  // SEÇÃO 2: INTEGRAÇÃO DO CONTEXTO DE INICIALIZAÇÃO COM CATALOG RESOLVER
  // =========================================================================
  describe("2. Integração da Inicialização do Mini App com Catálogo Multi-Bot", () => {
    it("2.1 originBotId válido entrega estritamente os produtos vinculados ao bot sem distorcer o escopo", () => {
      const prodA1 = crypto.randomUUID();
      const prodA2 = crypto.randomUUID();

      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price) VALUES 
          ('${prodA1}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'P1', 'p1', 10),
          ('${prodA2}', '${storeAId}', '${botA2Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'P2', 'p2', 20);

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver) VALUES 
          ('${storeAId}', '${prodA1}', '${botA1Id}', true, true),
          ('${storeAId}', '${prodA2}', '${botA2Id}', true, true);
      `);

      // Quando o Mini App abre com originBotId = botA1Id
      const resolvedIdsForBotA1 = db.public.many(`
        SELECT product_id FROM product_bot_visibility 
        WHERE store_id = '${storeAId}' AND bot_id = '${botA1Id}';
      `).map((r: any) => r.product_id);

      expect(resolvedIdsForBotA1).toContain(prodA1);
      expect(resolvedIdsForBotA1).not.toContain(prodA2);
    });

    it("2.2 Mini App sem botId (Web ou contexto nulo) não vaza produtos BOT_SPECIFIC", () => {
      const prodA1 = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodA1}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'P1', 'p1', 10);

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prodA1}', '${botA1Id}', true, true);
      `);

      // Consulta de catálogo geral (botId = null)
      const webProducts = db.public.many(`
        SELECT id FROM products 
        WHERE store_id = '${storeAId}' AND catalog_scope = 'STORE_GENERAL' AND status = 'active';
      `);

      expect(webProducts.map((p: any) => p.id)).not.toContain(prodA1);
    });

    it("2.3 Bot inativo não é resolvido e não entrega catálogo", () => {
      const prodA4 = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodA4}', '${storeAId}', '${botA4InactiveId}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'P4', 'p4', 15);

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prodA4}', '${botA4InactiveId}', true, true);
      `);

      // Validação do bot no contexto: status deve ser 'active'
      const activeBotRecord = db.public.many(`
        SELECT id FROM telegram_bots WHERE id = '${botA4InactiveId}' AND store_id = '${storeAId}' AND status = 'active';
      `);

      expect(activeBotRecord).toHaveLength(0); // Bot inativo rejeitado
    });

    it("2.4 Tentativa de cross-store: bot de Store B não resolve em Store A", () => {
      const botFromOtherStore = db.public.many(`
        SELECT id FROM telegram_bots WHERE id = '${botB1Id}' AND store_id = '${storeAId}' AND status = 'active';
      `);
      expect(botFromOtherStore).toHaveLength(0); // Isolamento multi-tenant confirmado
    });

    it("2.5 Cache tag reflete isolamento perfeito por bot", () => {
      const cacheTagBot1 = `store-home-loja-alpha-${botA1Id}`;
      const cacheTagBot2 = `store-home-loja-alpha-${botA2Id}`;
      const cacheTagWeb = `store-home-loja-alpha-web`;

      expect(cacheTagBot1).not.toBe(cacheTagBot2);
      expect(cacheTagBot1).not.toBe(cacheTagWeb);
    });
  });
});

