import { describe, it, expect, vi, beforeEach } from "vitest";
import { BotDeliveryResolver } from "../bot-delivery-resolver";
import { db } from "@/db";

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramBotChats: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

describe("Governança de Catálogo Multi-Bot e BotDeliveryResolver", () => {
  const storeId = "store-123";
  const botA = { id: "bot-a", username: "bot_a", status: "active", storeId };
  const botB = { id: "bot-b", username: "bot_b", status: "active", storeId };
  const inactiveBot = { id: "bot-inactive", username: "bot_in", status: "inactive", storeId };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Entrega por Link (Estática / Externa)", () => {
    it("deve entregar pelo Bot de Origem (bot receptor da compra) quando presente e ativo", async () => {
      (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(botB);

      const resolved = await BotDeliveryResolver.resolveBotForDelivery({
        storeId,
        botId: botA.id, // Bot proprietário
        originBotId: botB.id, // Bot onde comprou
        deliveryType: "external",
        deliveryValue: "https://t.me/+joinlink123",
      });

      expect(resolved.id).toBe("bot-b");
    });

    it("deve fazer fallback para o Bot Proprietário se não houver originBotId", async () => {
      (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(botA);

      const resolved = await BotDeliveryResolver.resolveBotForDelivery({
        storeId,
        botId: botA.id,
        deliveryType: "external",
        deliveryValue: "https://meuconteudo.com/link",
      });

      expect(resolved.id).toBe("bot-a");
    });
  });

  describe("2. Entrega por Liberação via Bot (Canal/Grupo Telegram)", () => {
    it("deve permitir entrega pelo bot de origem se ele for administrador com permissão de convite", async () => {
      (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(botB);
      (db.query.telegramBotChats.findFirst as any).mockResolvedValueOnce({
        id: "chat-map-1",
        storeId,
        botId: botB.id,
        telegramChatId: "-1001234567890",
        botStatus: "administrator",
        canInviteUsers: true,
        isActive: true,
      });

      const resolved = await BotDeliveryResolver.resolveBotForDelivery({
        storeId,
        botId: botA.id,
        originBotId: botB.id,
        deliveryType: "telegram",
        deliveryValue: "-1001234567890",
      });

      expect(resolved.id).toBe("bot-b");
    });

    it("STRICT: deve bloquear a venda e lançar erro claro se o bot de origem NÃO for admin no canal (sem fallback silencioso)", async () => {
      (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(botB);
      // Sem mapeamento de permissão para botB
      (db.query.telegramBotChats.findFirst as any).mockResolvedValueOnce(null);

      await expect(
        BotDeliveryResolver.resolveBotForDelivery({
          storeId,
          botId: botA.id,
          originBotId: botB.id,
          deliveryType: "telegram",
          deliveryValue: "-1001234567890",
        })
      ).rejects.toThrow(/não possui permissão de administrador para convidar usuários.*Venda bloqueada sem fallback silencioso/i);
    });

    it("deve bloquear entrega se o bot receptor estiver inativo", async () => {
      (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(inactiveBot);

      await expect(
        BotDeliveryResolver.resolveBotForDelivery({
          storeId,
          botId: botA.id,
          originBotId: inactiveBot.id,
          deliveryType: "telegram",
          deliveryValue: "-1001234567890",
        })
      ).rejects.toThrow(/está inativo nesta loja/i);
    });
  });

  describe("3. Isolamento Multi-Tenant e Segurança", () => {
    it("deve impedir o uso de bot que não pertence à loja da transação", async () => {
      (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(null);

      await expect(
        BotDeliveryResolver.resolveBotForDelivery({
          storeId: "loja-vitima",
          botId: "bot-outro-seller",
          originBotId: "bot-outro-seller",
          deliveryType: "telegram",
          deliveryValue: "-1001234567890",
        })
      ).rejects.toThrow(/não encontrado ou não pertence a esta loja/i);
    });
  });
});

