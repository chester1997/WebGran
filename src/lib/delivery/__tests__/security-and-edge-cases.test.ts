import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateInitData } from "@/lib/telegram/validation";
import { BotDeliveryResolver } from "@/lib/delivery/bot-delivery-resolver";
import { db } from "@/db";
import crypto from "crypto";

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

describe("Auditoria de Segurança — Telegram initData, Replay e Cross-Bot Attacks", () => {
  const botTokenA = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
  const botTokenB = "654321:XYZ-DEF1234ghIkl-zyx57W2v1u123ew22";

  function createSignedInitData(botToken: string, authDate: number, extraUser = { id: 999888, first_name: "John" }) {
    const urlParams = new URLSearchParams();
    urlParams.set("auth_date", authDate.toString());
    urlParams.set("query_id", "AAGD840SAgAA");
    urlParams.set("user", JSON.stringify(extraUser));

    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys.map((key) => `${key}=${urlParams.get(key)}`).join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    urlParams.set("hash", hash);
    return urlParams.toString();
  }

  it("1. Deve validar com sucesso um initData assinado legitimamente pelo Bot A", () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = createSignedInitData(botTokenA, now);

    const isValid = validateInitData(initData, botTokenA);
    expect(isValid).toBe(true);
  });

  it("2. Deve REJEITAR tentativa de sessão cruzada (initData gerado no Bot A tentando validar no Bot B)", () => {
    const now = Math.floor(Date.now() / 1000);
    const initDataFromBotA = createSignedInitData(botTokenA, now);

    // O atacante tenta usar o token do Bot B para validar
    const isValidOnBotB = validateInitData(initDataFromBotA, botTokenB);
    expect(isValidOnBotB).toBe(false);
  });

  it("3. Deve REJEITAR adulteração de dados do comprador (hash mismatch)", () => {
    const now = Math.floor(Date.now() / 1000);
    const validInitData = createSignedInitData(botTokenA, now);

    // Atacante altera o user id no initData mantendo o mesmo hash
    const tampered = validInitData.replace("999888", "111222");

    const isValid = validateInitData(tampered, botTokenA);
    expect(isValid).toBe(false);
  });

  it("4. Proteção contra REPLAY: Deve REJEITAR initData antigo com mais de 24h", () => {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 172800; // 48h atrás
    const expiredInitData = createSignedInitData(botTokenA, twoDaysAgo);

    const isValid = validateInitData(expiredInitData, botTokenA, { maxAgeSeconds: 86400 });
    expect(isValid).toBe(false);
  });

  it("5. Proteção contra Clock Skew futuro: Deve REJEITAR timestamp adulterado no futuro", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 3600; // 1h no futuro
    const futureInitData = createSignedInitData(botTokenA, farFuture);

    const isValid = validateInitData(futureInitData, botTokenA, { maxAgeSeconds: 86400 });
    expect(isValid).toBe(false);
  });
});

describe("Auditoria de Permissões Revogadas no Telegram e Checkout Web", () => {
  const storeId = "store-sec-1";
  const botA = { id: "bot-owner", username: "bot_owner", status: "active", storeId };
  const botB = { id: "bot-seller", username: "bot_seller", status: "active", storeId };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("6. Revalidação em tempo real: se o bot receptor teve canInviteUsers revogado, bloqueia venda e entrega", async () => {
    (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(botB);
    // Permissão revogada (canInviteUsers = false)
    (db.query.telegramBotChats.findFirst as any).mockResolvedValueOnce({
      id: "chat-map-revoked",
      storeId,
      botId: botB.id,
      telegramChatId: "-100999888777",
      botStatus: "member", // Perdeu status de admin
      canInviteUsers: false,
      isActive: true,
    });

    await expect(
      BotDeliveryResolver.resolveBotForDelivery({
        storeId,
        botId: botA.id,
        originBotId: botB.id,
        deliveryType: "telegram",
        deliveryValue: "-100999888777",
      })
    ).rejects.toThrow(/não possui permissão de administrador para convidar usuários.*Venda bloqueada sem fallback silencioso/i);
  });

  it("7. Checkout Web em Loja Geral: compra web sem originBotId resolve bot proprietário com link estático", async () => {
    (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(botA);

    const resolved = await BotDeliveryResolver.resolveBotForDelivery({
      storeId,
      botId: botA.id,
      originBotId: null, // Compra originada fora de bot (Loja Geral)
      deliveryType: "external",
      deliveryValue: "https://webgran.online/conteudo",
    });

    expect(resolved.id).toBe("bot-owner");
  });

  it("8. Isolamento Multi-Tenant: Tentativa de associar bot de Loja X a pedido de Loja Y é barrada", async () => {
    // db não encontra o bot porque a storeId não bate
    (db.query.telegramBots.findFirst as any).mockResolvedValueOnce(null);

    await expect(
      BotDeliveryResolver.resolveBotForDelivery({
        storeId: "loja-vitima",
        botId: "bot-atacante",
        originBotId: "bot-atacante",
        deliveryType: "telegram",
        deliveryValue: "-100111222333",
      })
    ).rejects.toThrow(/não encontrado ou não pertence a esta loja/i);
  });
});

