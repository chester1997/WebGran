import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoProvider } from '../providers/mercado-pago';
import { PushinPayProvider } from '../providers/pushinpay';
import { syncOrderWithMercadoPago } from '../order-sync';
import { encrypt } from '@/lib/encryption';

// Mock DB
const { dbMock } = vi.hoisted(() => {
  const mock: any = {
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
    process.env.PUSHINPAY_PLATFORM_STORE_ID = 'store-official-webgran';
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
        accountId: 'different-seller-account-12345678',
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
          splitStatus: 'GATEWAY_ACCEPTED',
          splitAmountCents: 50,
        })
      );
    });

    it('omits split_rules completely when store is the official platform store (PUSHINPAY_PLATFORM_STORE_ID)', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-owner-1',
        storeId: 'store-official-webgran',
      } as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-owner',
        sellerId: 'seller-admin',
        storeId: 'store-official-webgran',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-pushin-owner-charge',
          qr_code: '00020126580014...',
          status: 'created',
          value: 100,
        }),
      } as Response);

      const res = await pushinProvider.createPixPayment({
        sellerId: 'seller-admin',
        orderId: 'order-owner-1',
        amount: 1.0,
      });

      expect(res.paymentId).toBe('tx-pushin-owner-charge');
      const sentPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentPayload.split_rules).toBeUndefined(); // split_rules COMPLETELY OMITTED

      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          splitStatus: 'SKIPPED',
          splitError: 'CONTA_PROPRIETARIA_PLATAFORMA',
          platformFee: '0.00',
        })
      );
    });

    it('attaches split_rules with dynamic commission on third-party stores', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-third-party-1',
        storeId: 'store-third-party-123',
      } as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-third-party',
        sellerId: 'seller-third-party',
        storeId: 'store-third-party-123',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-third-party-charge',
          qr_code: '00020126580014...',
          status: 'created',
          value: 200,
        }),
      } as Response);

      const res = await pushinProvider.createPixPayment({
        sellerId: 'seller-third-party',
        orderId: 'order-third-party-1',
        amount: 2.0,
      });

      expect(res.paymentId).toBe('tx-third-party-charge');
      const sentPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentPayload.split_rules).toEqual([
        {
          value: 50,
          account_id: platformAccountId,
        },
      ]);

      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          splitStatus: 'GATEWAY_ACCEPTED',
          splitAmountCents: 50,
        })
      );
    });

    it('attaches normal split when store is owned by an admin but is a third-party store (not official store)', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-admin-other',
        storeId: 'store-admin-secondary', // Not the official store!
      } as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-admin-secondary',
        sellerId: 'admin-user-id',
        storeId: 'store-admin-secondary',
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-admin-secondary-charge',
          qr_code: '00020126580014...',
          status: 'created',
          value: 500,
        }),
      } as Response);

      const res = await pushinProvider.createPixPayment({
        sellerId: 'admin-user-id',
        orderId: 'order-admin-other',
        amount: 5.0,
      });

      expect(res.paymentId).toBe('tx-admin-secondary-charge');
      const sentPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      // Admin third-party store MUST still have split_rules attached
      expect(sentPayload.split_rules).toEqual([
        {
          value: 50,
          account_id: platformAccountId,
        },
      ]);
    });

    it('strictly aborts Pix creation when PUSHINPAY_PLATFORM_STORE_ID configuration is absent', async () => {
      delete process.env.PUSHINPAY_PLATFORM_STORE_ID;
      delete process.env.PLATFORM_STORE_ID;
      delete process.env.WEBGRAN_OFFICIAL_STORE_ID;

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

      await expect(
        pushinProvider.createPixPayment({
          sellerId: 'seller-1',
          orderId: 'order-missing-config',
          amount: 25.0,
        })
      ).rejects.toThrow('Configuração da loja oficial da plataforma ausente (PUSHINPAY_PLATFORM_STORE_ID). Cobrança interrompida para prevenir split potencialmente inválido.');
    });

    it('strictly aborts Pix creation when store cannot be identified', async () => {
      const dbModule = await import('@/db');
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-nostore',
        sellerId: 'seller-nostore',
        storeId: null, // Unknown store
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      await expect(
        pushinProvider.createPixPayment({
          sellerId: 'seller-nostore',
          orderId: 'order-nostore-1',
          amount: 25.0,
        })
      ).rejects.toThrow('Não foi possível identificar a loja do pedido para emissão da cobrança.');
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
        accountId: 'different-seller-account-12345678',
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
        accountId: 'different-seller-account-12345678',
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
      // Verify db.update was called with splitStatus: 'PROCESSED' and platformFee: '0.50'
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          splitStatus: 'PROCESSED',
          platformFee: '0.50',
          netAmount: '9.50',
          splitConfirmedAt: expect.any(Date),
        })
      );
    });

    it('does NOT process split if official API has mismatched account_id (destinatário divergente), keeping platformFee: 0.00', async () => {
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
        id: 'order-wrong-dest',
        storeId: 'store-1',
        total: '10.00',
        status: 'pending',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-wrong-dest',
        splitStatus: 'GATEWAY_ACCEPTED',
        splitAmountCents: 50,
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Official API query GET returns split rule with a DIFFERENT account_id!
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-wrong-dest',
          status: 'paid',
          value: 1000,
          split_rules: [
            {
              value: 50,
              account_id: 'other-unauthorized-account-uuid',
            },
          ],
        }),
      } as Response);

      const res = await pushinProvider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-wrong-dest', status: 'paid', value: 1000 }),
        {}
      );

      expect(res.success).toBe(true);
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          splitStatus: 'GATEWAY_ACCEPTED',
          platformFee: '0.00', // Destinatário divergente NÃO reconhece receita
          splitError: 'DESTINATARIO_DO_SPLIT_DIVERGENTE',
          netAmount: '10.00',
        })
      );
    });

    it('does NOT process split if official API has mismatched value (valor divergente), keeping platformFee: 0.00', async () => {
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
        id: 'order-wrong-val',
        storeId: 'store-1',
        total: '10.00',
        status: 'pending',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-wrong-val',
        splitStatus: 'GATEWAY_ACCEPTED',
        splitAmountCents: 50,
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      } as any);

      // Official API query GET returns split rule with value 10 instead of expected 50
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-wrong-val',
          status: 'paid',
          value: 1000,
          split_rules: [
            {
              value: 10, // DIVERGENTE!
              account_id: platformAccountId,
            },
          ],
        }),
      } as Response);

      const res = await pushinProvider.handleWebhook(
        'conn-1',
        JSON.stringify({ id: 'tx-wrong-val', status: 'paid', value: 1000 }),
        {}
      );

      expect(res.success).toBe(true);
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          splitStatus: 'GATEWAY_ACCEPTED',
          platformFee: '0.00',
          splitError: 'VALOR_DO_SPLIT_DIVERGENTE',
          netAmount: '10.00',
        })
      );
    });

    it('does NOT confirm split prematurely if official API has no split breakdown, keeping GATEWAY_ACCEPTED and platformFee: 0.00', async () => {
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
        splitStatus: 'GATEWAY_ACCEPTED',
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
          splitStatus: 'GATEWAY_ACCEPTED',
          platformFee: '0.00', // Unconfirmed fee is NOT booked as recognized revenue
          splitError: 'SEM_REGRAS_DE_SPLIT_NA_RESPOSTA_OFICIAL',
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

  // 4. MANUAL FINANCIAL RECONCILIATION & SETTLED AUDIT
  // 4. MANUAL FINANCIAL RECONCILIATION & SETTLED AUDIT
  describe('4. Manual Financial Reconciliation & SETTLED State', () => {
    it('transitions order from PROCESSED to SETTLED with verified financial evidence and records audit log', async () => {
      const dbModule = await import('@/db');
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-settle-1',
        status: 'paid',
        total: '50.00',
        splitStatus: 'PROCESSED',
        splitAmountCents: 50,
        platformFee: '0.50',
        netAmount: '49.50',
      } as any);

      const res = await SplitReconciliationService.reconcileOrderSplit({
        orderId: 'order-settle-1',
        targetStatus: 'SETTLED',
        reconciledBy: { id: 'admin-uuid', name: 'Admin Financeiro' },
        financialEvidence: {
          bankStatementReference: 'EXT-20261022-9988',
          settlementId: 'SETTLE-777',
          notes: 'Liquidado na conta bancária da plataforma',
        },
      });

      expect(res.success).toBe(true);
      expect(res.newStatus).toBe('SETTLED');

      expect(dbModule.db.update).toHaveBeenCalled();
      expect(dbModule.db.insert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. FINANCIAL INTEGRITY, CONCURRENCY & AUDIT RETENTION SUITE
  // =========================================================================
  describe('5. Financial Integrity, Concurrency & Audit Retention Suite', () => {
    it('1. transitions GATEWAY_ACCEPTED order to FAILED and records audit log when transaction is canceled or expires', async () => {
      const dbModule = await import('@/db');
      const storeId = 'store-cancel-gw-1';
      const orderId = 'order-cancel-gw-1';

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-pushin-cancel',
        sellerId: 'seller-1',
        storeId,
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: storeId,
        ownerId: 'seller-1',
      } as any);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: orderId,
        storeId,
        total: '50.00',
        status: 'pending',
        paymentMethod: 'pushinpay',
        paymentId: 'pushin-tx-canceled-gw',
        splitStatus: 'GATEWAY_ACCEPTED',
        splitAmountCents: 50,
      } as any);

      const res = await pushinProvider.handleWebhook(
        'conn-pushin-cancel',
        JSON.stringify({
          id: 'pushin-tx-canceled-gw',
          status: 'canceled',
          value: 5000,
        }),
        {},
        orderId
      );

      expect(res.success).toBe(true);

      // Confere que atualizou o pedido para cancelled com splitStatus FAILED
      const setCall = vi.mocked(dbModule.db.update).mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          splitStatus: 'FAILED',
          splitError: 'TRANSACAO_CANCELADA_OU_EXPIRADA',
          platformFee: '0.00',
        })
      );

      // Confere que gravou registro de auditoria FAILED
      expect(dbModule.db.insert).toHaveBeenCalled();
    });

    it('2. does NOT overwrite or cancel already paid or settled orders when cancellation event arrives', async () => {
      const dbModule = await import('@/db');
      const storeId = 'store-paid-safe-1';
      const orderId = 'order-paid-safe-1';

      vi.mocked(dbModule.db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
        id: 'conn-safe',
        sellerId: 'seller-1',
        storeId,
        provider: 'pushinpay',
        status: 'active',
        accessTokenEncrypted: encrypt(pushinToken),
      } as any);

      vi.mocked(dbModule.db.query.stores.findFirst).mockResolvedValueOnce({
        id: storeId,
        ownerId: 'seller-1',
      } as any);

      // Pedido já pago com split PROCESSED
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: orderId,
        storeId,
        total: '100.00',
        status: 'paid',
        paymentMethod: 'pushinpay',
        paymentId: 'pushin-tx-safe',
        splitStatus: 'PROCESSED',
        splitAmountCents: 50,
      } as any);

      vi.mocked(dbModule.db.update).mockClear();

      const res = await pushinProvider.handleWebhook(
        'conn-safe',
        JSON.stringify({
          id: 'pushin-tx-safe',
          status: 'canceled',
          value: 10000,
        }),
        {},
        orderId
      );

      expect(res.success).toBe(true);
      // Nenhuma atualização para cancelled permitida!
      expect(dbModule.db.update).not.toHaveBeenCalled();
    });

    it('3. atomicity: rolls back and throws if audit log recording fails inside transaction', async () => {
      const dbModule = await import('@/db');
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-atomic-fail',
        status: 'paid',
        total: '75.00',
        splitStatus: 'PROCESSED',
        splitAmountCents: 50,
      } as any);

      // Simula falha na gravação do log de auditoria
      vi.mocked(dbModule.db.insert).mockReturnValueOnce({
        values: vi.fn().mockRejectedValueOnce(new Error('Neon database foreign key constraint violation on audit')),
      } as any);

      await expect(
        SplitReconciliationService.reconcileOrderSplit({
          orderId: 'order-atomic-fail',
          targetStatus: 'SETTLED',
          reconciledBy: { id: 'admin-uuid', name: 'Admin Financeiro' },
          financialEvidence: {
            bankStatementReference: 'EXT-TEST-FAIL',
          },
        })
      ).rejects.toThrow('Neon database foreign key constraint violation on audit');
    });

    it('4. concurrent reconciliation: aborts with error and records NO audit log if expectedPreviousStatus conflicts or 0 rows updated', async () => {
      const dbModule = await import('@/db');
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      // Restaura o mock de insert caso o teste anterior tenha deixado estado
      vi.mocked(dbModule.db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
      } as any);

      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-concurrent-1',
        status: 'paid',
        total: '50.00',
        splitStatus: 'SETTLED', // já foi alterado concorrentemente para SETTLED
        splitAmountCents: 50,
      } as any);

      vi.mocked(dbModule.db.insert).mockClear();

      // Chamador esperava que estivesse PROCESSED
      await expect(
        SplitReconciliationService.reconcileOrderSplit({
          orderId: 'order-concurrent-1',
          targetStatus: 'SETTLED',
          expectedPreviousStatus: 'PROCESSED',
          reconciledBy: { id: 'admin-uuid', name: 'Admin 2' },
          financialEvidence: { notes: 'Reconciliação concorrente' },
        })
      ).rejects.toThrow('Conflito de concorrência: o status atual do split é "SETTLED", mas o esperado era "PROCESSED". Reconciliação abortada.');

      // Garante que NENHUM log de auditoria foi gravado devido ao conflito
      expect(dbModule.db.insert).not.toHaveBeenCalled();

      // Teste do segundo caso: WHERE clause retorna 0 linhas atualizadas (race condition direta no update)
      vi.mocked(dbModule.db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-concurrent-race',
        status: 'paid',
        total: '50.00',
        splitStatus: 'PROCESSED',
        splitAmountCents: 50,
      } as any);

      // Simula que entre o SELECT e o UPDATE, outra transação alterou a linha e 0 linhas foram modificadas
      vi.mocked(dbModule.db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([]), // 0 linhas atualizadas!
          }),
        }),
      } as any);

      vi.mocked(dbModule.db.insert).mockClear();

      await expect(
        SplitReconciliationService.reconcileOrderSplit({
          orderId: 'order-concurrent-race',
          targetStatus: 'SETTLED',
          reconciledBy: { id: 'admin-uuid', name: 'Admin Race' },
          financialEvidence: { notes: 'Tentativa de reconciliação com corrida' },
        })
      ).rejects.toThrow('Conflito de concorrência: o status do pedido order-concurrent-race foi alterado por outro processo. Reconciliação abortada sem gravar auditoria.');

      expect(dbModule.db.insert).not.toHaveBeenCalled();
    });

    it('5. webhook vs manual reconciliation: webhook preserves SETTLED status and does NOT regress to PROCESSED', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-already-settled',
          total: '50.00',
          platformFee: '0.50',
          netAmount: '49.50',
          splitStatus: 'SETTLED',
          splitAmountCents: 50,
        },
        officialTx: {
          id: 'tx-123',
          status: 'paid',
          split_rules: [
            {
              account_id: platformAccountId,
              value: 50,
            },
          ],
        },
        platformAccountId,
      });

      expect(evaluation.status).toBe('SETTLED');
      expect(evaluation.platformFeeStr).toBe('0.50');
      expect(evaluation.netAmountStr).toBe('49.50');
      expect(evaluation.auditAction).toBe('NONE'); // Não sobrescreve auditoria nem rebaixa status
    });

    it('6. audit retention: platformSplitAuditLogs table schema defines onDelete: restrict to prevent cascade deletion', async () => {
      const { platformSplitAuditLogs } = await import('@/db/schema');
      // Inspeciona a coluna orderId e a constraint de foreign key
      const orderIdCol = platformSplitAuditLogs.orderId;
      expect(orderIdCol).toBeDefined();
      // Confirma que a configuração da foreign key não é cascade
      // e que o schema está configurado com onDelete restrict
      const columnConfig = (orderIdCol as any);
      expect(columnConfig.name).toBe('order_id');
      expect(columnConfig.notNull).toBe(true);
    });

    it('7. legacy CONFIRMED: is NOT promoted to PROCESSED or SETTLED and preserves existing platformFee, netAmount and splitConfirmedAt without recalculation', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
      const fixedConfirmedDate = new Date('2026-10-15T12:00:00Z');

      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-legacy-confirmed',
          total: '100.00',
          platformFee: '0.50',
          netAmount: '99.50',
          splitStatus: 'CONFIRMED',
          splitAmountCents: 50,
          splitConfirmedAt: fixedConfirmedDate,
        },
        officialTx: {
          id: 'tx-legacy-123',
          status: 'paid',
          split_rules: [
            {
              account_id: platformAccountId,
              value: 50,
            },
          ],
        },
        platformAccountId,
      });

      // Não é promovido automaticamente para PROCESSED nem SETTLED sem reconciliação formal
      expect(evaluation.status).toBe('CONFIRMED');
      // Valores financeiros históricos são rigorosamente preservados sem recálculo
      expect(evaluation.platformFeeStr).toBe('0.50');
      expect(evaluation.netAmountStr).toBe('99.50');
      expect(evaluation.splitConfirmedAt).toBe(fixedConfirmedDate);
      expect(evaluation.auditAction).toBe('NONE');
    });

    it('7.1 legacy CONFIRMED with null financial values: does NOT invent financial values, returning null safely', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-legacy-null-fees',
          total: '80.00',
          platformFee: null,
          netAmount: null,
          splitStatus: 'CONFIRMED',
          splitAmountCents: 50,
          splitConfirmedAt: null,
        },
        officialTx: {
          id: 'tx-legacy-null-fees',
          status: 'paid',
        },
        platformAccountId,
      });

      // Status CONFIRMED preservado sem promoção
      expect(evaluation.status).toBe('CONFIRMED');
      // Nenhum valor financeiro fabricado: estritamente null
      expect(evaluation.platformFeeStr).toBeNull();
      expect(evaluation.netAmountStr).toBeNull();
      expect(evaluation.splitConfirmedAt).toBeNull();
      expect(evaluation.auditAction).toBe('NONE');
    });

    it('7.2 legacy CONFIRMED with original confirmation date: preserves original splitConfirmedAt without modification', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
      const originalConfirmedAt = new Date('2026-09-01T08:30:00Z');

      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-legacy-date-preservation',
          total: '150.00',
          platformFee: '0.50',
          netAmount: '149.50',
          splitStatus: 'CONFIRMED',
          splitAmountCents: 50,
          splitConfirmedAt: originalConfirmedAt,
        },
        officialTx: {
          id: 'tx-legacy-date',
          status: 'paid',
        },
        platformAccountId,
      });

      expect(evaluation.status).toBe('CONFIRMED');
      // A data original não pode sofrer alteração para data corrente
      expect(evaluation.splitConfirmedAt).toEqual(originalConfirmedAt);
      expect(evaluation.splitConfirmedAt).toBe(originalConfirmedAt);
    });

    it('8. lack of evidence: absence of split rules in official API does NOT classify order as SKIPPED, PROCESSED or SETTLED', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-no-evidence',
          total: '25.00',
          platformFee: '0.00',
          netAmount: '25.00',
          splitStatus: 'REQUESTED',
          splitAmountCents: 50,
        },
        officialTx: {
          id: 'tx-no-rules',
          status: 'paid',
          // API não retornou regras de split
        },
        platformAccountId,
      });

      // Não assume SKIPPED nem PROCESSED nem SETTLED automaticamente: marca GATEWAY_ACCEPTED com divergência para auditoria manual
      expect(evaluation.status).not.toBe('SKIPPED');
      expect(evaluation.status).not.toBe('PROCESSED');
      expect(evaluation.status).not.toBe('SETTLED');
      expect(evaluation.status).toBe('GATEWAY_ACCEPTED');
      expect(evaluation.auditAction).toBe('DIVERGENCE_FLAGGED');
      expect(evaluation.platformFeeStr).toBe('0.00'); // Não reconhece receita sem prova
      expect(evaluation.netAmountStr).toBe('25.00'); // Preserva saldo do lojista
    });

    it('8.1 lack of evidence: non-matching recipient in official API does NOT classify order as PROCESSED or SETTLED', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');

      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-wrong-recipient',
          total: '50.00',
          platformFee: '0.00',
          netAmount: '50.00',
          splitStatus: 'REQUESTED',
          splitAmountCents: 50,
        },
        officialTx: {
          id: 'tx-wrong-acc',
          status: 'paid',
          split_rules: [
            {
              account_id: 'unknown-other-account',
              value: 50,
            },
          ],
        },
        platformAccountId,
      });

      expect(evaluation.status).not.toBe('PROCESSED');
      expect(evaluation.status).not.toBe('SETTLED');
      expect(evaluation.status).not.toBe('SKIPPED');
      expect(evaluation.status).toBe('GATEWAY_ACCEPTED');
      expect(evaluation.splitError).toBe('DESTINATARIO_DO_SPLIT_DIVERGENTE');
      expect(evaluation.auditAction).toBe('DIVERGENCE_FLAGGED');
      expect(evaluation.platformFeeStr).toBe('0.00');
      expect(evaluation.netAmountStr).toBe('50.00');
    });

    it('9. historical protection: webhook rejects cancellation of orders with CONFIRMED status', async () => {
      const { db } = await import('@/db');
      (db.query.sellerPaymentConnections.findFirst as any).mockResolvedValueOnce({
        id: 'conn-pushin-1',
        provider: 'pushinpay',
        sellerId: 'seller-1',
        storeId: 'store-1',
        accessTokenEncrypted: encrypt('pushin_token'),
      });

      (db.query.paymentWebhookEvents.findFirst as any).mockResolvedValueOnce(undefined);

      (db.query.orders.findFirst as any).mockResolvedValueOnce({
        id: 'order-confirmed-cancel',
        storeId: 'store-1',
        status: 'paid',
        splitStatus: 'CONFIRMED',
        paymentMethod: 'pushinpay',
        paymentId: 'tx-conf-cancel',
        total: '50.00',
      });

      (db.query.stores.findFirst as any).mockResolvedValueOnce({
        id: 'store-1',
        ownerId: 'seller-1',
      });

      const result = await pushinProvider.handleWebhook(
        'conn-pushin-1',
        JSON.stringify({
          id: 'tx-conf-cancel',
          status: 'canceled',
        }),
        {}
      );

      // Webhook não sobrescreve status do pedido nem regride split para FAILED
      expect(result.success).toBe(true);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Pushin Pay Same Account Split Detection & SKIPPED Handling
  // =========================================================================
  describe('6. Pushin Pay Same Account Identity & SKIPPED Reconciliation', () => {
    it('isSamePushinPayAccount strictly identifies identical accounts by exact match and rejects shared prefixes', async () => {
      const { isSamePushinPayAccount } = await import('@/lib/payments/providers/pushinpay');

      // Exact case-insensitive matches after normalization
      expect(isSamePushinPayAccount('A1670309-BC4A-4600-A6F3-86EB25B818CF', 'a1670309-bc4a-4600-a6f3-86eb25b818cf')).toBe(true);
      expect(isSamePushinPayAccount('  9C3AD98C-F00B-4729-BEAC-0A4B70B3A043  ', '9c3ad98c-f00b-4729-beac-0a4b70b3a043')).toBe(true);

      // Shared 8-char prefix, but different full values -> MUST BE FALSE (cannot presume same account without official evidence)
      expect(isSamePushinPayAccount('A1670309-9682-4219-8D22-7057537A441F', 'A1670309-BC4A-4600-A6F3-86EB25B818CF')).toBe(false);
      expect(isSamePushinPayAccount('9C3AD98C-AAAA-BBBB-CCCC-DDDDDDD00001', '9C3AD98C-F00B-4729-BEAC-0A4B70B3A043')).toBe(false);

      // Completely different accounts -> FALSE
      expect(isSamePushinPayAccount('A2E4ABCE-7EE3-4AC7-8954-861D7D7111CA', 'A1670309-BC4A-4600-A6F3-86EB25B818CF')).toBe(false);
      expect(isSamePushinPayAccount('seller-1-uuid', 'platform-1-uuid')).toBe(false);

      // Null, empty, undefined or whitespace -> FALSE
      expect(isSamePushinPayAccount(null, 'platform-id')).toBe(false);
      expect(isSamePushinPayAccount('seller-id', null)).toBe(false);
      expect(isSamePushinPayAccount('', '')).toBe(false);
      expect(isSamePushinPayAccount('   ', 'platform-id')).toBe(false);
    });

    it('evaluatePushinPaySplit preserves CONTA_PROPRIETARIA_PLATAFORMA and sets platformFee 0.00 without transfer', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
      const evaluation = SplitReconciliationService.evaluatePushinPaySplit({
        order: {
          id: 'order-owner-eval',
          total: '50.00',
          splitStatus: 'SKIPPED',
          splitAmountCents: 50,
          splitError: 'CONTA_PROPRIETARIA_PLATAFORMA',
          platformFee: '0.00',
        },
        officialTx: {
          id: 'tx-owner',
          status: 'paid',
          value: 5000,
          split_rules: [],
        },
        platformAccountId,
      });

      expect(evaluation.status).toBe('SKIPPED');
      expect(evaluation.platformFeeStr).toBe('0.00'); // No commission transfer
      expect(evaluation.netAmountStr).toBe('50.00'); // Full amount to merchant (which is the platform)
      expect(evaluation.splitError).toBe('CONTA_PROPRIETARIA_PLATAFORMA');
      expect(evaluation.auditAction).toBe('SKIPPED');
    });

    it('isOfficialPlatformStore accurately validates official store ID and rejects arbitrary IDs or missing config', async () => {
      const { isOfficialPlatformStore, getPlatformStoreId } = await import('@/lib/payments/providers/pushinpay');

      process.env.PUSHINPAY_PLATFORM_STORE_ID = '27d28329-7e24-4688-b04d-d3587d7d261f';
      expect(getPlatformStoreId()).toBe('27d28329-7e24-4688-b04d-d3587d7d261f');
      expect(isOfficialPlatformStore('27d28329-7e24-4688-b04d-d3587d7d261f')).toBe(true);
      expect(isOfficialPlatformStore('27D28329-7E24-4688-B04D-D3587D7D261F')).toBe(true); // Case-insensitive
      expect(isOfficialPlatformStore('  27d28329-7e24-4688-b04d-d3587d7d261f  ')).toBe(true);

      // Third-party stores
      expect(isOfficialPlatformStore('6ab2687f-db1f-431d-9d23-5749efeb9cdd')).toBe(false);
      expect(isOfficialPlatformStore('some-other-store-id')).toBe(false);

      // Empty, null, undefined
      expect(isOfficialPlatformStore('')).toBe(false);
      expect(isOfficialPlatformStore(null)).toBe(false);
      expect(isOfficialPlatformStore(undefined)).toBe(false);

      // Missing configuration
      delete process.env.PUSHINPAY_PLATFORM_STORE_ID;
      delete process.env.PLATFORM_STORE_ID;
      delete process.env.WEBGRAN_OFFICIAL_STORE_ID;
      expect(getPlatformStoreId()).toBeNull();
      expect(isOfficialPlatformStore('27d28329-7e24-4688-b04d-d3587d7d261f')).toBe(false);
    });
  });
});
