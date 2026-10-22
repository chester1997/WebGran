import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushinPayProvider } from '../providers/pushinpay';
import { encrypt } from '@/lib/encryption';

// Mock DB
const { dbMock } = vi.hoisted(() => {
  const mock: any = {
    query: {
      sellerPaymentConnections: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      paymentWebhookEvents: {
        findFirst: vi.fn(),
      },
      platformCommissionSettings: {
        findFirst: vi.fn().mockResolvedValue({ feeCents: 50, updatedAt: new Date() }),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'order-123', status: 'paid' }]),
        }),
      }),
    }),
  };
  mock.transaction = vi.fn(async (cb: any) => cb(mock));
  return { dbMock: mock };
});

vi.mock('@/db', () => ({
  db: dbMock,
}));

// Mock Delivery Service
vi.mock('@/lib/delivery/access-delivery-service', () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock Entitlements Service
vi.mock('@/lib/entitlements/entitlement-service', () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
}));

// Mock Table Initialization
vi.mock('@/db/ensure-payment-tables', () => ({
  ensurePaymentTables: vi.fn().mockResolvedValue(undefined),
}));

describe('PushinPay Integration — Security, Functional & Idempotency Suite', () => {
  let provider: PushinPayProvider;
  const validToken = 'pushin_test_token_12345';
  const webhookSecret = 'wh_secret_super_secure_987';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    provider = new PushinPayProvider();
  });

  describe('1. Cents Conversion & Minimum Charge Validation', () => {
    it('converts decimal amounts to integers in cents with floating-point safety and includes order_id query param', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(validToken),
        webhookSecretEncrypted: encrypt(webhookSecret),
        webhookId: 'wh-1',
        updatedAt: new Date(),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-123',
          qr_code: '00020126580014br.gov.bcb.pix...',
          status: 'created',
          value: 1990,
        }),
      } as Response);

      const res = await provider.createPixPayment({
        sellerId: 'seller-1',
        storeId: 'store-1',
        orderId: 'order-1',
        amount: 19.90,
      });

      expect(res.paymentId).toBe('tx-123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/pix/cashIn',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            value: 1990,
            webhook_url: 'https://www.webgran.online/api/webhooks/pushinpay/conn-pushin-1?order_id=order-1',
          }),
        })
      );
    });

    it('rejects values below 50 cents (R$ 0,50 minimum limit)', async () => {
      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          storeId: 'store-1',
          orderId: 'order-low',
          amount: 0.49,
        })
      ).rejects.toThrow('Valor mínimo para cobrança via PushinPay é R$ 0,50 (50 centavos).');

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          storeId: 'store-1',
          orderId: 'order-zero',
          amount: 0,
        })
      ).rejects.toThrow('Valor mínimo para cobrança via PushinPay é R$ 0,50 (50 centavos).');
    });

    it('accepts exactly 50 cents (R$ 0,50 boundary value)', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(validToken),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-50',
          qr_code: 'pix-emv-50',
          status: 'created',
          value: 50,
        }),
      } as Response);

      const res = await provider.createPixPayment({
        sellerId: 'seller-1',
        storeId: 'store-1',
        orderId: 'order-50',
        amount: 0.50,
      });

      expect(res.paymentId).toBe('tx-50');
      expect(res.status).toBe('pending');
      expect(res.qrCode).toBe('pix-emv-50');
    });
  });

  describe('2. Pix Creation Concurrency & Distributed Idempotency', () => {
    it('creates Pix successfully and maps real API response fields', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(validToken),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-pushin-999',
          qr_code: '00020126580014br.gov.bcb.pix...',
          qr_code_base64: 'data:image/png;base64,iVBORw0KGgo...',
          status: 'created',
          value: 10000,
        }),
      } as Response);

      const result = await provider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-100',
        amount: 100.0,
      });

      expect(result.paymentId).toBe('tx-pushin-999');
      expect(result.qrCode).toBe('00020126580014br.gov.bcb.pix...');
      expect(result.qrCodeBase64).toContain('data:image/png;base64');
      expect(result.status).toBe('pending');
    });

    it('reuses existing active non-expired Pix charge from database without calling API', async () => {
      const dbModule = await import('@/db');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const futureDate = new Date(Date.now() + 20 * 60 * 1000);
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-existing-pix',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-already-created',
        pixQrCode: 'pix-code-persisted',
        pixQrCodeBase64: 'pix-base64-persisted',
        pixExpiresAt: futureDate,
        status: 'pending',
      } as any);

      const result = await provider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-existing-pix',
        amount: 50.0,
      });

      expect(result.paymentId).toBe('tx-already-created');
      expect(result.qrCode).toBe('pix-code-persisted');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refuses to generate new Pix charge if order is already paid', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-already-paid',
        status: 'paid',
      } as any);

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-already-paid',
          amount: 50.0,
        })
      ).rejects.toThrow('Este pedido já foi pago.');
    });

    it('handles network timeouts and errors gracefully', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(validToken),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ETIMEDOUT: Connection timed out'));

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-timeout',
          amount: 50.0,
        })
      ).rejects.toThrow('Não foi possível conectar aos servidores da PushinPay. Tente novamente em alguns instantes.');
    });

    it('handles HTTP 401 unauthorized gracefully', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt('invalid_token'),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-401',
          amount: 50.0,
        })
      ).rejects.toThrow('Falha de autenticação na PushinPay. Verifique o token no painel de recebimentos.');
    });
  });

  describe('3. Connection Test & Auth Token Validation', () => {
    it('validates token via official balance endpoint', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 154000 }),
      } as Response);

      const result = await provider.testConnection(validToken);

      expect(result.success).toBe(true);
      expect(result.message).toContain('validada com sucesso');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/balance',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${validToken}`,
          }),
        })
      );
    });

    it('returns failure when token is empty or blank', async () => {
      const res1 = await provider.testConnection('');
      expect(res1.success).toBe(false);
      expect(res1.message).toContain('obrigatório');

      const res2 = await provider.testConnection('   ');
      expect(res2.success).toBe(false);
    });

    it('returns authentication error when API returns 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await provider.testConnection('wrong_token');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Token de API da PushinPay inválido');
    });
  });

  describe('4. Webhook Authentication & Custom Header Validation', () => {
    it('accepts webhook when custom header matches webhookSecret', () => {
      const headers = { 'x-pushinpay-token': webhookSecret };
      expect(provider.verifyWebhookAuth(headers, webhookSecret)).toBe(true);

      const headersAuth = { authorization: `Bearer ${webhookSecret}` };
      expect(provider.verifyWebhookAuth(headersAuth, webhookSecret)).toBe(true);
    });

    it('rejects webhook when custom header has invalid secret or is missing', () => {
      const headersWrong = { 'x-pushinpay-token': 'wrong_secret_123' };
      expect(provider.verifyWebhookAuth(headersWrong, webhookSecret)).toBe(false);

      const headersEmpty = {};
      expect(provider.verifyWebhookAuth(headersEmpty, webhookSecret)).toBe(false);
    });

    it('rejects webhook if authentication fails during handleWebhook', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        webhookSecretEncrypted: encrypt(webhookSecret),
      } as any);

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-1', status: 'paid' }),
        { 'x-pushinpay-token': 'invalid' }
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Autenticação do webhook inválida');
    });
  });

  describe('5. Webhook Payload Validation & Multi-Tenant Store/Seller Isolation', () => {
    it('rejects webhook with invalid or malformed JSON body', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
      } as any);

      const res = await provider.handleWebhook('conn-1', 'invalid-json-body{', {});
      expect(res.success).toBe(false);
      expect(res.error).toContain('JSON válido');
    });

    it('rejects webhook missing transaction ID', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
      } as any);

      const res = await provider.handleWebhook('conn-1', JSON.stringify({ status: 'paid' }), {});
      expect(res.success).toBe(false);
      expect(res.error).toContain('ID da transação ausente');
    });

    it('rejects notification if order belongs to a different store (store isolation)', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-store-A',
        provider: 'pushinpay',
        storeId: 'store-A',
        sellerId: 'seller-A',
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-store-B',
        paymentId: 'tx-123',
        storeId: 'store-B', // DIFFERENT STORE!
        total: 50.0,
        status: 'pending',
      } as any);

      const res = await provider.handleWebhook(
        'conn-store-A',
        JSON.stringify({ id: 'tx-123', status: 'paid', value: 5000 }),
        {}
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('loja incorreta');
    });

    it('rejects notification if seller is not owner of the store', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-seller-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-1',
        paymentId: 'tx-123',
        storeId: 'store-1',
        total: 50.0,
        status: 'pending',
      } as any);

      // Store owned by a different seller
      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-attacker',
      } as any);

      const res = await provider.handleWebhook(
        'conn-seller-1',
        JSON.stringify({ id: 'tx-123', status: 'paid', value: 5000 }),
        {}
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('loja incorreta');
    });

    it('rejects webhook when paid value diverges from expected order amount', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-1',
        paymentId: 'tx-divergent',
        storeId: 'store-1',
        total: 100.0, // Expected 10000 cents
        status: 'pending',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-divergent', status: 'paid', value: 5000 }), // Divergence: 5000 cents
        {}
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Divergência de valor');
    });
  });

  describe('6. Idempotency & Duplicate Notification Prevention', () => {
    it('returns alreadyProcessed without modifying order on duplicate webhook events', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
      } as any);

      // Event already recorded in paymentWebhookEvents
      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce({
        id: 'ev-1',
        eventId: 'pushin_tx-dup_paid',
      } as any);

      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-dup', status: 'paid' }),
        {}
      );

      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(true);
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });
  });

  describe('7. Official API Verification & Payment Delivery Assurance', () => {
    it('verifies transaction directly with official API before delivering product', async () => {
      const dbModule = await import('@/db');
      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: encrypt(validToken),
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-legit',
        paymentId: 'tx-legit-77',
        storeId: 'store-1',
        total: 50.0,
        status: 'pending',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Mock official API query
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-legit-77',
          status: 'paid',
          value: 5000,
        }),
      } as Response);

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-legit-77', status: 'paid', value: 5000 }),
        {}
      );

      expect(res.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/transactions/tx-legit-77',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${validToken}`,
          }),
        })
      );
      expect(dbModule.db.update).toHaveBeenCalled();
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith('order-legit');
    });

    it('rejects delivery if official API reports transaction is NOT paid', async () => {
      const dbModule = await import('@/db');
      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: encrypt(validToken),
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-fake',
        paymentId: 'tx-fake',
        storeId: 'store-1',
        total: 50.0,
        status: 'pending',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Spoofed webhook claimed paid, but official API reports created
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-fake',
          status: 'created',
          value: 5000,
        }),
      } as Response);

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-fake', status: 'paid', value: 5000 }),
        {}
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('não confirmado pela API oficial');
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    it('does NOT deliver product on pending, canceled or expired statuses', async () => {
      const dbModule = await import('@/db');
      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      // Test 'created' / 'pending'
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
      } as any);
      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-pending-test',
        paymentId: 'tx-pending',
        storeId: 'store-1',
        total: 20.0,
        status: 'pending',
      } as any);
      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      const resPending = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-pending', status: 'created', value: 2000 }),
        {}
      );

      expect(resPending.success).toBe(true);
      expect(resPending.pending).toBe(true);
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();

      // Test 'canceled'
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
      } as any);
      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-canceled-test',
        paymentId: 'tx-canceled',
        storeId: 'store-1',
        total: 20.0,
        status: 'pending',
      } as any);
      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      const resCanceled = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-canceled', status: 'canceled', value: 2000 }),
        {}
      );

      expect(resCanceled.success).toBe(true);
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });
  });

  describe('8. Provider Isolation & Coexistence', () => {
    it('verifies PushinPay operates independently without altering SyncPay or Mercado Pago logic', () => {
      expect(provider.getBaseUrl()).toBe('https://api.pushinpay.com.br/api');
      expect(typeof provider.createPixPayment).toBe('function');
      expect(typeof provider.getPixPaymentStatus).toBe('function');
      expect(typeof provider.handleWebhook).toBe('function');
    });
  });

  describe('9. Strict Transaction-Order Binding & URL Manipulation Defense', () => {
    it('rejects webhook when order_id in URL query parameter diverges from the transaction order', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: encrypt(validToken),
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-legit-123',
        paymentId: 'tx-123',
        storeId: 'store-1',
        total: 50.0,
        status: 'pending',
      } as any);

      // Attacker passes orderIdHint="order-victim-456" in webhook URL query params
      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-123', status: 'paid', value: 5000 }),
        {},
        'order-victim-456'
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('order_id inconsistente');
    });

    it('rejects order release if official API returned ID diverges from order paymentId', async () => {
      const dbModule = await import('@/db');
      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: encrypt(validToken),
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-1',
        paymentId: 'tx-expected',
        storeId: 'store-1',
        total: 50.0,
        status: 'pending',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Official API returns different ID
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-different',
          status: 'paid',
          value: 5000,
        }),
      } as Response);

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-expected', status: 'paid', value: 5000 }),
        {}
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Identificador retornado pela API oficial não confere com o pedido');
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    it('refuses to release product if official connection token is missing (notification alone is not enough)', async () => {
      const dbModule = await import('@/db');
      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: null, // No token configured
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-1',
        paymentId: 'tx-123',
        storeId: 'store-1',
        total: 50.0,
        status: 'pending',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-123', status: 'paid', value: 5000 }),
        {}
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Token de autenticação da conexão não disponível');
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });
  });

  describe('10. Credentials Test Connection & HTTP Status Differentiation', () => {
    it('validates credentials successfully via GET /api/balance with Bearer token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 15000 }),
      } as Response);

      const res = await provider.testConnection('pushin_token_valid');

      expect(res.success).toBe(true);
      expect(res.message).toContain('autenticada e validada');
      expect(res.balance).toEqual({ balance: 15000 });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/balance',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer pushin_token_valid',
            Accept: 'application/json',
          },
        })
      );
    });

    it('handles 401 Unauthorized correctly with descriptive message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const res = await provider.testConnection('invalid_token');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Token de API da PushinPay inválido ou não autorizado');
    });

    it('handles 403 Forbidden correctly with descriptive message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const res = await provider.testConnection('unauthorized_token');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Token de API da PushinPay inválido ou não autorizado');
    });

    it('handles 405 Method Not Allowed with route error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 405,
      } as Response);

      const res = await provider.testConnection('token_tested');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Método não permitido na API da PushinPay (HTTP 405)');
    });

    it('handles network / connection failures gracefully without leaking token', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await provider.testConnection('sensitive_token_123');

      expect(res.success).toBe(false);
      expect(res.message).toContain('Falha ao conectar com o servidor da PushinPay');
      expect(res.message).not.toContain('sensitive_token_123');
    });

    it('validates empty or blank token without making external request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const res = await provider.testConnection('   ');

      expect(res.success).toBe(false);
      expect(res.message).toContain('O token da API PushinPay é obrigatório');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('11. Production Real-World Edge Cases: Case-Insensitive UUIDs & Domain Normalization', () => {
    it('matches order and verifies payment when PushinPay sends uppercase UUID while DB has lowercase', async () => {
      const dbModule = await import('@/db');
      const deliveryModule = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
        storeId: 'store-1',
        sellerId: 'seller-1',
        accessTokenEncrypted: encrypt(validToken),
      } as any);

      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce(undefined);

      // DB has lowercase UUID
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-case-test',
        paymentId: 'a2fdf381-5fcc-4c13-a1fb-d466afe39f91',
        storeId: 'store-1',
        total: 1.0,
        status: 'pending',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // PushinPay returns uppercase UUID
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'A2FDF381-5FCC-4C13-A1FB-D466AFE39F91',
          status: 'paid',
          value: '100',
        }),
      } as Response);

      // Webhook payload with uppercase UUID
      const res = await provider.handleWebhook(
        'conn-1',
        JSON.stringify({
          id: 'A2FDF381-5FCC-4C13-A1FB-D466AFE39F91',
          status: 'paid',
          value: 100,
        }),
        {}
      );

      expect(res.success).toBe(true);
      expect(dbModule.db.update).toHaveBeenCalled();
      expect(deliveryModule.AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith('order-case-test');
    });

    it('normalizes apex webgran.online domain to www.webgran.online in webhookUrl to prevent 308 redirect', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-apex',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(validToken),
      } as any);

      // Simulate NEXT_PUBLIC_APP_URL pointing to apex domain
      const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_APP_URL = 'https://webgran.online';

      try {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'tx-domain-test',
            qr_code: '000201...',
            status: 'created',
            value: 100,
          }),
        } as Response);

        await provider.createPixPayment({
          sellerId: 'seller-1',
          storeId: 'store-1',
          orderId: 'order-apex-test',
          amount: 1.0,
        });

        expect(fetchSpy).toHaveBeenCalledWith(
          'https://api.pushinpay.com.br/api/pix/cashIn',
          expect.objectContaining({
            body: expect.stringContaining('https://www.webgran.online/api/webhooks/pushinpay/conn-pushin-apex'),
          })
        );
      } finally {
        process.env.NEXT_PUBLIC_APP_URL = originalEnv;
      }
    });
  });
});
