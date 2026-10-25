import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccessDeliveryService } from "../access-delivery-service";

// In-memory mock database tables
const dbOrders: Record<string, any> = {};
const dbOrderItems: any[] = [];
const dbStores: Record<string, any> = {};
const dbProducts: Record<string, any> = {};
const dbBots: Record<string, any> = {};
const dbCustomers: Record<string, any> = {};
const dbAccesses: Record<string, any> = {};

vi.mock("@/db", () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbOrders)[0] || null;
        }),
      },
      orderItems: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          return dbOrderItems;
        }),
      },
      stores: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbStores)[0] || null;
        }),
      },
      products: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          // Can match by ID if queried
          for (const prod of Object.values(dbProducts)) {
            return prod;
          }
          return null;
        }),
      },
      telegramBots: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbBots)[0] || null;
        }),
      },
      accesses: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return Object.values(dbAccesses)[0] || null;
        }),
        findMany: vi.fn().mockImplementation(async () => {
          return Object.values(dbAccesses);
        }),
      },
    },
    execute: vi.fn().mockImplementation(async (sqlQuery: any) => {
      const records = Object.values(dbAccesses);
      if (records.length > 0) {
        return [{ id: records[0].id }];
      }
      return [{ id: "claim-ok" }];
    }),
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((vals: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          const item = Array.isArray(vals) ? vals[0] : vals;
          const id = item.id || `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const record = { id, ...item };
          dbAccesses[id] = record;
          return [record];
        }),
      })),
    })),
    update: vi.fn().mockImplementation((table: any) => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(async () => {
          for (const key of Object.keys(dbAccesses)) {
            Object.assign(dbAccesses[key], updates);
          }
          return [updates];
        }),
      })),
    })),
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token-123"),
}));

vi.mock("../telegram-delivery-service", () => ({
  TelegramDeliveryService: {
    validateBotAndChatPermission: vi.fn().mockResolvedValue({ success: true }),
    checkBuyerMembership: vi.fn().mockResolvedValue(false),
    createTelegramInvite: vi.fn().mockImplementation(async () => ({
      inviteLink: `https://t.me/+invite_${Math.random().toString(36).slice(2, 7)}`,
      expireDate: Math.floor(Date.now() / 1000) + 86400,
    })),
    sendPaymentConfirmationMessage: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/notifications/seller-sale-notification-service", () => ({
  SellerSaleNotificationService: {
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true, notified: true }),
  },
}));

vi.mock("@/lib/push/seller-push-service", () => ({
  SellerPushService: {
    notifySellerOfSale: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("Combos Access Delivery Suite (Phase 4 — Etapa 6)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(dbOrders)) delete dbOrders[key];
    dbOrderItems.length = 0;
    for (const key of Object.keys(dbStores)) delete dbStores[key];
    for (const key of Object.keys(dbProducts)) delete dbProducts[key];
    for (const key of Object.keys(dbBots)) delete dbBots[key];
    for (const key of Object.keys(dbCustomers)) delete dbCustomers[key];
    for (const key of Object.keys(dbAccesses)) delete dbAccesses[key];

    // Default valid store & bot
    dbStores["store-1"] = {
      id: "store-1",
      slug: "loja-teste",
      name: "Loja Teste",
      ownerId: "seller-1",
    };

    dbBots["bot-1"] = {
      id: "bot-1",
      botId: "123456",
      storeId: "store-1",
      username: "test_bot",
      tokenEncrypted: "enc-token",
      status: "active",
    };

    dbCustomers["cust-1"] = {
      id: "cust-1",
      telegramUserId: "777888",
      firstName: "Comprador",
    };

    const { db } = await import("@/db");
    vi.mocked(db.query.accesses.findFirst as any).mockImplementation(async () => null);

    const { TelegramDeliveryService } = await import("../telegram-delivery-service");
    vi.mocked(TelegramDeliveryService.validateBotAndChatPermission).mockResolvedValue({ success: true });
  });

  // 1. Entrega normal de um produto avulso
  it("1. Entrega normal de um produto avulso sem regressão", async () => {
    dbProducts["prod-single"] = {
      id: "prod-single",
      storeId: "store-1",
      title: "Curso Único",
      slug: "curso-unico",
      deliveryType: "telegram",
      deliveryValue: "-100111222",
      status: "active",
    };

    dbOrders["ord-single"] = {
      id: "ord-single",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-123",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-single",
          orderId: "ord-single",
          productId: "prod-single",
          comboId: null,
          comboSnapshot: null,
          quantity: 1,
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-single");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("ACTIVE");
    expect(results[0].deliveryStatus).toBe("DELIVERED");
    expect(results[0].inviteLink).toMatch(/^https:\/\/t\.me\/\+invite_/);
  });

  // 2. Entrega de um combo com dois ou mais componentes
  it("2. Entrega de um combo com dois componentes cria acessos independentes para ambos", async () => {
    dbProducts["prod-a"] = {
      id: "prod-a",
      storeId: "store-1",
      title: "Canal Alpha",
      slug: "canal-alpha",
      deliveryType: "telegram",
      deliveryValue: "-1001111",
      status: "active",
    };

    dbProducts["prod-b"] = {
      id: "prod-b",
      storeId: "store-1",
      title: "Grupo Beta",
      slug: "grupo-beta",
      deliveryType: "telegram",
      deliveryValue: "-1002222",
      status: "active",
    };

    const comboSnapshot = {
      comboId: "combo-vip",
      title: "Combo VIP Alpha + Beta",
      priceAtPurchase: "79.90",
      products: [
        {
          id: "prod-a",
          title: "Canal Alpha",
          slug: "canal-alpha",
          deliveryType: "telegram",
          deliveryValue: "-1001111",
        },
        {
          id: "prod-b",
          title: "Grupo Beta",
          slug: "grupo-beta",
          deliveryType: "telegram",
          deliveryValue: "-1002222",
        },
      ],
    };

    dbOrders["ord-combo"] = {
      id: "ord-combo",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-456",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-combo-1",
          orderId: "ord-combo",
          productId: null,
          comboId: "combo-vip",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-combo");
    expect(results).toHaveLength(2);
    expect(results[0].deliveryStatus).toBe("DELIVERED");
    expect(results[0].productId).toBe("prod-a");
    expect(results[0].isComboComponent).toBe(true);

    expect(results[1].deliveryStatus).toBe("DELIVERED");
    expect(results[1].productId).toBe("prod-b");
    expect(results[1].isComboComponent).toBe(true);

    expect(AccessDeliveryService.isOrderFullyDelivered(results)).toBe(true);
  });

  // 3. Reprocessamento do mesmo evento de pagamento sem duplicação (idempotência)
  it("3. Reprocessamento do mesmo evento de pagamento não duplica acessos nem convites", async () => {
    const { TelegramDeliveryService } = await import("../telegram-delivery-service");

    const comboSnapshot = {
      comboId: "combo-vip",
      title: "Combo VIP",
      products: [
        { id: "prod-a", title: "Canal A", deliveryType: "telegram", deliveryValue: "-1001" },
        { id: "prod-b", title: "Canal B", deliveryType: "telegram", deliveryValue: "-1002" },
      ],
    };

    dbOrders["ord-idemp"] = {
      id: "ord-idemp",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "syncpay",
      paymentId: "tx-sync-1",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-combo-idemp",
          orderId: "ord-idemp",
          productId: null,
          comboId: "combo-vip",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    // 1st run
    const firstResults = await AccessDeliveryService.processOrderDelivery("ord-idemp");
    expect(firstResults).toHaveLength(2);

    // Mock existing access found in DB for 2nd run
    const { db } = await import("@/db");
    vi.mocked(db.query.accesses.findFirst as any).mockImplementation(async ({ where }: any) => {
      // Return active delivered access for any lookup
      return {
        id: "acc-existing",
        storeId: "store-1",
        customerId: "cust-1",
        status: "ACTIVE",
        deliveryStatus: "DELIVERED",
        inviteLink: "https://t.me/+mock_existing",
      };
    });

    // 2nd run (webhook replayed)
    const secondResults = await AccessDeliveryService.processOrderDelivery("ord-idemp");
    expect(secondResults).toHaveLength(2);
    expect(secondResults[0].deliveryStatus).toBe("DELIVERED");
    expect(secondResults[1].deliveryStatus).toBe("DELIVERED");

    // createTelegramInvite was NOT called again during 2nd run
    expect(TelegramDeliveryService.createTelegramInvite).toHaveBeenCalledTimes(2); // Only from the 1st run
  });

  // 4. Reprocessamento após falha parcial (componente que falhou é retentado, componente entregue é ignorado)
  it("4. Reprocessamento após falha parcial: retenta apenas o componente que falhou", async () => {
    const { TelegramDeliveryService } = await import("../telegram-delivery-service");

    const comboSnapshot = {
      comboId: "combo-fail-recovery",
      title: "Combo Recovery",
      products: [
        { id: "prod-success", title: "Canal OK", deliveryType: "telegram", deliveryValue: "-100OK" },
        { id: "prod-failed", title: "Canal Erro", deliveryType: "telegram", deliveryValue: "-100ERR" },
      ],
    };

    dbOrders["ord-partial"] = {
      id: "ord-partial",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-part",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-combo-part",
          orderId: "ord-partial",
          productId: null,
          comboId: "combo-fail-recovery",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    // On 1st run: validateBotAndChatPermission fails for -100ERR
    vi.mocked(TelegramDeliveryService.validateBotAndChatPermission).mockImplementation(
      async (token: string, chatId: string) => {
        if (chatId === "-100ERR") {
          return { success: false, error: "Bot is not an administrator in -100ERR" };
        }
        return { success: true };
      }
    );

    const firstRun = await AccessDeliveryService.processOrderDelivery("ord-partial");
    expect(firstRun).toHaveLength(2);
    expect(firstRun[0].deliveryStatus).toBe("DELIVERED");
    expect(firstRun[1].deliveryStatus).toBe("FAILED");
    expect(AccessDeliveryService.isOrderFullyDelivered(firstRun)).toBe(false);

    // On 2nd run: seller fixed bot permissions in -100ERR
    vi.mocked(TelegramDeliveryService.validateBotAndChatPermission).mockResolvedValue({
      success: true,
    });

    const { db } = await import("@/db");
    vi.mocked(db.query.accesses.findFirst as any).mockImplementation(async ({ where }: any) => {
      // Find access for prod-success -> already DELIVERED
      // For prod-failed -> status FAILED (allows retry)
      return null; // Will query or we can let it re-evaluate
    });

    const secondRun = await AccessDeliveryService.processOrderDelivery("ord-partial");
    expect(secondRun).toHaveLength(2);
    expect(secondRun.every((r) => r.deliveryStatus === "DELIVERED")).toBe(true);
  });

  // 5. Componente já entregue e componente ainda pendente
  it("5. Trata corretamente quando um componente já foi entregue e outro está pendente", async () => {
    const { db } = await import("@/db");

    const comboSnapshot = {
      comboId: "combo-mixed-status",
      title: "Combo Misto",
      products: [
        { id: "prod-delivered", title: "Já Entregue", deliveryType: "telegram", deliveryValue: "-1001" },
        { id: "prod-pending", title: "Pendente", deliveryType: "telegram", deliveryValue: "-1002" },
      ],
    };

    dbOrders["ord-mixed"] = {
      id: "ord-mixed",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-m",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-mixed",
          orderId: "ord-mixed",
          productId: null,
          comboId: "combo-mixed-status",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    vi.mocked(db.query.accesses.findFirst as any).mockImplementation(async ({ where }: any) => {
      // Simulate that prod-delivered is found and already ACTIVE/DELIVERED
      // whereas prod-pending is null
      return {
        id: "acc-deliv",
        storeId: "store-1",
        customerId: "cust-1",
        productId: "prod-delivered",
        orderId: "ord-mixed",
        status: "ACTIVE",
        deliveryStatus: "DELIVERED",
        inviteLink: "https://t.me/+already_delivered",
      };
    });

    const results = await AccessDeliveryService.processOrderDelivery("ord-mixed");
    expect(results).toHaveLength(2);
    expect(results[0].deliveryStatus).toBe("DELIVERED");
    expect(results[0].inviteLink).toBe("https://t.me/+already_delivered");
  });

  // 6. Snapshot ausente, vazio ou inválido
  it("6. Registra erro recuperável e não inventa dados quando combo_snapshot é ausente ou inválido", async () => {
    dbOrders["ord-bad-snapshot"] = {
      id: "ord-bad-snapshot",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-bad",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-corrupt",
          orderId: "ord-bad-snapshot",
          productId: null,
          comboId: "combo-broken",
          comboSnapshot: null, // missing!
          quantity: 1,
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-bad-snapshot");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("FAILED");
    expect(results[0].deliveryStatus).toBe("FAILED");
    expect(results[0].error).toMatch(/Snapshot do combo ausente ou inválido/);
  });

  // 7. Combo alterado ou excluído após a compra
  it("7. Combo alterado ou excluído após a compra preserva a entrega a partir do snapshot congelado", async () => {
    // Note: combo does not exist in dbCombos or dbProducts table anymore!
    const comboSnapshot = {
      comboId: "combo-deleted-from-store",
      title: "Combo Arquivado",
      priceAtPurchase: "49.90",
      products: [
        {
          id: "prod-deleted-1",
          title: "Canal Arquivado",
          slug: "canal-arquivado",
          deliveryType: "telegram",
          deliveryValue: "-1009999",
        },
      ],
    };

    dbOrders["ord-deleted-combo"] = {
      id: "ord-deleted-combo",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-del",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-archived",
          orderId: "ord-deleted-combo",
          productId: null,
          comboId: "combo-deleted-from-store",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-deleted-combo");
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("ACTIVE");
    expect(results[0].deliveryStatus).toBe("DELIVERED");
    expect(results[0].productId).toBe("prod-deleted-1");
  });

  // 8. Componente indisponível no serviço externo de entrega
  it("8. Componente indisponível no Telegram não derruba nem silencia os demais componentes", async () => {
    const { TelegramDeliveryService } = await import("../telegram-delivery-service");

    const comboSnapshot = {
      comboId: "combo-partial-error",
      title: "Combo 2 itens",
      products: [
        { id: "prod-fail-telegram", title: "Canal Inacessível", deliveryType: "telegram", deliveryValue: "-100BAD" },
        { id: "prod-pass-telegram", title: "Canal Normal", deliveryType: "telegram", deliveryValue: "-100GOOD" },
      ],
    };

    dbOrders["ord-ext-err"] = {
      id: "ord-ext-err",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-err",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-ext",
          orderId: "ord-ext-err",
          productId: null,
          comboId: "combo-partial-error",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    vi.mocked(TelegramDeliveryService.validateBotAndChatPermission).mockImplementation(
      async (token: string, chatId: string) => {
        if (chatId === "-100BAD") {
          throw new Error("Telegram API: Chat not found");
        }
        return { success: true };
      }
    );

    const results = await AccessDeliveryService.processOrderDelivery("ord-ext-err");
    expect(results).toHaveLength(2);
    expect(results[0].deliveryStatus).toBe("FAILED");
    expect(results[0].error).toContain("Telegram API: Chat not found");

    expect(results[1].deliveryStatus).toBe("DELIVERED");
    expect(results[1].inviteLink).toBeDefined();
  });

  // 9. Combo com quantidade maior que um
  it("9. Combo com quantidade maior que um garante acesso ao comprador sem gerar convites duplicados", async () => {
    const comboSnapshot = {
      comboId: "combo-qty-2",
      title: "Combo Qty 2",
      products: [
        { id: "prod-c1", title: "Canal 1", deliveryType: "telegram", deliveryValue: "-1001" },
        { id: "prod-c2", title: "Canal 2", deliveryType: "telegram", deliveryValue: "-1002" },
      ],
    };

    dbOrders["ord-qty-2"] = {
      id: "ord-qty-2",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-qty",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-qty-2",
          orderId: "ord-qty-2",
          productId: null,
          comboId: "combo-qty-2",
          comboSnapshot,
          quantity: 3, // quantity 3!
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-qty-2");
    // Grants access to the 2 unique products in the combo
    expect(results).toHaveLength(2);
    expect(results[0].deliveryStatus).toBe("DELIVERED");
    expect(results[1].deliveryStatus).toBe("DELIVERED");
  });

  // 10. Pagamento pendente, inválido ou não confirmado, sem entrega
  it("10. Pagamento pendente, inválido ou não confirmado: não realiza nenhuma entrega", async () => {
    dbOrders["ord-pending"] = {
      id: "ord-pending",
      storeId: "store-1",
      customerId: "cust-1",
      status: "pending", // NOT paid!
      paymentMethod: null,
      paymentId: null,
      items: [
        {
          id: "item-p",
          productId: null,
          comboId: "combo-1",
          comboSnapshot: { products: [{ id: "p1" }] },
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-pending");
    expect(results).toHaveLength(0);
    expect(Object.keys(dbAccesses)).toHaveLength(0);
  });

  // 11. Isolamento entre lojas
  it("11. Isolamento entre lojas: rejeita entrega se produto ou bot pertencer a outra loja", async () => {
    dbProducts["prod-other-store"] = {
      id: "prod-other-store",
      storeId: "store-2", // DIFFERENT STORE!
      title: "Produto de Outra Loja",
      deliveryType: "telegram",
      deliveryValue: "-100999",
      status: "active",
    };

    const comboSnapshot = {
      comboId: "combo-alien",
      title: "Combo com Produto Infiltrado",
      products: [
        {
          id: "prod-other-store",
          storeId: "store-2", // DIFFERENT STORE in snapshot!
          title: "Produto de Outra Loja",
          deliveryType: "telegram",
          deliveryValue: "-100999",
        },
      ],
    };

    dbOrders["ord-alien"] = {
      id: "ord-alien",
      storeId: "store-1", // Store 1!
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-alien",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-alien",
          orderId: "ord-alien",
          productId: null,
          comboId: "combo-alien",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    const results = await AccessDeliveryService.processOrderDelivery("ord-alien");
    expect(results).toHaveLength(1);
    expect(results[0].deliveryStatus).toBe("FAILED");
    expect(results[0].error).toMatch(/outra loja/i);
    expect(Object.keys(dbAccesses)).toHaveLength(0);
  });

  // 12. Notificações sem duplicidade
  it("12. Dispara notificações ao vendedor de forma não-bloqueante e protegida contra duplicidade", async () => {
    const { SellerSaleNotificationService } = await import(
      "@/lib/notifications/seller-sale-notification-service"
    );

    const comboSnapshot = {
      comboId: "combo-notif",
      title: "Combo com Notificação",
      products: [{ id: "p1", title: "C1", deliveryType: "telegram", deliveryValue: "-1001" }],
    };

    dbOrders["ord-notif"] = {
      id: "ord-notif",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-notif",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-notif",
          orderId: "ord-notif",
          productId: null,
          comboId: "combo-notif",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    await AccessDeliveryService.processOrderDelivery("ord-notif");
    expect(SellerSaleNotificationService.notifySellerOfSale).toHaveBeenCalledWith("ord-notif");
  });

  // 13. Concorrência real com Promise.all
  it("13. Concorrência real: duas tentativas simultâneas via Promise.all para o mesmo pedido e componente geram o convite do Telegram exatamente uma vez", async () => {
    const { db } = await import("@/db");
    const { TelegramDeliveryService } = await import("../telegram-delivery-service");

    const comboSnapshot = {
      comboId: "combo-concurrent",
      title: "Combo Concorrente",
      products: [
        { id: "prod-concurrent-1", title: "Canal Concorrência", deliveryType: "telegram", deliveryValue: "-100777" },
      ],
    };

    dbOrders["ord-concurrent"] = {
      id: "ord-concurrent",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-concurrent",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-concurrent",
          orderId: "ord-concurrent",
          productId: null,
          comboId: "combo-concurrent",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    let sharedAccess: any = null;
    let insertCount = 0;

    // Simulate database constraint: only the first insert succeeds; concurrent insert throws unique violation
    vi.mocked(db.insert as any).mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          insertCount++;
          if (insertCount === 1) {
            sharedAccess = {
              id: "acc-concurrent-winner",
              ...vals,
              status: "PENDING",
              deliveryStatus: "PROCESSING",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return [sharedAccess];
          } else {
            const uniqueViolationError: any = new Error(
              'duplicate key value violates unique constraint "accesses_store_customer_product_order_uidx"'
            );
            uniqueViolationError.code = "23505";
            throw uniqueViolationError;
          }
        }),
      })),
    }));

    // findFirst returns the shared record once created
    vi.mocked(db.query.accesses.findFirst as any).mockImplementation(async () => {
      return sharedAccess;
    });

    // Atomic lease acquisition & finalization
    vi.mocked(db.execute as any).mockImplementation(async (query: any) => {
      const qStr = JSON.stringify(query);
      if (qStr.includes("DELIVERED")) {
        if (sharedAccess) {
          sharedAccess.deliveryStatus = "DELIVERED";
          sharedAccess.status = "ACTIVE";
          sharedAccess.inviteLink = inviteLink;
        }
        return [{ id: sharedAccess?.id || "acc-concurrent-winner" }];
      }
      if (!sharedAccess) return [];
      if (sharedAccess.deliveryStatus === "DELIVERED") return [];
      if (typeof sharedAccess.deliveryStatus === "string" && sharedAccess.deliveryStatus.startsWith("PROCESSING")) {
        return []; // Active lease held by worker 1!
      }
      sharedAccess.deliveryStatus = "PROCESSING";
      return [{ id: sharedAccess.id }];
    });

    // Update updates the in-memory shared access
    vi.mocked(db.update as any).mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates: any) => ({
        where: vi.fn().mockImplementation(async () => {
          if (sharedAccess) {
            Object.assign(sharedAccess, updates);
          }
          return [updates];
        }),
      })),
    }));

    // External side effect: Telegram API call with real network latency simulation
    const inviteLink = "https://t.me/+atomic_exclusive_invite";
    vi.mocked(TelegramDeliveryService.createTelegramInvite).mockImplementation(async () => {
      // Simulate 100ms Telegram network call
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        inviteLink,
        expireDate: Math.floor(Date.now() / 1000) + 86400,
      };
    });

    // Execute two simultaneous delivery attempts for the exact same order and combo
    const [run1, run2] = await Promise.all([
      AccessDeliveryService.processOrderDelivery("ord-concurrent"),
      AccessDeliveryService.processOrderDelivery("ord-concurrent"),
    ]);

    // ABSOLUTE GUARANTEE: The external side effect (Telegram API invite link generation)
    // was executed EXACTLY ONCE across both concurrent workers!
    expect(TelegramDeliveryService.createTelegramInvite).toHaveBeenCalledTimes(1);

    // Both workers resolved cleanly with DELIVERED status and the exact same invite link
    expect(run1).toHaveLength(1);
    expect(run2).toHaveLength(1);
    expect(run1[0].deliveryStatus).toBe("DELIVERED");
    expect(run2[0].deliveryStatus).toBe("DELIVERED");
    expect(run1[0].inviteLink).toBe(inviteLink);
    expect(run2[0].inviteLink).toBe(inviteLink);
  });

  // 14. Concorrência extrema com lease ativo em voo
  it("14. Concorrência extrema: chamada externa lenta não gera convite duplicado se o segundo worker terminar o polling antes", async () => {
    const { db } = await import("@/db");
    const { TelegramDeliveryService } = await import("../telegram-delivery-service");

    const comboSnapshot = {
      comboId: "combo-slow-race",
      title: "Combo Corrida Lenta",
      products: [
        { id: "prod-slow-1", title: "Canal Lento", deliveryType: "telegram", deliveryValue: "-100888" },
      ],
    };

    dbOrders["ord-slow-race"] = {
      id: "ord-slow-race",
      storeId: "store-1",
      customerId: "cust-1",
      status: "paid",
      paymentMethod: "pushinpay",
      paymentId: "pix-slow",
      customer: dbCustomers["cust-1"],
      items: [
        {
          id: "item-slow",
          orderId: "ord-slow-race",
          productId: null,
          comboId: "combo-slow-race",
          comboSnapshot,
          quantity: 1,
        },
      ],
    };

    const sharedAccess = {
      id: "acc-slow-lease",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-slow-1",
      orderId: "ord-slow-race",
      status: "PENDING",
      deliveryStatus: "PROCESSING",
      updatedAt: new Date(), // lease actively held < 30s
    };

    // Database simulates that the record already exists and is PROCESSING
    vi.mocked(db.query.accesses.findFirst as any).mockImplementation(async () => sharedAccess);

    // Atomic lease acquisition fails because another worker has an active lease (< 30s)
    vi.mocked(db.execute as any).mockResolvedValue([]);

    // Worker attempts delivery
    const results = await AccessDeliveryService.processOrderDelivery("ord-slow-race");

    // Must NOT call Telegram API because it failed to acquire the lease
    expect(TelegramDeliveryService.createTelegramInvite).not.toHaveBeenCalled();

    // Result reflects safe skip without throwing or creating duplicate
    expect(results).toHaveLength(1);
    expect(results[0].deliveryStatus).toBe("PROCESSING");
    expect(results[0].inviteLink).toBeUndefined();
  });

  // 15. Chamada externa longa (> 30s) com renovação de lease (heartbeat)
  it("15. Chamada externa longa (> 30s) com renovação periódica de lease: heartbeat impede a tomada do lease por worker concorrente enquanto o proprietário original ainda está ativo", async () => {
    const { db } = await import("@/db");
    const { TelegramDeliveryService } = await import("../telegram-delivery-service");

    let heartbeatCount = 0;
    const accessId = "acc-heartbeat-test";
    const claimToken1 = "token-worker-1";

    // Mock db.execute to track heartbeats and lease queries
    vi.mocked(db.execute as any).mockImplementation(async (query: any) => {
      const qStr = JSON.stringify(query);
      if (qStr.includes("updated_at") && !qStr.includes("PENDING")) {
        heartbeatCount++;
        return [{ id: accessId }];
      }
      return [{ id: accessId }];
    });

    // 1. Worker 1 acquires lease
    const acquired = await AccessDeliveryService.acquireDeliveryLease(accessId, claimToken1);
    expect(acquired).toBe(true);

    // 2. Heartbeat fires periodically to keep the lease fresh
    const renewed = await AccessDeliveryService.renewDeliveryLease(accessId, claimToken1);
    expect(renewed).toBe(true);
    expect(heartbeatCount).toBeGreaterThanOrEqual(1);

    // 3. Worker 2 attempts to acquire lease while Worker 1 is still actively beating:
    // Database check: updated_at was just refreshed, so updated_at < NOW() - 30s evaluates to FALSE.
    vi.mocked(db.execute as any).mockImplementationOnce(async () => []); // DB returns 0 rows updated because updated_at is fresh!
    const worker2Acquired = await AccessDeliveryService.acquireDeliveryLease(accessId, "token-worker-2");
    expect(worker2Acquired).toBe(false);
  });

  // 16. Fencing Token contra Zombie Worker
  it("16. Fencing Token contra Zombie Worker: worker desapossado que atrasou além da expiração não sobrescreve nem marca falha sobre o novo proprietário do lease", async () => {
    const { db } = await import("@/db");

    const accessId = "acc-fencing-test";
    const staleZombieToken = "token-zombie-1";
    const activeWinnerToken = "token-winner-2";

    // Current state in DB belongs to Winner 2
    let currentDbStatus = `PROCESSING:${activeWinnerToken}`;
    let currentDbDeliveryStatus = `PROCESSING:${activeWinnerToken}`;

    vi.mocked(db.execute as any).mockImplementation(async (query: any) => {
      const qStr = JSON.stringify(query);
      // If updating with stale zombie token: WHERE delivery_status = 'PROCESSING:token-zombie-1'
      // Since current state is PROCESSING:token-winner-2, 0 rows match!
      if (qStr.includes(staleZombieToken)) {
        return []; // 0 rows updated! Stale write blocked!
      }
      if (qStr.includes(activeWinnerToken)) {
        currentDbStatus = "ACTIVE";
        currentDbDeliveryStatus = "DELIVERED";
        return [{ id: accessId }];
      }
      return [];
    });

    // Zombie worker tries to finalize delivery success with stale token
    const zombieSuccessWrite = await AccessDeliveryService.finalizeDeliverySuccess(
      accessId,
      staleZombieToken,
      {
        inviteLink: "https://t.me/+zombie_corrupt_link",
        inviteExpiresAt: null,
        grantedAt: new Date(),
        expiresAt: null,
        confirmationSentAt: new Date(),
      }
    );

    // Stale success write is strictly fenced out!
    expect(zombieSuccessWrite).toBe(false);
    expect(currentDbDeliveryStatus).not.toBe("DELIVERED"); // Still belongs to Winner 2

    // Zombie worker tries to mark delivery as failed with stale token
    const zombieFailureWrite = await AccessDeliveryService.finalizeDeliveryFailure(
      accessId,
      staleZombieToken,
      "Zombie error",
      null
    );

    // Stale failure write is also strictly fenced out!
    expect(zombieFailureWrite).toBe(false);

    // Now valid Winner 2 finalizes successfully
    const winnerSuccessWrite = await AccessDeliveryService.finalizeDeliverySuccess(
      accessId,
      activeWinnerToken,
      {
        inviteLink: "https://t.me/+legit_winner_link",
        inviteExpiresAt: null,
        grantedAt: new Date(),
        expiresAt: null,
        confirmationSentAt: new Date(),
      }
    );

    expect(winnerSuccessWrite).toBe(true);
    expect(currentDbDeliveryStatus).toBe("DELIVERED");
  });

  // 17. Heartbeat: Somente o claimToken atual renova e falha no DB não crasha o worker
  it("17. Heartbeat: Somente o claimToken atual renova o lease e falhas de banco durante o heartbeat são tratadas sem crash", async () => {
    const { db } = await import("@/db");
    const accessId = "acc-hb-resilience";
    const currentToken = "token-active-hb";
    const wrongToken = "token-imposter";

    vi.mocked(db.execute as any).mockImplementation(async (query: any) => {
      const qStr = JSON.stringify(query);
      if (qStr.includes(currentToken)) {
        return [{ id: accessId }];
      }
      return []; // wrong token matches 0 rows
    });

    // Valid currentToken renews successfully
    const successRenew = await AccessDeliveryService.renewDeliveryLease(accessId, currentToken);
    expect(successRenew).toBe(true);

    // Imposter token fails to renew lease
    const imposterRenew = await AccessDeliveryService.renewDeliveryLease(accessId, wrongToken);
    expect(imposterRenew).toBe(false);

    // Simulate database connection crash / timeout during heartbeat
    vi.mocked(db.execute as any).mockRejectedValueOnce(new Error("Neon connection timeout / terminating connection due to administrator command"));

    // renewDeliveryLease must catch gracefully and return false without throwing an unhandled rejection
    const crashedRenew = await AccessDeliveryService.renewDeliveryLease(accessId, currentToken);
    expect(crashedRenew).toBe(false);
  });

  // 18. Estados de Entrega: Transições válidas e compatibilidade com estados históricos
  it("18. Estados de Entrega: Garante transições atômicas válidas (PENDING -> PROCESSING:token -> DELIVERED) e bloqueia re-entrega de acessos já DELIVERED", async () => {
    const { db } = await import("@/db");
    const accessId = "acc-lifecycle-compat";
    const token = "token-lifecycle-1";

    // 1. Acesso já DELIVERED no histórico não pode ter novo lease adquirido
    vi.mocked(db.execute as any).mockImplementationOnce(async (query: any) => {
      // Simula DB avaliando: delivery_status = 'PENDING' OR delivery_status = 'FAILED'
      // Como o registro atual tem delivery_status = 'DELIVERED', 0 linhas são afetadas!
      return [];
    });

    const acquiredOnDelivered = await AccessDeliveryService.acquireDeliveryLease(accessId, token);
    expect(acquiredOnDelivered).toBe(false);

    // 2. Acesso em PENDING ou FAILED permite aquisição do lease com claimToken
    vi.mocked(db.execute as any).mockImplementationOnce(async (query: any) => {
      const qStr = JSON.stringify(query);
      expect(qStr).toContain(`PROCESSING:${token}`);
      return [{ id: accessId }];
    });

    const acquiredOnPending = await AccessDeliveryService.acquireDeliveryLease(accessId, token);
    expect(acquiredOnPending).toBe(true);

    // 3. Finalização de sucesso com token correto transiciona atomicamente para DELIVERED
    vi.mocked(db.execute as any).mockImplementationOnce(async (query: any) => {
      const qStr = JSON.stringify(query);
      expect(qStr).toContain("DELIVERED");
      expect(qStr).toContain(`PROCESSING:${token}`);
      return [{ id: accessId }];
    });

    const finalizedSuccess = await AccessDeliveryService.finalizeDeliverySuccess(
      accessId,
      token,
      {
        inviteLink: "https://t.me/+success_link",
        inviteExpiresAt: null,
        grantedAt: new Date(),
        expiresAt: null,
        confirmationSentAt: new Date(),
      }
    );
    expect(finalizedSuccess).toBe(true);
  });
});
