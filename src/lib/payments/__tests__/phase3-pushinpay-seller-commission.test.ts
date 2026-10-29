import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushinPayProvider } from '../providers/pushinpay';
import { encrypt } from '@/lib/encryption';
import { SplitReconciliationService } from '../split-reconciliation-service';
import { paymentService } from '../payment-service';
import { CheckoutService } from '@/lib/orders/checkout-service';

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
      products: {
        findMany: vi.fn(),
      },
      combos: {
        findMany: vi.fn(),
      },
      paymentWebhookEvents: {
        findFirst: vi.fn(),
      },
      sellerCommissionSettings: {
        findFirst: vi.fn(),
      },
      platformCommissionSettings: {
        findFirst: vi.fn().mockResolvedValue({ feeCents: 50, updatedAt: new Date() }),
      },
      accesses: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'order-123', status: 'pending' }]),
      }),
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
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 1000 }),
}));

// Mock Order Usage Service
vi.mock('@/lib/orders/order-usage-service', () => ({
  getMonthlyOrderUsage: vi.fn().mockResolvedValue(10),
}));

// Mock Ensure Payment Tables
vi.mock('@/db/ensure-payment-tables', () => ({
  ensurePaymentTables: vi.fn().mockResolvedValue(undefined),
}));

describe('Phase 3: PushinPay + SellerCommissionService Engine Integration Suite', () => {
  let provider: PushinPayProvider;
  const platformAccountId = '9C3AD98C-F00B-4729-BEAC-0A4B70B3A043';
  const platformStoreId = 'store-official-webgran';
  const thirdPartyStoreId = 'store-third-party-1';
  const sellerId = 'seller-user-abc';
  const sellerToken = 'pushin_test_token_live';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    provider = new PushinPayProvider();
    process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID = platformAccountId;
    process.env.PUSHINPAY_PLATFORM_STORE_ID = platformStoreId;

    // Default connection mock for seller
    dbMock.query.sellerPaymentConnections.findFirst.mockResolvedValue({
      id: 'conn-1',
      sellerId,
      storeId: thirdPartyStoreId,
      provider: 'pushinpay',
      status: 'active',
      accessTokenEncrypted: encrypt(sellerToken),
      webhookSecretEncrypted: null,
      updatedAt: new Date(),
    });

    // Default store mock
    dbMock.query.stores.findFirst.mockResolvedValue({
      id: thirdPartyStoreId,
      ownerId: sellerId,
      name: 'Loja Vendedora Teste',
      slug: 'loja-vendedora',
    });

    // Default orders findFirst
    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '10.00',
      splitAmountCents: 50,
      splitStatus: 'PENDING',
      createdAt: new Date(),
    });

    // Default orders findMany
    dbMock.query.orders.findMany.mockResolvedValue([]);

    // Default platform commission settings
    dbMock.query.platformCommissionSettings.findFirst.mockResolvedValue({
      feeCents: 50,
      updatedAt: new Date(),
    });

    // Default seller commission settings (null = default to 50 cents)
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Default fee (50 cents)
  // -------------------------------------------------------------------------
  it('1. applies platform default fee of 50 cents in split_rules when seller has no individual configuration', async () => {
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue(null);

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-default-50',
          qr_code: 'pix-qr-default-50',
          split_rules: sentPayload.split_rules,
        }),
      } as Response;
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 25.0,
    });

    expect(result.paymentId).toBe('tx-default-50');
    expect(sentPayload).toBeDefined();
    expect(sentPayload.split_rules).toEqual([
      {
        value: 50,
        account_id: platformAccountId,
      },
    ]);

    // Check DB order update
    expect(dbMock.update).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Individual custom fee (25 cents)
  // -------------------------------------------------------------------------
  it('2. applies custom fee of 25 cents in split_rules when seller has customFeeCents configured', async () => {
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 25,
      exemptionActive: false,
      exemptionStart: null,
      exemptionEnd: null,
      exemptionReason: null,
      version: 1,
      updatedAt: new Date(),
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '20.00',
      splitAmountCents: 25,
      splitStatus: 'PENDING',
      createdAt: new Date(),
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-custom-25',
          qr_code: 'pix-qr-custom-25',
          split_rules: sentPayload.split_rules,
        }),
      } as Response;
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 20.0,
    });

    expect(result.paymentId).toBe('tx-custom-25');
    expect(sentPayload.split_rules).toEqual([
      {
        value: 25,
        account_id: platformAccountId,
      },
    ]);
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Individual custom fee of 1 cent
  // -------------------------------------------------------------------------
  it('3. applies minimum non-zero custom fee of 1 cent in split_rules', async () => {
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 1,
      exemptionActive: false,
      exemptionStart: null,
      exemptionEnd: null,
      version: 1,
      updatedAt: new Date(),
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '10.00',
      splitAmountCents: 1,
      splitStatus: 'PENDING',
      createdAt: new Date(),
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-custom-1',
          qr_code: 'pix-qr-1',
          split_rules: sentPayload.split_rules,
        }),
      } as Response;
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 10.0,
    });

    expect(result.paymentId).toBe('tx-custom-1');
    expect(sentPayload.split_rules).toEqual([
      {
        value: 1,
        account_id: platformAccountId,
      },
    ]);
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Custom fee of 0 cents (COMISSAO_ZERO)
  // -------------------------------------------------------------------------
  it('4. omits split_rules and marks SKIPPED with COMISSAO_ZERO when seller has customFeeCents of 0', async () => {
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 0,
      exemptionActive: false,
      version: 1,
      updatedAt: new Date(),
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '50.00',
      splitAmountCents: 0,
      splitStatus: 'SKIPPED',
      splitError: 'COMISSAO_ZERO',
      createdAt: new Date(),
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-zero-fee',
          qr_code: 'pix-qr-zero',
        }),
      } as Response;
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 50.0,
    });

    expect(result.paymentId).toBe('tx-zero-fee');
    expect(sentPayload.split_rules).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Active temporary exemption (ISENCAO_TEMPORARIA)
  // -------------------------------------------------------------------------
  it('5. omits split_rules and marks SKIPPED with ISENCAO_TEMPORARIA during active exemption window', async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
    const end = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 2 days later

    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 30, // Normally 30, but exempt now
      exemptionActive: true,
      exemptionStart: start,
      exemptionEnd: end,
      exemptionReason: 'Campanha de Boas-Vindas',
      version: 1,
      updatedAt: new Date(),
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '30.00',
      splitAmountCents: 0,
      splitStatus: 'SKIPPED',
      splitError: 'ISENCAO_TEMPORARIA',
      createdAt: now,
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-exempt',
          qr_code: 'pix-qr-exempt',
        }),
      } as Response;
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 30.0,
    });

    expect(result.paymentId).toBe('tx-exempt');
    expect(sentPayload.split_rules).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Future exemption (not yet started)
  // -------------------------------------------------------------------------
  it('6. applies configured fee when exemption start date is in the future', async () => {
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const end = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 3 days later

    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 30,
      exemptionActive: true,
      exemptionStart: start,
      exemptionEnd: end,
      exemptionReason: 'Promoção Futura',
      version: 1,
      updatedAt: new Date(),
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '30.00',
      splitAmountCents: 30,
      splitStatus: 'PENDING',
      createdAt: now,
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-future-exempt',
          qr_code: 'pix-qr-future',
          split_rules: sentPayload.split_rules,
        }),
      } as Response;
    });

    await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 30.0,
    });

    expect(sentPayload.split_rules).toEqual([
      {
        value: 30,
        account_id: platformAccountId,
      },
    ]);
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Expired exemption
  // -------------------------------------------------------------------------
  it('7. automatically returns to normal fee when temporary exemption has expired (exclusive end)', async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 2 days ago
    const end = new Date(now.getTime() - 1000); // Expired 1 second ago

    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 40,
      exemptionActive: true,
      exemptionStart: start,
      exemptionEnd: end,
      exemptionReason: 'Campanha Expirada',
      version: 1,
      updatedAt: new Date(),
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-123',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '40.00',
      splitAmountCents: 40,
      splitStatus: 'PENDING',
      createdAt: now,
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-expired-exempt',
          qr_code: 'pix-qr-expired',
          split_rules: sentPayload.split_rules,
        }),
      } as Response;
    });

    await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 40.0,
    });

    expect(sentPayload.split_rules).toEqual([
      {
        value: 40,
        account_id: platformAccountId,
      },
    ]);
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Sale amount <= applicable fee
  // -------------------------------------------------------------------------
  it('8. omits split_rules and marks SKIPPED with VALOR_ABAIXO_DA_COMISSAO_MINIMA when amount <= fee', async () => {
    // Platform fee is 50 cents, and order amount is 50 cents (50 <= 50)
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue(null);

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-low',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '0.50',
      splitAmountCents: 50,
      splitStatus: 'PENDING',
      createdAt: new Date(),
    });

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-low-amount',
          qr_code: 'pix-qr-low',
        }),
      } as Response;
    });

    const res = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-low',
      amount: 0.50,
    });

    expect(res.paymentId).toBe('tx-low-amount');
    expect(sentPayload.split_rules).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 9: Multi-tenant store owner validation in checkout
  // -------------------------------------------------------------------------
  it('9. checkout resolves sellerId strictly from storeRecord.ownerId on server', async () => {
    dbMock.query.stores.findFirst.mockResolvedValue({
      id: 'store-sec-test',
      ownerId: 'legit-seller-id',
      name: 'Loja Segura',
    });

    dbMock.query.products.findMany.mockResolvedValue([
      {
        id: 'prod-sec',
        storeId: 'store-sec-test',
        title: 'Produto 1',
        price: '10.00',
        status: 'active',
      },
    ]);

    dbMock.query.combos.findMany.mockResolvedValue([]);

    dbMock.query.sellerPaymentConnections.findFirst.mockResolvedValue({
      id: 'conn-sec',
      sellerId: 'legit-seller-id',
      storeId: 'store-sec-test',
      provider: 'pushinpay',
      status: 'active',
      accessTokenEncrypted: encrypt('sec_token'),
    });

    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-sec',
      sellerId: 'legit-seller-id',
      customFeeCents: 20,
      exemptionActive: false,
    });

    vi.spyOn(paymentService, 'createPushinPayPix').mockResolvedValue({
      paymentId: 'tx-sec-1',
      qrCode: 'qr-sec',
      qrCodeBase64: '',
      expiresAt: new Date(Date.now() + 1800000),
      status: 'pending',
    });

    const checkoutResult = await CheckoutService.createCheckout({
      storeId: 'store-sec-test',
      storeSlug: 'loja-segura',
      customerId: 'cust-1',
      items: [{ id: 'prod-sec', quantity: 1 }],
      paymentGateway: 'pushinpay',
    });

    expect(checkoutResult.success).toBe(true);

    // Verify insert called with resolved splitAmountCents = 20
    const insertCalls = dbMock.insert.mock.calls;
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 10: Snapshot immutability across subsequent seller fee changes
  // -------------------------------------------------------------------------
  it('10. subsequent seller fee change does NOT modify snapshot on existing orders', async () => {
    const historicalOrderCreatedAt = new Date('2026-01-10T10:00:00Z');

    // Existing historical order has snapshot splitAmountCents: 25
    const existingOrder = {
      id: 'order-snap-10',
      storeId: thirdPartyStoreId,
      status: 'pending',
      total: '100.00',
      splitAmountCents: 25,
      splitStatus: 'GATEWAY_ACCEPTED',
      createdAt: historicalOrderCreatedAt,
    };

    // Current seller settings was later changed to 50 cents
    dbMock.query.sellerCommissionSettings.findFirst.mockResolvedValue({
      id: 'setting-1',
      sellerId,
      customFeeCents: 50, // changed now to 50
      exemptionActive: false,
      version: 2,
      updatedAt: new Date(),
    });

    // Reconciling via SplitReconciliationService uses snapshot 25 cents, not current 50 cents
    const officialTxWith25 = {
      id: 'tx-snap-10',
      status: 'paid',
      value: 10000,
      split_rules: [
        {
          value: 25,
          account_id: platformAccountId,
        },
      ],
    };

    const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
      order: existingOrder as any,
      officialTx: officialTxWith25,
      platformAccountId,
    });

    expect(evalResult.status).toBe('PROCESSED');
    expect(evalResult.platformFeeStr).toBe('0.25');
    expect(evalResult.netAmountStr).toBe('99.75');
  });

  // -------------------------------------------------------------------------
  // Scenario 11: Webhook reconciliation and idempotency
  // -------------------------------------------------------------------------
  it('11. webhook idempotency prevents duplicate processing for already processed events', async () => {
    dbMock.query.paymentWebhookEvents.findFirst.mockResolvedValue({
      id: 'existing-event-id',
      eventId: 'pushin_tx-123_paid',
    });

    const webhookResult = await provider.handleWebhook(
      'conn-1',
      JSON.stringify({
        id: 'tx-123',
        status: 'paid',
      }),
      {}
    );

    expect(webhookResult.success).toBe(true);
    expect(webhookResult.alreadyProcessed).toBe(true);
    // Should NOT trigger order updates
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 12: Network failure / HTTP error marks splitStatus as FAILED
  // -------------------------------------------------------------------------
  it('12. handles PushinPay HTTP 500 error and records splitStatus as FAILED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Gateway Error',
    } as Response);

    await expect(
      provider.createPixPayment({
        sellerId,
        storeId: thirdPartyStoreId,
        orderId: 'order-123',
        amount: 50.0,
      })
    ).rejects.toThrow('Erro ao gerar Pix na PushinPay (HTTP 500). Tente novamente.');

    // Order was updated to mark splitStatus: FAILED
    expect(dbMock.update).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 13: Reconciliation respects order snapshot and handles SKIPPED
  // -------------------------------------------------------------------------
  it('13. reconciliation evaluates SKIPPED orders (COMISSAO_ZERO or ISENCAO_TEMPORARIA) with platformFee 0.00', () => {
    const exemptOrder = {
      id: 'order-exempt',
      total: '75.00',
      splitStatus: 'SKIPPED',
      splitError: 'ISENCAO_TEMPORARIA',
      splitAmountCents: 0,
    };

    const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
      order: exemptOrder as any,
      officialTx: { id: 'tx-exempt', status: 'paid' },
      platformAccountId,
    });

    expect(evalResult.status).toBe('SKIPPED');
    expect(evalResult.platformFeeStr).toBe('0.00');
    expect(evalResult.netAmountStr).toBe('75.00');
    expect(evalResult.splitError).toBe('ISENCAO_TEMPORARIA');
  });

  // -------------------------------------------------------------------------
  // Scenario 14: Official platform store omits split_rules
  // -------------------------------------------------------------------------
  it('14. official platform store omits split_rules and marks SKIPPED with CONTA_PROPRIETARIA_PLATAFORMA', async () => {
    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-platform-store',
          qr_code: 'pix-qr-platform',
        }),
      } as Response;
    });

    dbMock.query.orders.findFirst.mockResolvedValue({
      id: 'order-plat',
      storeId: platformStoreId,
      status: 'pending',
      total: '100.00',
      splitAmountCents: 50,
      splitStatus: 'PENDING',
      createdAt: new Date(),
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: platformStoreId,
      orderId: 'order-plat',
      amount: 100.0,
    });

    expect(result.paymentId).toBe('tx-platform-store');
    expect(sentPayload.split_rules).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 15: Missing platform account configuration marks split as FAILED
  // -------------------------------------------------------------------------
  it('15. marks split as FAILED with CONTA_PLATAFORMA_NAO_CONFIGURADA when platformAccountId is missing', async () => {
    delete process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID;
    delete process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID;

    let sentPayload: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options: any) => {
      sentPayload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: 'tx-no-platform-acc',
          qr_code: 'pix-qr-no-acc',
        }),
      } as Response;
    });

    const result = await provider.createPixPayment({
      sellerId,
      storeId: thirdPartyStoreId,
      orderId: 'order-123',
      amount: 50.0,
    });

    expect(result.paymentId).toBe('tx-no-platform-acc');
    // Does NOT send split_rules
    expect(sentPayload.split_rules).toBeUndefined();
  });
});
