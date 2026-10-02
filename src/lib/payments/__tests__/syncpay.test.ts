import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SyncPayProvider, SyncPayAuthService } from '../providers/syncpay';
import { syncPayReconciliationService } from '../syncpay-reconciliation-service';
import { encrypt } from '@/lib/encryption';

// Mock DB
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
        findMany: vi.fn(),
      },
      paymentWebhookEvents: {
        findFirst: vi.fn(),
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
  },
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

describe('SyncPay Integration Audit — Comprehensive Security & Functional Suite', () => {
  let provider: SyncPayProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    provider = new SyncPayProvider();
  });

  describe('1. SyncPayAuthService — Server-Side Token Caching & Auth', () => {
    it('fetches new bearer token via POST /auth-token when cache is empty', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token_sync_abc123', expires_in: 3600 }),
      } as Response);

      const token = await SyncPayAuthService.getAccessToken('client_1', 'secret_1', true);
      expect(token).toBe('token_sync_abc123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.syncpayments.com.br/api/partner/v1/auth-token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ client_id: 'client_1', client_secret: 'secret_1' }),
        })
      );
    });

    it('reuses cached token without calling API repeatedly', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token_cached_xyz', expires_in: 3600 }),
      } as Response);

      const t1 = await SyncPayAuthService.getAccessToken('client_reuse', 'secret_reuse', true);
      expect(t1).toBe('token_cached_xyz');

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockClear();

      const t2 = await SyncPayAuthService.getAccessToken('client_reuse', 'secret_reuse');
      expect(t2).toBe('token_cached_xyz');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('forces fresh token fetch on 401 response or explicit refresh', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh_token_after_401', expires_in: 3600 }),
      } as Response);

      SyncPayAuthService.invalidateCache('client_reuse', 'secret_reuse');
      const token = await SyncPayAuthService.getAccessToken('client_reuse', 'secret_reuse', true);
      expect(token).toBe('fresh_token_after_401');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Connection & Credential Encryption Isolation', () => {
    it('validates connection server-side via testConnection without exposing secrets', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'valid_token', expires_in: 3600 }),
      } as Response);

      const res = await provider.testConnection('client_test', 'secret_test');
      expect(res.success).toBe(true);
      expect(res.message).toContain('validada com sucesso');
      expect(res.message).not.toContain('secret_test');
    });

    it('returns error when testing with empty credentials', async () => {
      const res = await provider.testConnection('', '');
      expect(res.success).toBe(false);
      expect(res.message).toContain('obrigatórios');
    });
  });

  describe('3. PIX Creation (POST /cash-in)', () => {
    it('rejects PIX creation if amount is less than minimum R$ 1,00', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_1'),
        refreshTokenEncrypted: encrypt('secret_1'),
        status: 'active',
      } as any);

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-1',
          amount: 0.5,
        })
      ).rejects.toThrow('mínimo');
    });

    it('creates PIX cash-in charge successfully with valid payload', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_1'),
        refreshTokenEncrypted: encrypt('secret_1'),
        status: 'active',
      } as any);

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-100',
        status: 'pending',
      } as any);

      vi.spyOn(SyncPayAuthService, 'getAccessToken').mockResolvedValue('mock_access_token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reference_id: 'sync_ref_999',
          pix_code: '00020126580014BR.GOV.BCB.PIX...',
        }),
      } as Response);

      const res = await provider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-100',
        amount: 49.9,
        customer: { name: 'João Silva', email: 'joao@email.com' },
      });

      expect(res.paymentId).toBe('sync_ref_999');
      expect(res.status).toBe('pending');
      expect(res.qrCode).toContain('BR.GOV.BCB.PIX');
    });

    it('rejects PIX creation when payment_gateways_enabled entitlement is disabled', async () => {
      const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
      vi.mocked(hasFeature).mockResolvedValueOnce(false);

      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_1'),
        refreshTokenEncrypted: encrypt('secret_1'),
        status: 'active',
      } as any);

      await expect(
        provider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-2',
          amount: 50.0,
        })
      ).rejects.toThrow('plano atual da loja não permite');
    });
  });

  describe('4. Webhook Verification, HMAC-SHA256 & Replay Protection', () => {
    const secret = 'webhook_secret_key_321';

    it('validates HMAC-SHA256 signature correctly with matching secret and raw body', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ event: 'transaction.updated', event_id: 'evt_1' });
      const signedPayload = `${timestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

      const header = `t=${timestamp},v1=${signature}`;
      const res = provider.verifyWebhookSignature(rawBody, header, secret);
      expect(res.isValid).toBe(true);
    });

    it('rejects webhook if signature header is missing or corrupted', () => {
      const res = provider.verifyWebhookSignature('{}', null, secret);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('ausente');
    });

    it('rejects webhook if timestamp is older than 300 seconds (Replay Attack)', () => {
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 400 sec old
      const rawBody = '{}';
      const signedPayload = `${oldTimestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

      const header = `t=${oldTimestamp},v1=${signature}`;
      const res = provider.verifyWebhookSignature(rawBody, header, secret);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Replay Attack');
    });

    it('ignores duplicate event_id idempotently', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue({
        id: 'existing-evt',
        eventId: 'evt_duplicate_123',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ event_id: 'evt_duplicate_123', event: 'transaction.updated' });
      const signedPayload = `${timestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(true);
    });

    it('NEVER marks order as paid on transaction.created event even if status is completed', async () => {
      const { isSyncPayPaymentConfirmed } = await import('../providers/syncpay');
      expect(isSyncPayPaymentConfirmed('transaction.created', 'completed')).toBe(false);
      expect(isSyncPayPaymentConfirmed('transaction.created', 'paid')).toBe(false);

      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue(null as any);

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-created-111',
        storeId: 'store-1',
        status: 'pending',
        paymentId: 'sync_tx_created',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_created_001',
        event: 'transaction.created',
        data: {
          reference_id: 'sync_tx_created',
          status: 'completed',
        },
      });

      const signedPayload = `${timestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(res.pending).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    it('processes valid paid webhook and triggers AccessDeliveryService atomically', async () => {
      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue(null as any);

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-pay-999',
        storeId: 'store-1',
        status: 'pending',
        paymentId: 'sync_tx_888',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_new_100',
        event: 'transaction.updated',
        data: {
          reference_id: 'sync_tx_888',
          status: 'completed',
        },
      });

      const signedPayload = `${timestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith('order-pay-999');
    });
  });

  describe('5. Refund & Multi-Tenancy Security', () => {
    it('prevents Seller A from executing refund on Seller B order', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-seller-a',
        sellerId: 'seller-a',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_a'),
        refreshTokenEncrypted: encrypt('secret_a'),
      } as any);

      // Order belongs to seller-b (different payment connection lookup)
      vi.mocked(db.query.orders.findFirst).mockResolvedValue(null as any);

      await expect(provider.refundPayment('seller-a', 'order-belonging-to-b')).rejects.toThrow('não encontrado');
    });

    it('executes refund successfully for legitimate seller order', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-seller-a',
        sellerId: 'seller-a',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_a'),
        refreshTokenEncrypted: encrypt('secret_a'),
      } as any);

      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-paid-1',
        status: 'paid',
        paymentId: 'sync_refund_tx',
      } as any);

      vi.spyOn(SyncPayAuthService, 'getAccessToken').mockResolvedValue('mock_token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'refunded' }),
      } as Response);

      const res = await provider.refundPayment('seller-a', 'order-paid-1');
      expect(res.success).toBe(true);
      expect(res.message).toContain('sucesso');
    });
  });

  describe('6. SyncPayReconciliationService', () => {
    it('reconciles pending orders server-side with SyncPay transaction status', async () => {
      const { db } = await import('@/db');
      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_1'),
        refreshTokenEncrypted: encrypt('secret_1'),
      } as any);

      vi.mocked(db.query.orders.findMany).mockResolvedValue([
        { id: 'pending-ord-1', paymentId: 'sync_tx_reconcile', status: 'pending' },
      ] as any);

      vi.spyOn(SyncPayAuthService, 'getAccessToken').mockResolvedValue('mock_token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reference_id: 'sync_tx_reconcile',
          status: 'completed',
        }),
      } as Response);

      const res = await syncPayReconciliationService.reconcilePendingOrders('seller-1');
      expect(res.checked).toBe(1);
      expect(res.updated).toBe(1);
    });
  });
});
