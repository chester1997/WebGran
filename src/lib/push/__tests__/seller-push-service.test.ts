import { describe, it, expect, vi, beforeEach } from "vitest";
import { SellerPushService } from "../seller-push-service";
import fs from "fs";
import path from "path";

// Mock do web-push
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      insert: vi.fn(),
      update: vi.fn(),
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
      },
    },
  };
});

vi.mock("@/db", () => ({
  db: mockDb,
}));

describe("WebGran Web Push Notifications Suite (Etapa 2)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("1. Registro e Gerenciamento de Assinaturas (Autenticado & Isolado)", () => {
    it("registra assinatura push com sucesso vinculada ao vendedor autenticado", async () => {
      const mockValues = vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue({ success: true }),
      });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const res = await SellerPushService.registerSubscription({
        userId: "seller-user-1",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-123",
        p256dh: "mock-p256dh-key",
        auth: "mock-auth-secret",
        userAgent: "Mozilla/5.0 Android Chrome",
      });

      expect(res.success).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("rejeita registro de assinatura com parâmetros obrigatórios ausentes", async () => {
      const res = await SellerPushService.registerSubscription({
        userId: "seller-user-1",
        endpoint: "",
        p256dh: "key",
        auth: "auth",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("inválidos");
    });

    it("desativa a assinatura do próprio vendedor com isolamento estrito de endpoint", async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const res = await SellerPushService.unsubscribe({
        userId: "seller-user-1",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-123",
      });

      expect(res.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("falha elegantemente ao tentar registrar quando a tabela ainda não foi migrada no banco", async () => {
      mockDb.insert.mockImplementation(() => {
        throw new Error('relation "seller_push_subscriptions" does not exist');
      });

      const res = await SellerPushService.registerSubscription({
        userId: "seller-user-1",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-999",
        p256dh: "key",
        auth: "auth",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("ainda não migrada");
    });
  });

  describe("2. Envio de Notificações Push & Tratamento de Assinaturas Expiradas (410/404)", () => {
    it("ignora envio com segurança se as chaves VAPID não estiverem configuradas", async () => {
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PUBLIC_KEY;

      const res = await SellerPushService.sendToSeller("seller-user-1", {
        title: "Teste",
        body: "Mensagem",
      });

      expect(res.success).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.reason).toContain("VAPID keys not configured");
    });

    it("ignora envio quando o vendedor não possui dispositivos com assinatura ativa", async () => {
      process.env.VAPID_PRIVATE_KEY = "mock-private-key";
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "mock-public-key";

      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValue([]);

      const res = await SellerPushService.sendToSeller("seller-user-1", {
        title: "Teste",
        body: "Mensagem",
      });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(res.totalSubscriptions).toBe(0);
    });

    it("desativa automaticamente assinatura expirada quando o push service retorna HTTP 410 Gone", async () => {
      process.env.VAPID_PRIVATE_KEY = "mock-private-key";
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "mock-public-key";

      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValue([
        {
          id: "sub-1",
          userId: "seller-user-1",
          endpoint: "https://fcm.googleapis.com/fcm/send/expired",
          p256dh: "key",
          auth: "auth",
          isActive: true,
        },
      ]);

      const webpush = (await import("web-push")).default;
      const error410: any = new Error("Subscription expired");
      error410.statusCode = 410;
      vi.mocked(webpush.sendNotification).mockRejectedValueOnce(error410);

      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const res = await SellerPushService.sendToSeller("seller-user-1", {
        title: "Teste",
        body: "Mensagem",
      });

      expect(res.failedCount).toBe(1);
      expect(res.deactivatedCount).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("3. Integração com Evento Real de Venda Confirmada (notifySellerOfSale)", () => {
    it("não envia push se o pedido estiver com status diferente de 'paid'", async () => {
      mockDb.query.orders.findFirst.mockResolvedValue({
        id: "order-pending",
        status: "pending",
      });

      const res = await SellerPushService.notifySellerOfSale("order-pending");
      expect(res.success).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.reason).toContain("not paid");
    });

    it("resolve a loja e o vendedor correto e envia push seguro sem expor dados sensíveis", async () => {
      process.env.VAPID_PRIVATE_KEY = "mock-private-key";
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "mock-public-key";

      mockDb.query.orders.findFirst.mockResolvedValue({
        id: "order-paid-123",
        status: "paid",
        storeId: "store-456",
        total: "150.00",
        items: [{ productId: "prod-789" }],
      });

      mockDb.query.stores.findFirst.mockResolvedValue({
        id: "store-456",
        ownerId: "seller-owner-999",
      });

      mockDb.query.products.findFirst.mockResolvedValue({
        id: "prod-789",
        title: "Curso Avançado de Robótica",
      });

      mockDb.query.sellerPushSubscriptions.findMany.mockResolvedValue([
        {
          id: "sub-phone",
          userId: "seller-owner-999",
          endpoint: "https://push.example.com/phone",
          p256dh: "key-phone",
          auth: "auth-phone",
          isActive: true,
        },
      ]);

      const webpush = (await import("web-push")).default;
      vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as any);

      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update.mockReturnValue({ set: mockSet });

      const res = await SellerPushService.notifySellerOfSale("order-paid-123");

      expect(res.success).toBe(true);
      expect(res.sentCount).toBe(1);

      // Garante que o payload enviado para o webpush é seguro
      const [subArg, payloadArg] = vi.mocked(webpush.sendNotification).mock.calls[0];
      const parsedPayload = JSON.parse(payloadArg as string);

      expect(parsedPayload.title).toBe("🎉 Nova Venda Confirmada!");
      expect(parsedPayload.body).toContain("Curso Avançado de Robótica");
      expect(parsedPayload.url).toBe("/seller/financeiro");
      expect(parsedPayload.tag).toBe("sale-order-paid-123");
      // Nunca expõe senhas ou tokens
      expect(payloadArg).not.toContain("password");
      expect(payloadArg).not.toContain("token");
    });

    it("falha no serviço de push não interrompe a confirmação da venda", async () => {
      mockDb.query.orders.findFirst.mockRejectedValueOnce(new Error("Database timeout"));

      const res = await SellerPushService.notifySellerOfSale("order-crash");
      expect(res.success).toBe(false);
      expect(res.skipped).toBe(true);
      // Não lança exceção não tratada
    });
  });

  describe("4. Service Worker Push & Notification Click Handlers", () => {
    const swPath = path.join(process.cwd(), "public", "sw.js");

    it("service worker contém listeners de 'push' e 'notificationclick'", () => {
      const swCode = fs.readFileSync(swPath, "utf8");

      expect(swCode).toContain("self.addEventListener('push'");
      expect(swCode).toContain("self.registration.showNotification");
      expect(swCode).toContain("self.addEventListener('notificationclick'");
      expect(swCode).toContain("event.notification.close()");
    });

    it("reutiliza janelas abertas ou abre nova rota protegida ao clicar na notificação", () => {
      const swCode = fs.readFileSync(swPath, "utf8");

      expect(swCode).toContain("clients.matchAll");
      expect(swCode).toContain("client.focus()");
      expect(swCode).toContain("clients.openWindow");
      expect(swCode).toContain("/seller/financeiro");
    });

    it("preserva as barreiras de segurança PWA existentes sem cache de rotas privadas ou de pagamentos", () => {
      const swCode = fs.readFileSync(swPath, "utf8");

      expect(swCode).toContain("url.pathname.startsWith('/api/')");
      expect(swCode).toContain("url.pathname.startsWith('/seller')");
      expect(swCode).toContain("url.pathname.includes('/checkout')");
    });
  });
});
