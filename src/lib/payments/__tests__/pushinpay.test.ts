import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PushinPayProvider } from '../providers/pushinpay';

vi.mock('@/db', () => ({
  db: {
    query: {
      sellerPaymentConnections: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'order-123', status: 'paid' }]),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/delivery/access-delivery-service', () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockResolvedValue([]),
  },
}));

describe('PushinPay Integration Audit — Comprehensive Security Suite', () => {
  let provider: PushinPayProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.PUSHINPAY_TOKEN;
    delete process.env.PUSHINPAY_ENV;
    provider = new PushinPayProvider();
  });

  describe('1. Amount to Centavos Conversion & Validation', () => {
    it('correctly converts R$ float amounts to integer centavos', () => {
      const centavos1 = Math.round(Number(9.90) * 100);
      expect(centavos1).toBe(990);

      const centavos2 = Math.round(Number(29.99) * 100);
      expect(centavos2).toBe(2999);

      const centavos3 = Math.round(Number(100.00) * 100);
      expect(centavos3).toBe(10000);
    });

    it('rejects webhook if received centavos differs from exact expected order total (lower or higher)', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-999',
        storeId: 'store-abc',
        status: 'pending',
        total: '9.90', // Expected 990 centavos
        paymentId: 'pp_tx_cheat',
      } as any);

      // Case 1: Lower amount (R$ 1.00 instead of R$ 9.90) -> REJECT
      const resLower = await provider.handleWebhook({
        id: 'pp_tx_cheat',
        status: 'paid',
        value: 100,
      });

      expect(resLower.success).toBe(false);
      expect(resLower.error).toContain('diverge do valor exato');

      // Case 2: Higher amount (R$ 10.00 instead of R$ 9.90) -> REJECT
      const resHigher = await provider.handleWebhook({
        id: 'pp_tx_cheat',
        status: 'paid',
        value: 1000,
      });

      expect(resHigher.success).toBe(false);
      expect(resHigher.error).toContain('diverge do valor exato');
    });
  });

  describe('2. Token Resolution & Server-Side Security', () => {
    it('returns null if no token is configured in DB or ENV', async () => {
      delete process.env.PUSHINPAY_TOKEN;
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue(undefined);

      const token = await provider.getPushinPayToken('seller-1');
      expect(token).toBeNull();
    });

    it('uses process.env.PUSHINPAY_TOKEN if set', async () => {
      process.env.PUSHINPAY_TOKEN = 'test_global_token_123';
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue(undefined);

      const token = await provider.getPushinPayToken('seller-1');
      expect(token).toBe('test_global_token_123');
    });
  });

  describe('3. PIX CashIn Creation API Call', () => {
    it('sends correct headers, body in centavos, and Idempotency-Key', async () => {
      process.env.PUSHINPAY_TOKEN = 'token_abc123';

      const mockResponse = {
        id: 'pp_tx_999',
        value: 990,
        status: 'created',
        qr_code: '00020126580014br.gov.bcb.pix...',
        qr_code_base64: 'data:image/png;base64,iVBORw0KGgo...',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await provider.createPixPayment({
        sellerId: 'seller-123',
        orderId: 'order-uuid-456',
        amount: 9.90,
        description: 'Test Product',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/pix/cashIn',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token_abc123',
            'Content-Type': 'application/json',
            'Idempotency-Key': 'webgran-order-order-uuid-456',
          }),
        })
      );

      expect(result.paymentId).toBe('pp_tx_999');
      expect(result.qrCode).toBe('00020126580014br.gov.bcb.pix...');
      expect(result.qrCodeBase64).toBe('data:image/png;base64,iVBORw0KGgo...');
      expect(result.status).toBe('pending');
    });

    it('throws descriptive error if PushinPay API fails', async () => {
      process.env.PUSHINPAY_TOKEN = 'invalid_token';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized Token',
      } as Response);

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-1',
          amount: 15.0,
        })
      ).rejects.toThrow('PushinPay API Erro (401)');
    });
  });

  describe('4. Webhook Processing & Multi-Tenant Isolation', () => {
    it('processes valid paid webhook and triggers AccessDeliveryService', async () => {
      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-123',
        storeId: 'store-abc',
        status: 'pending',
        total: '29.90',
        paymentId: 'pp_tx_999',
      } as any);

      const res = await provider.handleWebhook({
        id: 'pp_tx_999',
        status: 'paid',
        value: 2990,
      });

      expect(res.success).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith('order-123');
    });

    it('rejects webhook if order is not found or belongs to nonexistent transaction', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined);

      const res = await provider.handleWebhook({
        id: 'nonexistent_tx',
        status: 'paid',
        value: 1000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Ordem não encontrada');
    });
  });

  describe('5. Idempotency Guard & Atomic Race Condition Protection', () => {
    it('prevents duplicate delivery if order is ALREADY paid', async () => {
      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-123',
        storeId: 'store-abc',
        status: 'paid',
        total: '29.90',
        paymentId: 'pp_tx_999',
      } as any);

      const res = await provider.handleWebhook({
        id: 'pp_tx_999',
        status: 'paid',
        value: 2990,
      });

      expect(res.success).toBe(true);
      expect(res.alreadyPaid).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    it('handles concurrent atomic update failure when another request updates status first', async () => {
      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-concurrent',
        storeId: 'store-abc',
        status: 'pending',
        total: '10.00',
        paymentId: 'pp_tx_race',
      } as any);

      // Simulate atomic update returning 0 rows because another thread updated it first
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // 0 rows updated
          }),
        }),
      } as any);

      const res = await provider.handleWebhook({
        id: 'pp_tx_race',
        status: 'paid',
        value: 1000,
      });

      expect(res.success).toBe(true);
      expect(res.alreadyPaid).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });
  });

  describe('6. Server-Side Transaction Reconciliation', () => {
    it('queries PushinPay API server-side if token is available', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-123',
        storeId: 'store-abc',
        status: 'pending',
        total: '50.00',
        paymentId: 'pp_tx_recon',
      } as any);

      process.env.PUSHINPAY_TOKEN = 'valid_token_recon';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pp_tx_recon',
          status: 'paid',
          value: 5000,
        }),
      } as Response);

      const res = await provider.handleWebhook({
        id: 'pp_tx_recon',
        status: 'paid',
        value: 5000,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/transactions/pp_tx_recon',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid_token_recon',
          }),
        })
      );
      expect(res.success).toBe(true);
    });
  });

  describe('7. Connection Test Endpoint', () => {
    it('validates credential configuration locally without calling fictitious endpoints or creating charges', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const res = await provider.testConnection('valid_bearer_token_123456');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Credencial PushinPay armazenada com sucesso');
      expect(res.message).toContain('validação com a API ocorrerá ao criar o primeiro PIX');
    });

    it('rejects unpopulated or invalid token strings locally without network calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const resEmpty = await provider.testConnection('');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.message).toContain('não informado');

      const resShort = await provider.testConnection('short');
      expect(resShort.success).toBe(false);
      expect(resShort.message).toContain('inválido');
    });
  });

  describe('8. Sandbox vs Production Environment Switching & Isolation', () => {
    const originalEnv = process.env.PUSHINPAY_ENV;

    afterEach(() => {
      process.env.PUSHINPAY_ENV = originalEnv;
    });

    it('resolves sandbox URL https://api-sandbox.pushinpay.com.br/api when PUSHINPAY_ENV=sandbox', () => {
      process.env.PUSHINPAY_ENV = 'sandbox';
      expect(provider.getBaseUrl()).toBe('https://api-sandbox.pushinpay.com.br/api');
      expect(provider.getEnvironment()).toBe('sandbox');
    });

    it('resolves production URL https://api.pushinpay.com.br/api when PUSHINPAY_ENV=production or default', () => {
      process.env.PUSHINPAY_ENV = 'production';
      expect(provider.getBaseUrl()).toBe('https://api.pushinpay.com.br/api');
      expect(provider.getEnvironment()).toBe('production');

      delete process.env.PUSHINPAY_ENV;
      expect(provider.getBaseUrl()).toBe('https://api.pushinpay.com.br/api');
      expect(provider.getEnvironment()).toBe('production');
    });

    it('uses sandbox API endpoint when creating PIX in sandbox environment', async () => {
      process.env.PUSHINPAY_ENV = 'sandbox';
      process.env.PUSHINPAY_TOKEN = 'sandbox_secret_token_777';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pp_sandbox_tx_1',
          status: 'created',
          qr_code: 'sandbox_qr_code',
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: 'seller-sandbox',
        orderId: 'order-sandbox-123',
        amount: 10.0,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api-sandbox.pushinpay.com.br/api/pix/cashIn',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sandbox_secret_token_777',
          }),
        })
      );
    });

    it('ensures token is masked/never printed in error logs or responses', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.PUSHINPAY_ENV = 'sandbox';
      process.env.PUSHINPAY_TOKEN = 'super_secret_token_never_log';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Validation Error',
      } as Response);

      try {
        await provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-1',
          amount: 5.0,
        });
      } catch (err: any) {
        expect(err.message).not.toContain('super_secret_token_never_log');
      }

      for (const call of consoleErrorSpy.mock.calls) {
        for (const arg of call) {
          expect(String(arg)).not.toContain('super_secret_token_never_log');
        }
      }
    });
  });
});
