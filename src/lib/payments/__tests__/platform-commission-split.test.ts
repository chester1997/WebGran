import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoProvider } from '../providers/mercado-pago';
import { PushinPayProvider } from '../providers/pushinpay';
import { syncOrderWithMercadoPago } from '../order-sync';
import { encrypt } from '@/lib/encryption';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    query: {
      sellerPaymentConnections: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
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
      accesses: {
        findMany: vi.fn(),
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
    processOrderDelivery: vi.fn().mockResolvedValue([{ accessId: 'acc-1', status: 'delivered' }]),
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

describe('WebGran Platform Commission Split — Rigorous Verification Suite', () => {
  let mpProvider: MercadoPagoProvider;
  let pushinProvider: PushinPayProvider;
  const platformAccountId = '9C3AD98C-F00B-4729-BEAC-0A4B70B3A043';
  const sellerToken = 'seller_mp_token_xyz';
  const pushinToken = 'pushin_test_token_123';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mpProvider = new MercadoPagoProvider();
    pushinProvider = new PushinPayProvider();
    process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID = platformAccountId;
  });

  // =========================================================================
  // 1. MERCADO PAGO: R$ 0,50 FIXED COMMISSION & SPLIT TRACKING
  // =========================================================================
  describe('1. Mercado Pago — Fixed R$ 0,50 Platform Commission', () => {
    it('always calculates fixed R$ 0,50 fee regardless of amount (never percentage)', () => {
      // Regardless of amount, fee must be strictly 0.50
      expect(mpProvider.calculatePlatformFee(10.0)).toBe(0.50);
      expect(mpProvider.calculatePlatformFee(50.0)).toBe(0.50);
      expect(mpProvider.calculatePlatformFee(100.0)).toBe(0.50);
      expect(mpProvider.calculatePlatformFee(0.50)).toBe(0.50);
    });

    it('returns 0 for sales below R$ 0,50 to avoid gateway split rejection without altering logic to percentage', () => {
      expect(mpProvider.calculatePlatformFee(0.40)).toBe(0);
      expect(mpProvider.calculatePlatformFee(0.10)).toBe(0);
      expect(mpProvider.calculatePlatformFee(0)).toBe(0);
    });

    it('submits marketplace_fee: "0.50" in /v1/orders PIX creation and updates order to REQUESTED', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-mp-1',
        sellerId: 'seller-mp-1',
        provider: 'mercado_pago',
        status: 'active',
        accessTokenEncrypted: encrypt(sellerToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'mp-order-999',
          status: 'pending',
          transactions: {
            payments: [
              {
                id: 'pay-123',
                status: 'pending',
                point_of_interaction: {
                  transaction_data: {
                    qr_code: 'pix-qr-code-data',
                    qr_code_base64: 'base64data',
                  },
                },
              },
            ],
          },
        }),
      } as Response);

      const res = await mpProvider.createPixPayment({
        sellerId: 'seller-mp-1',
        orderId: 'order-mp-test-1',
        amount: 25.0,
      });

      expect(res.paymentId).toBe('pay-123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.mercadopago.com/v1/orders',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"marketplace_fee":"0.50"'),
        })
      );

      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          platformFee: '0.00', // Never book as recognized revenue while pending
          splitStatus: 'REQUESTED',
          splitAmountCents: 50,
        })
      );
    });

    it('does not send marketplace_fee when order is below R$ 0,50 and tracks splitStatus as SKIPPED', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-mp-1',
        sellerId: 'seller-mp-1',
        provider: 'mercado_pago',
        status: 'active',
        accessTokenEncrypted: encrypt(sellerToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'mp-order-low',
          status: 'pending',
          transactions: {
            payments: [{ id: 'pay-low', status: 'pending', qr_code: 'qr-low' }],
          },
        }),
      } as Response);

      await mpProvider.createPixPayment({
        sellerId: 'seller-mp-1',
        orderId: 'order-mp-low',
        amount: 0.40,
      });

      // Body must NOT contain marketplace_fee
      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(requestBody.marketplace_fee).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. PUSHIN PAY: split_rules & PLATFORM ACCOUNT AUDIT
  // =========================================================================
  describe('2. Pushin Pay — split_rules & Fixed 50 Cents Split', () => {
    it('attaches split_rules with 50 cents and platform account_id for orders > R$ 0,50', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-pushin-split-1',
          qr_code: '00020126580014br.gov.bcb.pix...',
          status: 'created',
          value: 1500,
        }),
      } as Response);

      const res = await pushinProvider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-split-1',
        amount: 15.0,
      });

      expect(res.paymentId).toBe('tx-pushin-split-1');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/pix/cashIn',
        expect.objectContaining({
          method: 'POST',
        })
      );
      const sentPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentPayload.value).toBe(1500);
      expect(sentPayload.webhook_url).toContain('/api/webhooks/pushinpay/conn-pushin-1?order_id=order-split-1');
      expect(sentPayload.split_rules).toEqual([
        {
          value: 50,
          account_id: platformAccountId,
        },
      ]);

      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          platformFee: '0.00', // Never book as recognized revenue while pending
          splitStatus: 'REQUESTED',
          splitAmountCents: 50,
        })
      );
    });

    it('does NOT send invalid split rule when platform account_id is not configured, recording FAILED without breaking checkout', async () => {
      delete process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID;
      delete process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID;

      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-no-platform-account',
          qr_code: '00020126580014...',
          status: 'created',
          value: 2000,
        }),
      } as Response);

      const res = await pushinProvider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-no-acc',
        amount: 20.0,
      });

      expect(res.paymentId).toBe('tx-no-platform-account');
      const sentPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentPayload.split_rules).toBeUndefined();
    });

    it('skips split rule when order is exactly 50 cents (boundary value: no merchant balance margin)', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-exact-50',
          qr_code: '000201...',
          status: 'created',
          value: 50,
        }),
      } as Response);

      await pushinProvider.createPixPayment({
        sellerId: 'seller-1',
        orderId: 'order-exact-50',
        amount: 0.50,
      });

      const sentPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentPayload.split_rules).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. WEBHOOK CONFIRMATION, IDEMPOTENCY & STATUS TRANSITIONS
  // =========================================================================
  describe('3. Webhook Split Confirmation & Idempotency', () => {
    it('confirms split (splitStatus: CONFIRMED) and records platformFee: 0.50 when official API confirms split evidence', async () => {
      const dbModule = await import('@/db');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-with-split',
        storeId: 'store-1',
        total: '10.00',
        status: 'pending',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-split-confirmed-123',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Official API query GET /transactions/tx-split-confirmed-123 returns status 'paid' AND split_rules evidence
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-split-confirmed-123',
          status: 'paid',
          value: 1000,
          split_rules: [
            {
              value: 50,
              account_id: platformAccountId,
            },
          ],
        }),
      } as Response);

      const res = await pushinProvider.handleWebhook(
        'conn-1',
        JSON.stringify({
          id: 'tx-split-confirmed-123',
          status: 'paid',
          value: 1000,
        }),
        {}
      );

      expect(res.success).toBe(true);
      // Verify db.update was called with splitStatus: 'CONFIRMED' and platformFee: '0.50'
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          splitStatus: 'CONFIRMED',
          platformFee: '0.50',
          netAmount: '9.50',
          splitConfirmedAt: expect.any(Date),
        })
      );
    });

    it('does NOT confirm split prematurely if official API has no split breakdown, keeping REQUESTED and platformFee: 0.00', async () => {
      const dbModule = await import('@/db');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-no-evidence',
        storeId: 'store-1',
        total: '10.00',
        status: 'pending',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-no-evidence',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Official API query GET /transactions returns status 'paid' but WITHOUT split breakdown
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-no-evidence',
          status: 'paid',
          value: 1000,
          // No split_rules or splits returned
        }),
      } as Response);

      const res = await pushinProvider.handleWebhook(
        'conn-1',
        JSON.stringify({
          id: 'tx-no-evidence',
          status: 'paid',
          value: 1000,
        }),
        {}
      );

      expect(res.success).toBe(true);
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          splitStatus: 'REQUESTED',
          platformFee: '0.00', // Unconfirmed fee is NOT booked as recognized revenue
        })
      );
    });

    it('guarantees webhook idempotency: duplicate webhooks do NOT double-process orders or commissions', async () => {
      const dbModule = await import('@/db');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
      } as any);

      // Event already recorded in paymentWebhookEvents
      vi.mocked(dbModule.db.query.paymentWebhookEvents.findFirst).mockResolvedValueOnce({
        id: 'evt-existing',
        provider: 'pushinpay',
        eventId: 'pushin_tx-dup_paid',
      } as any);

      const res = await pushinProvider.handleWebhook(
        'conn-1',
        JSON.stringify({
          id: 'tx-dup',
          status: 'paid',
        }),
        {}
      );

      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(true);
      // DB update must NOT be called on duplicate webhook
      expect(dbModule.db.update).not.toHaveBeenCalled();
    });

    it('marks split as FAILED and platformFee as 0.00 on canceled or expired transactions', async () => {
      const dbModule = await import('@/db');

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'pushinpay',
      } as any);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-canceled',
        storeId: 'store-1',
        total: '10.00',
        status: 'pending',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-canceled-1',
        splitStatus: 'REQUESTED',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      const res = await pushinProvider.handleWebhook(
        'conn-1',
        JSON.stringify({
          id: 'tx-canceled-1',
          status: 'canceled',
        }),
        {}
      );

      expect(res.success).toBe(true);
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          splitStatus: 'FAILED',
          splitError: 'TRANSACAO_CANCELADA_OU_EXPIRADA',
          platformFee: '0.00',
        })
      );
    });
  });

  // =========================================================================
  // 4. ORDER SYNC (RECONCILIATION & COMMISSION ACCREDITATION)
  // =========================================================================
  describe('4. Order Reconciliation & Accreditation', () => {
    it('syncOrderWithMercadoPago accredits R$ 0,50 fee and netAmount when marketplace_fee is confirmed', async () => {
      const dbModule = await import('@/db');

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-sync-mp-1',
        storeId: 'store-mp-1',
        total: '20.00',
        status: 'pending',
        paymentMethod: 'mercadopago',
        paymentId: 'mp-pay-99',
        splitStatus: 'REQUESTED',
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-mp-1',
        ownerId: 'seller-mp-1',
      } as any);

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-mp-sync',
        sellerId: 'seller-mp-1',
        provider: 'mercado_pago',
        status: 'active',
        accessTokenEncrypted: encrypt(sellerToken),
      } as any);

      // Search returns approved payment with marketplace_fee: 0.50
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mp-pay-99',
              status: 'approved',
              marketplace_fee: 0.50,
              payment_method_id: 'pix',
            },
          ],
        }),
      } as Response);

      const result = await syncOrderWithMercadoPago('order-sync-mp-1');

      expect(result.status).toBe('paid');
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          platformFee: '0.50',
          netAmount: '19.50',
          splitStatus: 'CONFIRMED',
          splitConfirmedAt: expect.any(Date),
        })
      );
    });
  });
});
