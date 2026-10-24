import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatNotificationBRL,
  buildSaleNotificationPayload,
  buildTestNotificationPayload,
  buildAccessDeliveredPayload,
  buildPaymentPendingPayload,
  buildPlatformCommissionPayload,
  standardizePushPayload,
  WEBGRAN_NOTIFICATION_BRAND,
} from "../notification-payload-builder";
import { SellerPushService } from "../seller-push-service";
import { PlatformFinancialNotificationService } from "../platform-financial-notification-service";
import webpush from "web-push";

// Mock do web-push
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue({ success: true }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      })),
    })),
    query: {
      sellerPushSubscriptions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      platformFinancialNotificationEvents: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

describe("WebGran — Padronização Global de Notificações para Todos os Usuários", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.VAPID_PUBLIC_KEY = "test-public-key";
    process.env.VAPID_PRIVATE_KEY = "test-private-key";
    process.env.VAPID_SUBJECT = "mailto:contato@webgran.online";
    SellerPushService._clearDispatchedSaleOrdersForTest();
  });

  describe("1. Construtor Centralizado e Identidade Visual WebGran", () => {
    it("formata valores monetários estritamente no padrão oficial brasileiro (BRL)", () => {
      expect(formatNotificationBRL(49.9)).toBe("R$ 49,90");
      expect(formatNotificationBRL("150.00")).toBe("R$ 150,00");
      expect(formatNotificationBRL(0.5)).toBe("R$ 0,50");
      expect(formatNotificationBRL(0)).toBe("R$ 0,00");
    });

    it("monta payload de venda com ícone, badge e dados padronizados", () => {
      const payload = buildSaleNotificationPayload({
        orderId: "ord-1",
        amount: 99.9,
        itemTitle: "Curso VIP",
        storeId: "store-1",
      });

      expect(payload.title).toBe("🛒 Nova venda no WebGran");
      expect(payload.body).toBe("Você recebeu R$ 99,90");
      expect(payload.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(payload.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
      expect(payload.url).toBe("/seller/financeiro");
      expect(payload.tag).toBe("sale-ord-1");
      expect(payload.data.type).toBe("SALE");
      expect(payload.data.amount).toBe(99.9);
    });

    it("monta payload de teste idêntico para vendedores e administradores", () => {
      const sellerPayload = buildTestNotificationPayload({ userName: "Vendedor João", role: "seller" });
      const adminPayload = buildTestNotificationPayload({ userName: "Admin Chefe", role: "admin" });

      expect(sellerPayload.title).toBe(adminPayload.title);
      expect(sellerPayload.body).toBe(adminPayload.body);
      expect(sellerPayload.icon).toBe(adminPayload.icon);
      expect(sellerPayload.badge).toBe(adminPayload.badge);
      expect(sellerPayload.url).toBe(adminPayload.url);
      expect(sellerPayload.tag).toBe(adminPayload.tag);
    });

    it("monta payload de acesso liberado no padrão visual WebGran", () => {
      const payload = buildAccessDeliveredPayload({
        orderId: "ord-deliv-1",
        itemTitle: "Mentoria",
        storeId: "store-1",
      });

      expect(payload.title).toBe("✨ Acesso liberado no WebGran");
      expect(payload.body).toContain("Mentoria");
      expect(payload.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(payload.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
      expect(payload.url).toBe("/seller/orders");
    });

    it("monta payload de pagamento pendente (Pix) no padrão visual WebGran", () => {
      const payload = buildPaymentPendingPayload({
        orderId: "ord-pix-1",
        amount: 35.5,
      });

      expect(payload.title).toBe("⏳ Pedido aguardando pagamento");
      expect(payload.body).toContain("R$ 35,50");
      expect(payload.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(payload.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
    });

    it("standardizePushPayload normaliza qualquer notificação parcial garantindo os padrões oficiais", () => {
      const normalized = standardizePushPayload({
        title: "Alerta Custom",
        body: "Mensagem personalizada",
      });

      expect(normalized.title).toBe("Alerta Custom");
      expect(normalized.body).toBe("Mensagem personalizada");
      expect(normalized.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(normalized.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
      expect(normalized.url).toBe("/seller/financeiro");
      expect(normalized.tag).toBe("general");
    });
  });

  describe("2. Separação de Modelo Visual e Autorização (Isolamento Multi-Tenant)", () => {
    it("vendedor A recebe exclusivamente notificações da sua própria loja e pedido", async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-store-a",
        storeId: "store-a",
        status: "paid",
        total: "120.00",
        items: [{ productId: "prod-a" }],
      });
      mockDb.query.stores.findFirst.mockResolvedValueOnce({
        id: "store-a",
        ownerId: "seller-user-a",
      });
      mockDb.query.products.findFirst.mockResolvedValueOnce({
        title: "Produto A",
      });
      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValueOnce([
        {
          id: "sub-a",
          userId: "seller-user-a",
          endpoint: "https://fcm.googleapis.com/fcm/send/sub-seller-a",
          p256dh: "key-a",
          auth: "auth-a",
          isActive: true,
        },
      ]);
      vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as any);

      const res = await SellerPushService.notifySellerOfSale("order-store-a");
      expect(res.success).toBe(true);
      expect(res.sentCount).toBe(1);

      // Garante que o push foi despachado para a inscrição do vendedor A
      const [subArg, payloadArg] = vi.mocked(webpush.sendNotification).mock.calls[0];
      expect(subArg.endpoint).toContain("sub-seller-a");
      const parsed = JSON.parse(payloadArg as string);
      expect(parsed.title).toBe("🛒 Nova venda no WebGran");
      expect(parsed.body).toBe("Você recebeu R$ 120,00");
      expect(parsed.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(parsed.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
      expect(parsed.data.storeId).toBe("store-a");
    });

    it("administrador recebe o mesmo padrão visual de notificação de venda quando for proprietário da loja", async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-store-admin",
        storeId: "store-admin",
        status: "paid",
        total: "200.00",
        items: [],
      });
      mockDb.query.stores.findFirst.mockResolvedValueOnce({
        id: "store-admin",
        ownerId: "admin-user-id",
      });
      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValueOnce([
        {
          id: "sub-admin",
          userId: "admin-user-id",
          endpoint: "https://fcm.googleapis.com/fcm/send/sub-admin",
          p256dh: "key-admin",
          auth: "auth-admin",
          isActive: true,
        },
      ]);
      vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as any);

      const res = await SellerPushService.notifySellerOfSale("order-store-admin");
      expect(res.success).toBe(true);

      const [, payloadArg] = vi.mocked(webpush.sendNotification).mock.calls[0];
      const parsed = JSON.parse(payloadArg as string);
      // Padrão visual idêntico ao do vendedor comum
      expect(parsed.title).toBe("🛒 Nova venda no WebGran");
      expect(parsed.body).toBe("Você recebeu R$ 200,00");
      expect(parsed.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(parsed.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
    });

    it("vendedor comum NUNCA recebe notificações financeiras de comissões da plataforma", async () => {
      process.env.PLATFORM_OWNER_USER_ID = "platform-owner-id";

      mockDb.query.sellerPushSubscriptions.findMany.mockImplementation(async ({ where }: any) => {
        return [
          {
            id: "sub-owner",
            userId: "platform-owner-id",
            endpoint: "https://fcm.googleapis.com/fcm/send/owner",
            p256dh: "key",
            auth: "auth",
            isActive: true,
          },
        ];
      });
      mockDb.query.platformFinancialNotificationEvents.findFirst.mockResolvedValueOnce(null);
      vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as any);

      const result = await PlatformFinancialNotificationService.notifyOwnerOfCommission({
        orderId: "ord-split-comm",
        eventType: "SPLIT_PROCESSED",
        platformFeeReais: "1.50",
      });

      expect(result.success).toBe(true);
      expect(result.ownerId).toBe("platform-owner-id");

      const [subArg, payloadArg] = vi.mocked(webpush.sendNotification).mock.calls[0];
      expect(subArg.endpoint).toContain("owner");
      const parsed = JSON.parse(payloadArg as string);
      expect(parsed.title).toBe("💰 Comissão WebGran");
      expect(parsed.body).toBe("Comissão de R$ 1,50 confirmada");
      expect(parsed.url).toBe("/admin/commission");
      // Padrão visual alinhado
      expect(parsed.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(parsed.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
    });
  });

  describe("3. Resiliência, Ausência de Inscrição e Idempotência", () => {
    it("usuário sem assinatura ativa não quebra o fluxo de negócio (retorna skipped com elegância)", async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-no-sub",
        storeId: "store-no-sub",
        status: "paid",
        total: "50.00",
      });
      mockDb.query.stores.findFirst.mockResolvedValueOnce({
        id: "store-no-sub",
        ownerId: "user-without-sub",
      });
      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValueOnce([]);

      const result = await SellerPushService.notifySellerOfSale("order-no-sub");
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain("no active push subscriptions");
      expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
    });

    it("não duplica notificações em webhooks repetidos ou retries em memória", async () => {
      mockDb.query.orders.findFirst.mockResolvedValue({
        id: "order-idemp",
        storeId: "store-idemp",
        status: "paid",
        total: "80.00",
      });
      mockDb.query.stores.findFirst.mockResolvedValue({
        id: "store-idemp",
        ownerId: "seller-idemp",
      });
      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValue([
        {
          id: "sub-1",
          userId: "seller-idemp",
          endpoint: "https://fcm.googleapis.com/fcm/send/idemp",
          p256dh: "key",
          auth: "auth",
          isActive: true,
        },
      ]);
      vi.mocked(webpush.sendNotification).mockResolvedValue({} as any);

      // Primeiro envio
      const res1 = await SellerPushService.notifySellerOfSale("order-idemp");
      expect(res1.success).toBe(true);
      expect(res1.sentCount).toBe(1);

      // Segundo envio repetido
      const res2 = await SellerPushService.notifySellerOfSale("order-idemp");
      expect(res2.success).toBe(true);
      expect(res2.skipped).toBe(true);
      expect(res2.reason).toContain("already sent");

      expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledTimes(1);
    });

    it("falha de conexão ao despachar push é tratada sem lançar exceções não tratadas", async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-fail",
        storeId: "store-fail",
        status: "paid",
        total: "10.00",
      });
      mockDb.query.stores.findFirst.mockResolvedValueOnce({
        id: "store-fail",
        ownerId: "seller-fail",
      });
      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValueOnce([
        {
          id: "sub-fail",
          userId: "seller-fail",
          endpoint: "https://fcm.googleapis.com/fcm/send/fail",
          p256dh: "key",
          auth: "auth",
          isActive: true,
        },
      ]);
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(new Error("Network timeout"));

      const result = await SellerPushService.notifySellerOfSale("order-fail");
      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(1);
    });
  });
});
