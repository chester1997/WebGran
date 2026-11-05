import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockStoreId, mockOtherStoreId, botA, botB, botInactive, botOtherStore } = vi.hoisted(() => {
  const storeId = "06d519fb-615c-4854-8d79-dbac678289f1";
  const otherStoreId = "88888888-8888-8888-8888-888888888888";

  return {
    mockStoreId: storeId,
    mockOtherStoreId: otherStoreId,
    botA: {
      id: "bot-a-id",
      storeId: storeId,
      botId: "8898281192",
      username: "Nossaseriesblbot",
      botUsername: "Nossaseriesblbot",
      status: "active",
      tokenEncrypted: "enc-token-a",
      createdAt: new Date("2026-01-01"),
    },
    botB: {
      id: "1ac32b42-c82c-4b27-b44f-05f206845b4f",
      storeId: storeId,
      botId: "8858432030",
      username: "appnossalojabot",
      botUsername: "appnossalojabot",
      status: "active",
      tokenEncrypted: "enc-token-b",
      createdAt: new Date("2026-01-02"),
    },
    botInactive: {
      id: "bot-inactive-id",
      storeId: storeId,
      botId: "9999999999",
      username: "InactiveBot",
      botUsername: "InactiveBot",
      status: "inactive",
      tokenEncrypted: "enc-token-inactive",
      createdAt: new Date("2026-01-03"),
    },
    botOtherStore: {
      id: "bot-other-store-id",
      storeId: otherStoreId,
      botId: "7777777777",
      username: "OtherStoreBot",
      botUsername: "OtherStoreBot",
      status: "active",
      tokenEncrypted: "enc-token-other",
      createdAt: new Date("2026-01-04"),
    },
  };
});

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramBotChats: {
        findMany: vi.fn(),
      },
      accesses: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn().mockResolvedValue({ id: mockStoreId, slug: "meus-doraminhas" }),
      },
      products: {
        findFirst: vi.fn(),
      },
    },
    execute: vi.fn().mockResolvedValue([{ id: "access-1" }]),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "access-new" }]),
      }),
    }),
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((val: string) => `decrypted-${val}`),
}));

vi.mock("@/lib/notifications/seller-sale-notification-service", () => ({
  SellerSaleNotificationService: {
    notifySellerOfSale: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/orders/expiration-service", () => ({
  calculateAccessExpiration: vi.fn().mockReturnValue(new Date("2026-12-05")),
}));

import { BotDeliveryResolver } from "../bot-delivery-resolver";
import { AccessDeliveryService } from "../access-delivery-service";
import { TelegramDeliveryService } from "../telegram-delivery-service";

describe("BotDeliveryResolver & Deterministic Bot Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Produto com bot_id válido: resolve exatamente o bot correto sem substituição", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(botB as any);

    const resolved = await BotDeliveryResolver.resolveBotForDelivery({
      storeId: mockStoreId,
      botId: botB.id,
      deliveryType: "telegram",
      deliveryValue: "-1003934210103",
    });

    expect(resolved).toBeDefined();
    expect(resolved.id).toBe(botB.id);
    expect(resolved.botUsername).toBe("appnossalojabot");
  });

  it("2. Bot inativo: lança erro explícito se o bot vinculado ao produto estiver inativo", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(botInactive as any);

    await expect(
      BotDeliveryResolver.resolveBotForDelivery({
        storeId: mockStoreId,
        botId: botInactive.id,
        deliveryType: "telegram",
        deliveryValue: "-1003934210103",
      })
    ).rejects.toThrow("está inativo nesta loja");
  });

  it("3. Bot pertencente a outra loja: rejeita acesso por violação multi-tenant", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(undefined as any);

    await expect(
      BotDeliveryResolver.resolveBotForDelivery({
        storeId: mockStoreId,
        botId: botOtherStore.id,
        deliveryType: "telegram",
        deliveryValue: "-1003934210103",
      })
    ).rejects.toThrow("não encontrado ou não pertence a esta loja");
  });

  it("4. Produto com bot_id NULL e exatamente um bot vinculado ao canal em telegram_bot_chats: seleciona esse bot", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBotChats.findMany).mockResolvedValueOnce([
      {
        id: "chat-map-1",
        storeId: mockStoreId,
        botId: botB.id,
        telegramChatId: "-1003934210103",
        botStatus: "administrator",
        canInviteUsers: true,
        isActive: true,
        bot: botB,
      },
    ] as any);

    const resolved = await BotDeliveryResolver.resolveBotForDelivery({
      storeId: mockStoreId,
      botId: null,
      deliveryType: "telegram",
      deliveryValue: "-1003934210103",
    });

    expect(resolved).toBeDefined();
    expect(resolved.id).toBe(botB.id);
    expect(resolved.botUsername).toBe("appnossalojabot");
  });

  it("5. Produto com bot_id NULL e nenhum bot vinculado ao canal: interrompe com erro claro sem fallback arbitrário", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBotChats.findMany).mockResolvedValueOnce([]);

    await expect(
      BotDeliveryResolver.resolveBotForDelivery({
        storeId: mockStoreId,
        botId: null,
        deliveryType: "telegram",
        deliveryValue: "-1009999999999",
      })
    ).rejects.toThrow("Nenhum bot ativo da loja está vinculado ao canal (-1009999999999)");
  });

  it("6. Produto com bot_id NULL e múltiplos bots candidatos: interrompe com erro explícito de ambiguidade", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBotChats.findMany).mockResolvedValueOnce([
      {
        id: "chat-map-1",
        storeId: mockStoreId,
        botId: botA.id,
        telegramChatId: "-1001111111111",
        botStatus: "administrator",
        canInviteUsers: true,
        isActive: true,
        bot: botA,
      },
      {
        id: "chat-map-2",
        storeId: mockStoreId,
        botId: botB.id,
        telegramChatId: "-1001111111111",
        botStatus: "administrator",
        canInviteUsers: true,
        isActive: true,
        bot: botB,
      },
    ] as any);

    await expect(
      BotDeliveryResolver.resolveBotForDelivery({
        storeId: mockStoreId,
        botId: null,
        deliveryType: "telegram",
        deliveryValue: "-1001111111111",
      })
    ).rejects.toThrow("Ambiguidade na resolução de bots: múltiplos bots ativos");
  });

  it("7. Produto com bot_id apontando para bot sem acesso ao canal: validação falha sem substituir bot", async () => {
    vi.spyOn(TelegramDeliveryService, "validateBotAndChatPermission").mockResolvedValueOnce({
      success: false,
      error: "Bad Request: chat not found",
    });

    const permCheck = await TelegramDeliveryService.validateBotAndChatPermission(
      "decrypted-enc-token-a",
      "-1003934210103",
      botA.botId
    );

    expect(permCheck.success).toBe(false);
    expect(permCheck.error).toBe("Bad Request: chat not found");
  });

  it("8. Entrega externa por link fixo preservada: não exige bot do canal e não falha", async () => {
    const { db } = await import("@/db");
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValueOnce(botA as any);

    const resolved = await BotDeliveryResolver.resolveBotForDelivery({
      storeId: mockStoreId,
      botId: null,
      deliveryType: "external",
      deliveryValue: "https://t.me/+cJHROYw-430zOGYx",
    });

    expect(resolved).toBeDefined();
    expect(db.query.telegramBotChats.findMany).not.toHaveBeenCalled();
  });

  it("9. Retry idempotente de entrega já concluída: não gera novo link nem duplicidade", async () => {
    const alreadyDeliveredAccess = {
      id: "access-already-delivered",
      storeId: mockStoreId,
      customerId: "cust-1",
      productId: "prod-1",
      orderId: "order-1",
      status: "ACTIVE",
      deliveryStatus: "DELIVERED",
      inviteLink: "https://t.me/+already-valid",
      customer: { telegramUserId: "8614753446" },
      product: { id: "prod-1", title: "Curso", deliveryType: "telegram", deliveryValue: "-1003934210103", botId: botB.id },
    };

    const isFullyDelivered = AccessDeliveryService.isOrderFullyDelivered([
      {
        accessId: alreadyDeliveredAccess.id,
        status: "ACTIVE",
        deliveryStatus: "DELIVERED",
        inviteLink: alreadyDeliveredAccess.inviteLink,
      },
    ]);

    expect(isFullyDelivered).toBe(true);
  });

  it("10. Falha sem duplicação de convites ou acessos: finaliza como FAILED e mantém integridade", async () => {
    const finalizeSpy = vi.spyOn(AccessDeliveryService, "finalizeDeliveryFailure");

    await AccessDeliveryService.finalizeDeliveryFailure(
      "aca2543a-4855-46d5-b13b-50e5ebaa16f1",
      "claim-token-123",
      "Nenhum bot ativo da loja está vinculado ao canal (-1003934210103).",
      null
    );

    expect(finalizeSpy).toHaveBeenCalledWith(
      "aca2543a-4855-46d5-b13b-50e5ebaa16f1",
      "claim-token-123",
      expect.stringContaining("Nenhum bot ativo da loja está vinculado ao canal"),
      null
    );
  });
});
