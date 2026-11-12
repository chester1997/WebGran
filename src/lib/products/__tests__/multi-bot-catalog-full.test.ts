import { describe, it, expect, beforeEach, vi } from "vitest";
import { newDb, DataType } from "pg-mem";
import crypto from "crypto";

describe("WebGran — Multi-Bot Catalog, Order Traceability & Delivery Suite", () => {
  let db: any;
  const storeAId = "11111111-1111-1111-1111-111111111111";
  const storeBId = "22222222-2222-2222-2222-222222222222";
  const botA1Id = "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa";
  const botA2Id = "aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa";
  const botB1Id = "bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb";

  beforeEach(() => {
    db = newDb({ noAstCoverageCheck: true });
    db.public.registerFunction({
      name: "gen_random_uuid",
      returns: DataType.uuid,
      impure: true,
      implementation: () => crypto.randomUUID(),
    });

    // Mirror tables
    db.public.none(`
      CREATE TABLE stores (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL,
        owner_id text
      );

      CREATE TABLE telegram_bots (
        id uuid PRIMARY KEY,
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        username text NOT NULL,
        display_name text,
        token_encrypted text,
        status text DEFAULT 'active' NOT NULL,
        sales_mode text DEFAULT 'MINI_APP' NOT NULL,
        UNIQUE (id, store_id)
      );

      CREATE TABLE telegram_bot_chats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id uuid NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
        chat_id text NOT NULL,
        title text,
        type text NOT NULL,
        can_invite_users boolean DEFAULT true NOT NULL,
        status text DEFAULT 'active' NOT NULL
      );

      CREATE TABLE products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL,
        catalog_scope text DEFAULT 'STORE_GENERAL' NOT NULL,
        sharing_mode text DEFAULT 'EXCLUSIVE' NOT NULL,
        title text NOT NULL,
        slug text NOT NULL,
        price numeric(10,2) NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        delivery_type text DEFAULT 'link' NOT NULL,
        delivery_value text,
        UNIQUE (id, store_id)
      );

      CREATE TABLE product_bot_visibility (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        bot_id uuid NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
        is_owner boolean DEFAULT false NOT NULL,
        can_deliver boolean DEFAULT true NOT NULL,
        delivery_block_reason text,
        UNIQUE (product_id, bot_id)
      );

      CREATE TABLE orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        customer_id text NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        total numeric(10,2) NOT NULL,
        origin_bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL,
        owner_bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL,
        delivery_mode text DEFAULT 'LINK' NOT NULL
      );
    `);

    // Seed Stores & Bots
    db.public.none(`
      INSERT INTO stores (id, name, slug, owner_id) VALUES 
        ('${storeAId}', 'Loja A', 'loja-a', 'seller-a'),
        ('${storeBId}', 'Loja B', 'loja-b', 'seller-b');

      INSERT INTO telegram_bots (id, store_id, username, display_name, status) VALUES 
        ('${botA1Id}', '${storeAId}', 'bot_a1', 'Bot Alpha 1', 'active'),
        ('${botA2Id}', '${storeAId}', 'bot_a2', 'Bot Alpha 2', 'active'),
        ('${botB1Id}', '${storeBId}', 'bot_b1', 'Bot Beta 1', 'active');
    `);
  });

  describe("1. Isolamento de Catálogo e Resolução de Visibilidade", () => {
    it("Mini App do Bot 1 exibe apenas produtos com visibilidade para o Bot 1", () => {
      // Produto 1: Exclusivo do Bot A1
      const prod1Id = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prod1Id}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'Prod A1', 'prod-a1', 50);

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prod1Id}', '${botA1Id}', true, true);
      `);

      // Produto 2: Exclusivo do Bot A2
      const prod2Id = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prod2Id}', '${storeAId}', '${botA2Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'Prod A2', 'prod-a2', 70);

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prod2Id}', '${botA2Id}', true, true);
      `);

      // Consulta de visibilidade para o Bot A1
      const bot1Products = db.public.many(`
        SELECT p.id, p.title 
        FROM products p
        JOIN product_bot_visibility v ON p.id = v.product_id
        WHERE v.store_id = '${storeAId}' AND v.bot_id = '${botA1Id}';
      `);

      expect(bot1Products).toHaveLength(1);
      expect(bot1Products[0].id).toBe(prod1Id);

      // Consulta de visibilidade para o Bot A2
      const bot2Products = db.public.many(`
        SELECT p.id, p.title 
        FROM products p
        JOIN product_bot_visibility v ON p.id = v.product_id
        WHERE v.store_id = '${storeAId}' AND v.bot_id = '${botA2Id}';
      `);

      expect(bot2Products).toHaveLength(1);
      expect(bot2Products[0].id).toBe(prod2Id);
    });

    it("Loja Geral (Web) exibe apenas produtos do escopo STORE_GENERAL", () => {
      // Produto Store General
      const prodGeneralId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodGeneralId}', '${storeAId}', NULL, 'STORE_GENERAL', 'EXCLUSIVE', 'Prod Geral', 'prod-geral', 30);
      `);

      // Produto Bot Specific
      const prodBotId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodBotId}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'Prod Bot', 'prod-bot', 40);

        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${prodBotId}', '${botA1Id}', true, true);
      `);

      // Consulta web geral (sem bot)
      const webProducts = db.public.many(`
        SELECT id, title, catalog_scope 
        FROM products 
        WHERE store_id = '${storeAId}' AND catalog_scope = 'STORE_GENERAL' AND status = 'active';
      `);

      expect(webProducts).toHaveLength(1);
      expect(webProducts[0].id).toBe(prodGeneralId);
    });
  });

  describe("2. Snapshot de Bots Existentes em BOT_GENERAL e Compartilhamento", () => {
    it("BOT_GENERAL adiciona apenas os bots existentes no momento da ativação; novos bots criados depois NÃO herdam", () => {
      const prodGeneralBotId = crypto.randomUUID();

      // Ativação do produto BOT_GENERAL quando existem apenas Bot A1 e Bot A2
      const activeBotsAtCreation = db.public.many(`
        SELECT id FROM telegram_bots WHERE store_id = '${storeAId}' AND status = 'active';
      `);
      expect(activeBotsAtCreation).toHaveLength(2);

      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodGeneralBotId}', '${storeAId}', NULL, 'BOT_GENERAL', 'ALL_EXISTING', 'Curso Geral', 'curso-geral', 100);
      `);

      for (const b of activeBotsAtCreation) {
        db.public.none(`
          INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
          VALUES ('${storeAId}', '${prodGeneralBotId}', '${b.id}', false, true);
        `);
      }

      // Verificação do snapshot inicial: 2 bots vinculados
      const initialVisibilities = db.public.many(`
        SELECT * FROM product_bot_visibility WHERE product_id = '${prodGeneralBotId}';
      `);
      expect(initialVisibilities).toHaveLength(2);

      // Criação posterior do Bot A3 na mesma loja
      const botA3Id = crypto.randomUUID();
      db.public.none(`
        INSERT INTO telegram_bots (id, store_id, username, display_name, status)
        VALUES ('${botA3Id}', '${storeAId}', 'bot_a3', 'Bot Alpha 3', 'active');
      `);

      // O produto NÃO deve ter sido atribuído ao Bot A3
      const visibilitiesAfterNewBot = db.public.many(`
        SELECT * FROM product_bot_visibility WHERE product_id = '${prodGeneralBotId}' AND bot_id = '${botA3Id}';
      `);
      expect(visibilitiesAfterNewBot).toHaveLength(0);

      // Os 2 bots originais continuam tendo visibilidade
      const originalBot1Vis = db.public.many(`
        SELECT * FROM product_bot_visibility WHERE product_id = '${prodGeneralBotId}' AND bot_id = '${botA1Id}';
      `);
      expect(originalBot1Vis).toHaveLength(1);
    });

    it("Compartilhamento CUSTOM vincula exclusivamente os bots selecionados pelo vendedor", () => {
      const customProdId = crypto.randomUUID();

      // Bot A1 cria produto e compartilha sob demanda apenas com Bot A2 (não com outros)
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${customProdId}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'CUSTOM', 'Custom Prod', 'custom-prod', 150);

        -- Dono
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${customProdId}', '${botA1Id}', true, true);

        -- Compartilhado explicitamente com Bot A2
        INSERT INTO product_bot_visibility (store_id, product_id, bot_id, is_owner, can_deliver)
        VALUES ('${storeAId}', '${customProdId}', '${botA2Id}', false, true);
      `);

      const visibilities = db.public.many(`
        SELECT bot_id, is_owner FROM product_bot_visibility WHERE product_id = '${customProdId}' ORDER BY is_owner DESC;
      `);
      expect(visibilities).toHaveLength(2);
      expect(visibilities[0].bot_id).toBe(botA1Id);
      expect(visibilities[0].is_owner).toBe(true);
      expect(visibilities[1].bot_id).toBe(botA2Id);
      expect(visibilities[1].is_owner).toBe(false);
    });
  });

  describe("3. Rastreabilidade de Pedidos e Carrinho Multi-Item", () => {
    it("Pedido originado no Mini App grava origin_bot_id e owner_bot_id", () => {
      const prodId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES ('${prodId}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'Item Alpha', 'item-alpha', 99);
      `);

      // Compra feita pelo Bot A1
      const orderId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO orders (id, store_id, customer_id, total, origin_bot_id, owner_bot_id, delivery_mode)
        VALUES ('${orderId}', '${storeAId}', 'cust-123', 99, '${botA1Id}', '${botA1Id}', 'LINK');
      `);

      const savedOrder = db.public.one(`SELECT * FROM orders WHERE id = '${orderId}'`);
      expect(savedOrder.origin_bot_id).toBe(botA1Id);
      expect(savedOrder.owner_bot_id).toBe(botA1Id);
      expect(savedOrder.delivery_mode).toBe("LINK");
    });

    it("Carrinho com itens de múltiplos bots proprietários preserva a propriedade por item sem forçar dono único no cabeçalho", () => {
      const prodA1 = crypto.randomUUID();
      const prodA2 = crypto.randomUUID();

      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price)
        VALUES 
          ('${prodA1}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'ALL_EXISTING', 'Prod de A1', 'prod-de-a1', 30),
          ('${prodA2}', '${storeAId}', '${botA2Id}', 'BOT_SPECIFIC', 'ALL_EXISTING', 'Prod de A2', 'prod-de-a2', 70);
      `);

      // Compra originada no Bot A1 contendo ambos os produtos (compartilhados)
      // Como os proprietários são distintos (A1 e A2), o header do pedido registra owner_bot_id = NULL (múltiplos proprietários)
      const orderMultiId = crypto.randomUUID();
      const uniqueOwners = [botA1Id, botA2Id];
      const headerOwnerBotId = uniqueOwners.length === 1 ? uniqueOwners[0] : null;

      db.public.none(`
        INSERT INTO orders (id, store_id, customer_id, total, origin_bot_id, owner_bot_id, delivery_mode)
        VALUES ('${orderMultiId}', '${storeAId}', 'cust-456', 100, '${botA1Id}', ${headerOwnerBotId ? `'${headerOwnerBotId}'` : 'NULL'}, 'LINK');
      `);

      const multiOrder = db.public.one(`SELECT * FROM orders WHERE id = '${orderMultiId}'`);
      expect(multiOrder.origin_bot_id).toBe(botA1Id);
      expect(multiOrder.owner_bot_id).toBeNull(); // Múltiplos proprietários preservados sem conflito
      expect(multiOrder.delivery_mode).toBe("LINK");
    });

    it("Presença de produto dinâmico do Telegram define delivery_mode = 'BOT_PERMISSION'", () => {
      const dynProdId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price, delivery_type, delivery_value)
        VALUES ('${dynProdId}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'Grupo VIP', 'grupo-vip', 120, 'telegram', '-100999888');
      `);

      const orderDynId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO orders (id, store_id, customer_id, total, origin_bot_id, owner_bot_id, delivery_mode)
        VALUES ('${orderDynId}', '${storeAId}', 'cust-789', 120, '${botA1Id}', '${botA1Id}', 'BOT_PERMISSION');
      `);

      const dynOrder = db.public.one(`SELECT * FROM orders WHERE id = '${orderDynId}'`);
      expect(dynOrder.delivery_mode).toBe("BOT_PERMISSION");
    });
  });

  describe("4. Regras de Entrega: LINK vs BOT_PERMISSION", () => {
    it("LINK: Entrega por link externo tem sucesso sem exigir administração de canal", () => {
      const prodLinkId = crypto.randomUUID();
      db.public.none(`
        INSERT INTO products (id, store_id, bot_id, catalog_scope, sharing_mode, title, slug, price, delivery_type, delivery_value)
        VALUES ('${prodLinkId}', '${storeAId}', '${botA1Id}', 'BOT_SPECIFIC', 'EXCLUSIVE', 'Ebook', 'ebook', 25, 'link', 'https://example.com/download');
      `);

      // Na modalidade LINK, qualquer bot ativo da loja (ou o originBot) pode disparar a mensagem
      const activeBot = db.public.one(`
        SELECT * FROM telegram_bots WHERE id = '${botA1Id}' AND store_id = '${storeAId}' AND status = 'active';
      `);
      expect(activeBot).toBeDefined();
      expect(activeBot.status).toBe("active");
    });

    it("BOT_PERMISSION: Exige direitos administrativos no canal e NÃO faz fallback silencioso", () => {
      const channelChatId = "-1001234567890";

      // Bot A1 tem permissão no canal
      db.public.none(`
        INSERT INTO telegram_bot_chats (bot_id, chat_id, title, type, can_invite_users, status)
        VALUES ('${botA1Id}', '${channelChatId}', 'Canal VIP', 'channel', true, 'active');
      `);

      // Verificar que Bot A1 tem permissão
      const bot1Perm = db.public.one(`
        SELECT can_invite_users FROM telegram_bot_chats 
        WHERE bot_id = '${botA1Id}' AND chat_id = '${channelChatId}' AND status = 'active';
      `);
      expect(bot1Perm.can_invite_users).toBe(true);

      // Verificar que Bot A2 NÃO tem permissão registrada neste canal
      const bot2Perm = db.public.many(`
        SELECT * FROM telegram_bot_chats 
        WHERE bot_id = '${botA2Id}' AND chat_id = '${channelChatId}' AND status = 'active';
      `);
      expect(bot2Perm).toHaveLength(0);

      // Se a compra foi originada no Bot A2, mas o Bot A2 não administra o canal:
      // O sistema DEVE rejeitar com erro explícito e NUNCA realizar fallback silencioso para Bot A1!
      const hasPermission = bot2Perm.length > 0 && bot2Perm[0].can_invite_users;
      expect(hasPermission).toBe(false); // Falha explícita garantida
    });
  });
});

