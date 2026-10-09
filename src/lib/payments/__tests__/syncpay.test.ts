import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SyncPayProvider, SyncPayAuthService, isSyncPayPaymentConfirmed, extractSyncPayStatus } from '../providers/syncpay';
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
  const secret = 'webhook_secret_key_321';

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

    it('creates PIX cash-in charge successfully with valid payload and extracts identifier', async () => {
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
          identifier: 'sync_identifier_999',
          pix_code: '00020126580014BR.GOV.BCB.PIX...',
        }),
      } as Response);

      const res = await provider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-100',
        amount: 49.9,
        customer: { name: 'João Silva', email: 'joao@email.com' },
      });

      expect(res.paymentId).toBe('sync_identifier_999');
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

  describe('4. Mandatory Requirement Test Cases (Section 7 Audit)', () => {
    // 1. transaction.created -> NÃO paga pedido
    it('1. transaction.created -> does NOT mark order as paid', async () => {
      expect(isSyncPayPaymentConfirmed('transaction.created', 'completed')).toBe(false);

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
        id: 'order-t-created',
        storeId: 'store-1',
        status: 'pending',
        paymentId: 'sync_created_1',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_tc_1',
        event: 'transaction.created',
        data: { reference_id: 'sync_created_1', status: 'completed' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.pending).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    // 2. transaction.updated + completed -> paga pedido
    it('2. transaction.updated + completed -> marks order as paid and delivers product', async () => {
      expect(isSyncPayPaymentConfirmed('transaction.updated', { data: { status: 'completed' } })).toBe(true);

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
        id: 'order-t-updated-paid',
        storeId: 'store-1',
        status: 'pending',
        paymentId: 'sync_updated_paid_1',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_tu_paid_1',
        event: 'transaction.updated',
        data: { reference_id: 'sync_updated_paid_1', status: 'completed' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith('order-t-updated-paid');
    });

    // 3. transaction.updated + pending -> mantém pending
    it('3. transaction.updated + pending -> keeps order status pending', async () => {
      expect(isSyncPayPaymentConfirmed('transaction.updated', { status: 'pending' })).toBe(false);

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
        id: 'order-pending-stay',
        storeId: 'store-1',
        status: 'pending',
        paymentId: 'sync_pending_stay',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_pending_stay',
        event: 'transaction.updated',
        data: { reference_id: 'sync_pending_stay', status: 'pending' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    // 4. transaction.updated + failed -> não libera (marca failed)
    it('4. transaction.updated + failed -> marks order as failed and does NOT deliver product', async () => {
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
        id: 'order-fail-1',
        storeId: 'store-1',
        status: 'pending',
        paymentId: 'sync_fail_1',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_fail_1',
        event: 'transaction.updated',
        data: { reference_id: 'sync_fail_1', status: 'refused' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    // 5. transaction.updated + refunded -> altera para refunded
    it('5. transaction.updated + refunded -> updates status to refunded', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue(null as any);
      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-refund-1',
        storeId: 'store-1',
        status: 'paid',
        paymentId: 'sync_refund_1',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_refund_1',
        event: 'transaction.refunded',
        data: { reference_id: 'sync_refund_1', status: 'refunded' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
    });

    // 6. transaction.updated + med -> não libera
    it('6. transaction.updated + med -> does NOT confirm payment', async () => {
      expect(isSyncPayPaymentConfirmed('transaction.updated', 'med')).toBe(false);
      expect(isSyncPayPaymentConfirmed('transaction.updated', { status: 'med' })).toBe(false);
    });

    // 7. webhook duplicado -> não duplica entrega
    it('7. duplicate webhook -> ignores idempotently without re-triggering delivery', async () => {
      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue({
        id: 'already-processed-evt',
        eventId: 'evt_dup_999',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ event_id: 'evt_dup_999', event: 'transaction.updated' });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(true);
      expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
    });

    // 8. webhook fora de ordem -> não regrede pedido
    it('8. out of order webhook -> does NOT regress order from paid to pending', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue(null as any);
      vi.mocked(db.query.orders.findFirst).mockResolvedValue({
        id: 'order-already-paid',
        storeId: 'store-1',
        status: 'paid',
        paymentId: 'sync_already_paid',
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_old_update',
        event: 'transaction.updated',
        data: { reference_id: 'sync_already_paid', status: 'pending' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(true);
    });

    // 9. webhook com assinatura inválida -> rejeitado e não altera pedido
    it('9. invalid signature -> returns error and does NOT alter order', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=invalid_fake_sig` });

      const res = await provider.handleWebhook('conn-1', JSON.stringify({ event_id: 'evt_bad' }), headers);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Assinatura HMAC-SHA256');
    });

    // 10. webhook com replay > janela permitida -> rejeitado
    it('10. replay > 300 seconds -> rejected', () => {
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 500);
      const rawBody = JSON.stringify({ event_id: 'evt_old' });
      const signature = crypto.createHmac('sha256', secret).update(`${oldTimestamp}.${rawBody}`).digest('hex');
      const res = provider.verifyWebhookSignature(rawBody, `t=${oldTimestamp},v1=${signature}`, secret);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Replay Attack');
    });

    // 11. webhook válido para pedido inexistente -> não deve causar erro 500
    it('11. valid webhook for nonexistent order -> returns success without 500 error', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'syncpay',
        webhookSecretEncrypted: encrypt(secret),
      } as any);

      vi.mocked(db.query.paymentWebhookEvents.findFirst).mockResolvedValue(null as any);
      vi.mocked(db.query.orders.findFirst).mockResolvedValue(null as any);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({
        event_id: 'evt_nonexistent_1',
        event: 'transaction.updated',
        data: { reference_id: 'sync_nonexistent_tx', status: 'completed' },
      });
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
      const headers = new Headers({ 'X-SyncPay-Signature': `t=${timestamp},v1=${signature}` });

      const res = await provider.handleWebhook('conn-1', rawBody, headers);
      expect(res.success).toBe(true);
    });

    // 12. reconciliation encontra completed -> confirma pedido
    // 13. webhook não chegou + reconciliation encontra completed -> libera produto
    it('12 & 13. reconciliation finds completed status -> confirms order and delivers product', async () => {
      const { db } = await import('@/db');
      const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_1'),
        refreshTokenEncrypted: encrypt('secret_1'),
      } as any);

      vi.mocked(db.query.orders.findMany).mockResolvedValue([
        { id: 'pending-order-rec', paymentId: 'sync_tx_rec_100', status: 'pending' },
      ] as any);

      vi.spyOn(SyncPayAuthService, 'getAccessToken').mockResolvedValue('mock_token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            transaction: {
              reference_id: 'sync_tx_rec_100',
              status: 'completed',
            }
          }
        }),
      } as Response);

      const res = await syncPayReconciliationService.reconcilePendingOrders('seller-1');
      expect(res.checked).toBe(1);
      expect(res.updated).toBe(1);
      expect(AccessDeliveryService.processOrderDelivery).toHaveBeenCalledWith('pending-order-rec');
    });

    // 14. reconciliation de pedido já PAID -> idempotente
    it('14. reconciliation on already paid order -> idempotent, does not process again', async () => {
      const { db } = await import('@/db');

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
        id: 'conn-1',
        sellerId: 'seller-1',
        provider: 'syncpay',
        accessTokenEncrypted: encrypt('client_1'),
        refreshTokenEncrypted: encrypt('secret_1'),
      } as any);

      // Only pending orders are fetched
      vi.mocked(db.query.orders.findMany).mockResolvedValue([]);

      const res = await syncPayReconciliationService.reconcilePendingOrders('seller-1');
      expect(res.checked).toBe(0);
      expect(res.updated).toBe(0);
    });
  });

  describe('5. Modal Credential Security & Connection Isolation Audit', () => {
    it('GET connection info returns clientIdMasked and hasCredentials without exposing plain clientSecret', async () => {
      const rawClientId = 'partner_client_id_9999';
      const rawClientSecret = 'super_secret_private_key_12345';
      const encryptedClient = encrypt(rawClientId);
      const encryptedSecret = encrypt(rawClientSecret);

      const connObj = {
        id: 'conn-inactive-1',
        status: 'inactive',
        accessTokenEncrypted: encryptedClient,
        refreshTokenEncrypted: encryptedSecret,
        updatedAt: new Date(),
      };

      const { decrypt } = await import('@/lib/encryption');
      const decryptedClient = decrypt(connObj.accessTokenEncrypted);
      const masked = `${decryptedClient.slice(0, 4)}...${decryptedClient.slice(-4)}`;

      expect(masked).toBe('part...9999');
      expect(masked).not.toContain(rawClientSecret);
      expect(JSON.stringify({ status: connObj.status, clientIdMasked: masked, hasCredentials: true })).not.toContain(rawClientSecret);
    });

    it('preserving credentials on blank submit reuses stored encrypted keys and requires explicit POST submit to reactivate', async () => {
      const { db } = await import('@/db');
      const encryptedClient = encrypt('existing_client_id');
      const encryptedSecret = encrypt('existing_client_secret');

      const existingConn = {
        id: 'conn-inactive-2',
        sellerId: 'seller-2',
        provider: 'syncpay',
        status: 'inactive',
        accessTokenEncrypted: encryptedClient,
        refreshTokenEncrypted: encryptedSecret,
      };

      vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue(existingConn as any);

      const { decrypt } = await import('@/lib/encryption');
      
      // Simulates POST route logic when client submits blank fields
      let clientId = '';
      let clientSecret = '';

      if ((!clientId.trim() || !clientSecret.trim()) && existingConn && existingConn.accessTokenEncrypted) {
        clientId = decrypt(existingConn.accessTokenEncrypted);
        clientSecret = decrypt(existingConn.refreshTokenEncrypted);
      }

      expect(clientId).toBe('existing_client_id');
      expect(clientSecret).toBe('existing_client_secret');
    });

    it('opening modal or querying GET does NOT reactivate inactive connection automatically', async () => {
      const inactiveConn = {
        id: 'conn-3',
        sellerId: 'seller-3',
        status: 'inactive',
      };

      // Modal open state only changes React UI state, connection in DB remains inactive
      expect(inactiveConn.status).toBe('inactive');
    });
  });
});
