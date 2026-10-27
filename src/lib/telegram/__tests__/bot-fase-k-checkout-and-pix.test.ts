import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      combos: { findFirst: vi.fn(), findMany: vi.fn() },
      products: { findFirst: vi.fn(), findMany: vi.fn() },
      carts: { findFirst: vi.fn() },
      cartItems: { findFirst: vi.fn(), findMany: vi.fn() },
      telegramCustomers: { findFirst: vi.fn() },
      orders: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

import { formatCartMessage, handleCartCallbackQuery, BotCartContext } from "../bot-cart-handler";
import { CartService, CartDTO } from "@/lib/cart/cart-service";
import { CheckoutService } from "@/lib/orders/checkout-service";
import { TelegramBotService } from "../bot";

vi.mock("@/lib/cart/cart-service", () => ({
  CartService: {
    getCartByTelegramUser: vi.fn(),
    clearCartByTelegramUser: vi.fn(),
    getOrCreateCustomer: vi.fn(),
    getOrCreateCustomerForTelegramUser: vi.fn(),
    addItemByTelegramUser: vi.fn(),
    removeItemByTelegramUser: vi.fn(),
  },
}));

vi.mock("@/lib/orders/checkout-service", () => ({
  CheckoutService: {
    createCheckout: vi.fn(),
  },
}));

vi.mock("@/lib/payments/order-sync", () => ({
  syncOrderWithMercadoPago: vi.fn(),
}));

vi.mock("@/lib/delivery/access-delivery-service", () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn(),
  },
}));

describe("WebGran — Fase K: Checkout, Carrinho e Pix no Telegram", () => {
  let mockBotService: any;
  let mockContext: BotCartContext;

  const mockTelegramUser = {
    id: 123456789,
    first_name: "Cliente",
    last_name: "Teste",
    username: "cliente_teste",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBotService = {
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue({ message_id: 999 }),
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 1000 }),
      editMessageText: vi.fn().mockResolvedValue(true),
    };

    mockContext = {
      store: {
        id: "store-k-test",
        name: "Loja Teste Fase K",
        slug: "loja-teste-k",
        supportType: "telegram",
        supportValue: "@suportek",
      },
      botService: mockBotService as unknown as TelegramBotService,
      miniAppUrl: "https://webgran.test/miniapp/loja-teste-k",
    };
  });

  describe("1. Botão Finalizar Compra no Telegram", () => {
    it("deve conter o botão '💳 Finalizar compra' quando o carrinho possuir itens", () => {
      const filledCart: CartDTO = {
        id: "cart-1",
        storeId: "store-k-test",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "pack-vip",
            title: "Pack VIP",
            price: 15.0,
            quantity: 1,
            coverUrl: null,
            storeId: "store-k-test",
            isCombo: false,
            comboId: null,
            productId: "prod-1",
          },
        ],
        subtotal: 15.0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 15.0,
        itemCount: 1,
      };

      const { replyMarkup } = formatCartMessage(filledCart, mockContext.miniAppUrl);
      const rows = replyMarkup.inline_keyboard;

      // Primeiro botão de ação deve ser '💳 Finalizar compra'
      const checkoutBtn = rows[1][0];
      expect(checkoutBtn.text).toBe("💳 Finalizar compra");
      expect(checkoutBtn.callback_data).toBe("cart_checkout");

      // Deve preservar o botão do Mini App na linha seguinte
      const miniAppBtn = rows[2][0];
      expect(miniAppBtn.text).toBe("🛍️ Abrir Carrinho no Mini App");
      expect(miniAppBtn.web_app.url).toBe("https://webgran.test/miniapp/loja-teste-k/cart");
    });

    it("NÃO deve conter o botão '💳 Finalizar compra' quando o carrinho estiver vazio", () => {
      const emptyCart: CartDTO = {
        id: "cart-empty",
        storeId: "store-k-test",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 0,
        itemCount: 0,
      };

      const { replyMarkup } = formatCartMessage(emptyCart, mockContext.miniAppUrl);
      const allButtons = replyMarkup.inline_keyboard.flat();

      const hasCheckoutBtn = allButtons.some((b: any) => b.callback_data === "cart_checkout");
      expect(hasCheckoutBtn).toBe(false);
    });
  });

  describe("2. Fluxo de Checkout Pix Direto no Telegram", () => {
    it("deve impedir criação de cobrança quando callback cart_checkout for acionado com carrinho vazio", async () => {
      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce({
        id: "cart-empty",
        storeId: "store-k-test",
        customerId: "cust-1",
        items: [],
        subtotal: 0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 0,
        itemCount: 0,
      });

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-empty",
        123456789,
        500,
        "cart_checkout",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(CheckoutService.createCheckout).not.toHaveBeenCalled();
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-empty",
        "⚠️ Seu carrinho está vazio.",
        true
      );
    });

    it("deve criar cobrança Pix, enviar QR Code e código copia e cola no chat, e esvaziar carrinho", async () => {
      const mockCart: CartDTO = {
        id: "cart-active",
        storeId: "store-k-test",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "video-pack",
            title: "Vídeo Pack Exclusivo",
            price: 25.0,
            quantity: 1,
            coverUrl: null,
            storeId: "store-k-test",
            isCombo: false,
            comboId: null,
            productId: "prod-1",
          },
        ],
        subtotal: 25.0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 25.0,
        itemCount: 1,
      };

      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce(mockCart);
      vi.mocked(CartService.getOrCreateCustomerForTelegramUser).mockResolvedValueOnce({
        id: "cust-1",
        storeId: "store-k-test",
        telegramUserId: "123456789",
      } as any);

      vi.mocked(CheckoutService.createCheckout).mockResolvedValueOnce({
        success: true,
        orderId: "order-abc-123",
        total: 25.0,
        paymentGateway: "pushinpay",
        pix: {
          qrCode: "000201265802BR.GOV.BCB.PIX0114+551199999999520400005303986540525.005802BR5913Loja Teste6008Brasilia62070503***6304ABCD",
          qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      });

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-checkout-ok",
        123456789,
        500,
        "cart_checkout",
        mockTelegramUser
      );

      expect(handled).toBe(true);

      // Valida chamada ao CheckoutService com itens reais
      expect(CheckoutService.createCheckout).toHaveBeenCalledWith({
        storeId: "store-k-test",
        customerId: "cust-1",
        storeSlug: "loja-teste-k",
        items: [
          {
            id: "prod-1",
            quantity: 1,
            isCombo: false,
            comboId: null,
          },
        ],
      });

      // Valida esvaziamento do carrinho
      expect(CartService.clearCartByTelegramUser).toHaveBeenCalledWith("store-k-test", 123456789);

      // Valida envio da imagem do QR Code
      expect(mockBotService.sendPhoto).toHaveBeenCalledTimes(1);
      const [chatId, photoUrl, caption, replyMarkup] = mockBotService.sendPhoto.mock.calls[0];

      expect(chatId).toBe(123456789);
      expect(photoUrl).toContain("/api/telegram/order-qr/order-abc-123");
      expect(caption).toContain("R$ 25,00");
      expect(caption).toContain("`000201265802BR.GOV.BCB.PIX0114"); // Monospace fácil de copiar com 1 toque
      expect(caption).toContain("Aguardando confirmação do banco");

      // Valida botões na mensagem do Pix
      const pixButtons = replyMarkup.inline_keyboard;
      expect(pixButtons[0][0].text).toBe("🔄 Verificar Pagamento");
      expect(pixButtons[0][0].callback_data).toBe("check_pay:order-abc-123");
    });

    it("deve fazer fallback para sendMessage se sendPhoto falhar", async () => {
      const mockCart: CartDTO = {
        id: "cart-active",
        storeId: "store-k-test",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "item",
            title: "Item Teste",
            price: 10.0,
            quantity: 1,
            coverUrl: null,
            storeId: "store-k-test",
            isCombo: false,
            comboId: null,
            productId: "prod-1",
          },
        ],
        subtotal: 10.0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 10.0,
        itemCount: 1,
      };

      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce(mockCart);
      vi.mocked(CartService.getOrCreateCustomerForTelegramUser).mockResolvedValueOnce({ id: "cust-1" } as any);
      vi.mocked(CheckoutService.createCheckout).mockResolvedValueOnce({
        success: true,
        orderId: "order-fallback-1",
        total: 10.0,
        pix: {
          qrCode: "pix-code-123",
          qrCodeBase64: "base64...",
          expiresAt: new Date().toISOString(),
        },
      });

      // Simula falha em sendPhoto
      mockBotService.sendPhoto.mockRejectedValueOnce(new Error("Telegram API sendPhoto network error"));

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-fallback",
        123456789,
        500,
        "cart_checkout",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.sendPhoto).toHaveBeenCalledTimes(1);
      expect(mockBotService.sendMessage).toHaveBeenCalledTimes(1);
      const [targetChat, msgText] = mockBotService.sendMessage.mock.calls[0];
      expect(targetChat).toBe(123456789);
      expect(msgText).toContain("`pix-code-123`");
    });

    it("deve tratar falha na criação de cobrança informando o usuário com mensagem amigável", async () => {
      const mockCart: CartDTO = {
        id: "cart-active",
        storeId: "store-k-test",
        customerId: "cust-1",
        items: [
          {
            id: "prod-1",
            slug: "item",
            title: "Item Teste",
            price: 10.0,
            quantity: 1,
            coverUrl: null,
            storeId: "store-k-test",
            isCombo: false,
            comboId: null,
            productId: "prod-1",
          },
        ],
        subtotal: 10.0,
        progressiveDiscount: 0,
        progressivePromotion: null,
        total: 10.0,
        itemCount: 1,
      };

      vi.mocked(CartService.getCartByTelegramUser).mockResolvedValueOnce(mockCart);
      vi.mocked(CartService.getOrCreateCustomerForTelegramUser).mockResolvedValueOnce({ id: "cust-1" } as any);
      vi.mocked(CheckoutService.createCheckout).mockResolvedValueOnce({
        success: false,
        error: "Esta loja não possui nenhum meio de pagamento ativo configurado.",
      });

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-err",
        123456789,
        500,
        "cart_checkout",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-err",
        "⚠️ Esta loja não possui nenhum meio de pagamento ativo configurado.",
        true
      );
      expect(CartService.clearCartByTelegramUser).not.toHaveBeenCalled();
    });
  });

  describe("3. Verificação de Pagamento e Liberação Segura", () => {
    it("deve informar que o pagamento está pendente quando o gateway ainda não confirmou", async () => {
      const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
      vi.mocked(syncOrderWithMercadoPago).mockResolvedValueOnce({
        success: true,
        status: "pending",
      } as any);

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-check-pending",
        123456789,
        500,
        "check_pay:order-123",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-check-pending",
        "⏳ Pagamento ainda não identificado. Aguarde alguns instantes e tente novamente.",
        true
      );
    });

    it("deve liberar os produtos e atualizar a mensagem para 'Pagamento Confirmado' quando confirmado pelo servidor", async () => {
      const { syncOrderWithMercadoPago } = await import("@/lib/payments/order-sync");
      const { AccessDeliveryService } = await import("@/lib/delivery/access-delivery-service");

      vi.mocked(syncOrderWithMercadoPago).mockResolvedValueOnce({
        success: true,
        status: "paid",
      } as any);

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-check-paid",
        123456789,
        500,
        "check_pay:order-paid-999",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith("order-paid-999");
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith(
        "cb-check-paid",
        "🎉 Pagamento confirmado com sucesso!"
      );
      expect(mockBotService.editMessageText).toHaveBeenCalledTimes(1);
      const [, , text, replyMarkup] = mockBotService.editMessageText.mock.calls[0];
      expect(text).toContain("🎉 *Pagamento Confirmado!*");
      expect(replyMarkup.inline_keyboard[0][0].text).toBe("🔐 Meus Acessos");
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe("my_accesses");
    });
  });

  describe("4. Rota do QR Code Pix (/api/telegram/order-qr/[orderId])", () => {
    it("deve retornar 200 com a imagem PNG quando o pedido estiver pending e pix dentro da validade", async () => {
      const { GET } = await import("@/app/api/telegram/order-qr/[orderId]/route");

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-pending-valid",
        status: "pending",
        pixExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // expira em 15min
        pixQrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = new Request("http://localhost:3000/api/telegram/order-qr/order-pending-valid");
      const res = await GET(req as any, { params: Promise.resolve({ orderId: "order-pending-valid" }) });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate");
    });

    it("deve retornar 410 quando o pedido estiver com status diferente de pending (ex: paid)", async () => {
      const { GET } = await import("@/app/api/telegram/order-qr/[orderId]/route");

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-already-paid",
        status: "paid",
        pixExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        pixQrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = new Request("http://localhost:3000/api/telegram/order-qr/order-already-paid");
      const res = await GET(req as any, { params: Promise.resolve({ orderId: "order-already-paid" }) });

      expect(res.status).toBe(410);
      const text = await res.text();
      expect(text).toContain("QR Code is not available for order with status 'paid'");
    });

    it("deve retornar 410 quando o Pix estiver expirado", async () => {
      const { GET } = await import("@/app/api/telegram/order-qr/[orderId]/route");

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: "order-expired",
        status: "pending",
        pixExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // expirou há 5min
        pixQrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });

      const req = new Request("http://localhost:3000/api/telegram/order-qr/order-expired");
      const res = await GET(req as any, { params: Promise.resolve({ orderId: "order-expired" }) });

      expect(res.status).toBe(410);
      const text = await res.text();
      expect(text).toContain("QR Code has expired");
    });

    it("deve retornar 404 quando o pedido não existir", async () => {
      const { GET } = await import("@/app/api/telegram/order-qr/[orderId]/route");

      mockDb.query.orders.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost:3000/api/telegram/order-qr/non-existent");
      const res = await GET(req as any, { params: Promise.resolve({ orderId: "non-existent" }) });

      expect(res.status).toBe(404);
    });
  });

  describe("5. Navegação a partir da Mensagem de Pagamento Pix", () => {
    it("deve navegar para 'cart_cat' (Explorar Catálogo) e enviar nova mensagem se editMessageText falhar", async () => {
      // Mock de produtos para catálogo
      mockDb.query.products.findMany.mockResolvedValueOnce([
        {
          id: "prod-cat-1",
          storeId: "store-123",
          title: "Produto Catálogo 1",
          price: "15.00",
          status: "active",
        },
      ]);

      // Simula que a mensagem era uma foto (Pix QR Code) e editMessageText falha
      mockBotService.editMessageText.mockRejectedValueOnce(
        new Error("Telegram API: message to edit not found or is a photo caption")
      );

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-nav-cat",
        123456789,
        999, // ID da mensagem da foto do Pix
        "cart_cat",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-nav-cat");
      // Tentou editar primeiro
      expect(mockBotService.editMessageText).toHaveBeenCalledTimes(1);
      // Como falhou, fez fallback para sendMessage
      expect(mockBotService.sendMessage).toHaveBeenCalledTimes(1);
      const [chatId, text] = mockBotService.sendMessage.mock.calls[0];
      expect(chatId).toBe(123456789);
      expect(text).toContain("Catálogo de Produtos");
    });

    it("deve navegar para 'start_menu' (Menu Inicial) e enviar nova mensagem se editMessageText falhar", async () => {
      // Simula falha ao tentar editar mensagem de foto
      mockBotService.editMessageText.mockRejectedValueOnce(
        new Error("Telegram API: message can't be edited")
      );

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-nav-menu",
        123456789,
        999,
        "start_menu",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-nav-menu");
      expect(mockBotService.editMessageText).toHaveBeenCalledTimes(1);
      expect(mockBotService.sendMessage).toHaveBeenCalledTimes(1);
      const [chatId, text, replyMarkup] = mockBotService.sendMessage.mock.calls[0];
      expect(chatId).toBe(123456789);
      expect(text).toContain("Menu Inicial");
      expect(replyMarkup.inline_keyboard.length).toBeGreaterThan(0);
    });

    it("deve navegar para 'my_accesses' mesmo se mensagem for foto", async () => {
      mockDb.query.orders.findMany.mockResolvedValueOnce([]);

      mockBotService.editMessageText.mockRejectedValueOnce(
        new Error("Telegram API: cannot edit photo message")
      );

      const handled = await handleCartCallbackQuery(
        mockContext,
        "cb-nav-accesses",
        123456789,
        999,
        "my_accesses",
        mockTelegramUser
      );

      expect(handled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-nav-accesses");
      expect(mockBotService.sendMessage).toHaveBeenCalled();
    });

    it("deve ignorar callbacks duplicados via dedup mantendo clique legítimo", async () => {
      const { isDuplicateTelegramCallback } = await import("../update-dedup");
      
      // Primeiro clique
      const firstHandled = await handleCartCallbackQuery(
        mockContext,
        "cb-dedup-1",
        123456789,
        999,
        "start_menu",
        mockTelegramUser
      );
      expect(firstHandled).toBe(true);

      // Segundo clique com mesmo cbId deve ser deduped
      const secondHandled = await handleCartCallbackQuery(
        mockContext,
        "cb-dedup-1",
        123456789,
        999,
        "start_menu",
        mockTelegramUser
      );
      expect(secondHandled).toBe(true);
      expect(mockBotService.answerCallbackQuery).toHaveBeenCalledWith("cb-dedup-1");
    });
  });
});
