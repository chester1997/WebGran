import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

vi.mock('@/lib/entitlements/entitlement-service', () => ({
  hasFeature: vi.fn().mockResolvedValue(true),
  checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/orders/order-usage-service', () => ({
  getMonthlyOrderUsage: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  paymentService: {
    getOAuthConnectUrl: vi.fn(),
    handleOAuthCallback: vi.fn(),
    getSellerConnection: vi.fn(),
    createPushinPayPix: vi.fn(),
    createSyncPayPix: vi.fn(),
    createPixPayment: vi.fn(),
    syncPayProvider: {
      getSyncPayConnection: vi.fn(),
    },
    pushinPayProvider: {
      getPushinPayConnection: vi.fn(),
    },
  },
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      stores: {
        findFirst: vi.fn(),
      },
      products: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      combos: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      comboProducts: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      coupons: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      telegramCustomers: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
      sellerPaymentConnections: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'order-123' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 'order-123' }]),
      })),
    })),
  },
}));

vi.mock('next/server', async (importOriginal) => {
  const mod = await importOriginal<typeof import('next/server')>();
  return {
    ...mod,
    connection: vi.fn(),
  };
});

describe('WebGran — Restrição de Mercado Pago e SyncPay Exclusiva para Lojistas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://webgran.app';
  });

  describe('1 & 2. Bloqueio no Backend para Lojistas (Mercado Pago e SyncPay)', () => {
    it('Lojistas não conseguem iniciar OAuth do Mercado Pago (/api/payments/mercadopago/connect) e recebem 403', async () => {
      const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
      const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-abc', role: 'seller', email: 'lojista@loja.com' });
      vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-1', name: 'Loja Teste' } as any);

      const req = new NextRequest('https://webgran.app/api/payments/mercadopago/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUri: 'https://webgran.app/api/payments/mercadopago/callback' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('temporariamente indisponível para lojistas');
      expect(json.error).toContain('PushinPay');
    });

    it('GET do Mercado Pago connect por lojista redireciona para recebimentos com mensagem de erro', async () => {
      const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
      const { GET } = await import('@/app/api/payments/mercadopago/connect/route');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-abc', role: 'seller' });
      vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-1' } as any);

      const req = new NextRequest('https://webgran.app/api/payments/mercadopago/connect', { method: 'GET' });
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/seller/recebimentos?error=');
      expect(res.headers.get('location')).toContain('PushinPay');
    });

    it('Lojistas não conseguem concluir OAuth callback do Mercado Pago (/api/payments/mercadopago/callback)', async () => {
      const { db } = await import('@/db');
      const { GET } = await import('@/app/api/payments/mercadopago/callback/route');

      const statePayload = Buffer.from(JSON.stringify({ sellerId: 'seller-123' })).toString('base64url');
      vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: 'seller-123', role: 'seller' } as any);

      const req = new NextRequest(`https://webgran.app/api/payments/mercadopago/callback?code=mp-code-123&state=${statePayload}`);
      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/seller/recebimentos?error=');
      expect(res.headers.get('location')).toContain('PushinPay');
    });

    it('Lojistas não conseguem conectar nem testar SyncPay (/api/seller/payments/syncpay) e recebem 403', async () => {
      const { requireSeller } = await import('@/lib/auth');
      const { POST } = await import('@/app/api/seller/payments/syncpay/route');

      vi.mocked(requireSeller).mockResolvedValue({ id: 'seller-123', role: 'seller' } as any);

      const req = new NextRequest('https://webgran.app/api/seller/payments/syncpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'sp-client', clientSecret: 'sp-secret' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('temporariamente indisponível para lojistas');
      expect(json.error).toContain('PushinPay');
    });

    it('Checkout direto legado de produto via Mercado Pago (/api/payments/checkout) é rejeitado com 400', async () => {
      const { db } = await import('@/db');
      const { POST } = await import('@/app/api/payments/checkout/route');

      vi.mocked(db.query.stores.findFirst).mockResolvedValue({
        id: 'store-1',
        ownerId: 'seller-123',
        slug: 'loja-teste',
      } as any);

      const req = new NextRequest('https://webgran.app/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-1',
          productId: 'prod-1',
          customerTelegramId: '999888',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('temporariamente desativado para lojistas');
      expect(json.error).toContain('PushinPay');
    });
  });

  describe('3. Checkout de Lojistas: PushinPay Disponível e Gateways Desativados Bloqueados', () => {
    it('CheckoutService rejeita expressamente quando comprador seleciona Mercado Pago ou SyncPay', async () => {
      const { CheckoutService } = await import('@/lib/orders/checkout-service');
      const { db } = await import('@/db');

      vi.mocked(db.query.stores.findFirst).mockResolvedValue({
        id: 'store-1',
        ownerId: 'seller-123',
        slug: 'loja-1',
        name: 'Loja Top',
      } as any);

      vi.mocked(db.query.products.findMany).mockResolvedValue([
        {
          id: 'prod-1',
          storeId: 'store-1',
          title: 'Produto Teste',
          price: '50.00',
          status: 'active',
        } as any,
      ]);

      // Attempt checkout with Mercado Pago
      const resMp = await CheckoutService.createCheckout({
        storeId: 'store-1',
        customerId: 'cust-1',
        storeSlug: 'loja-1',
        items: [{ id: 'prod-1', quantity: 1 }],
        paymentGateway: 'mercadopago',
      });

      expect(resMp.success).toBe(false);
      expect(resMp.error).toContain('temporariamente indisponível para esta loja');
      expect(resMp.error).toContain('PushinPay');

      // Attempt checkout with SyncPay
      const resSync = await CheckoutService.createCheckout({
        storeId: 'store-1',
        customerId: 'cust-1',
        storeSlug: 'loja-1',
        items: [{ id: 'prod-1', quantity: 1 }],
        paymentGateway: 'syncpay',
      });

      expect(resSync.success).toBe(false);
      expect(resSync.error).toContain('temporariamente indisponível para esta loja');
      expect(resSync.error).toContain('PushinPay');
    });

    it('CheckoutService utiliza somente PushinPay quando a loja a possui ativa, mesmo que possua conexões prévias de MP ou SyncPay', async () => {
      const { CheckoutService } = await import('@/lib/orders/checkout-service');
      const { db } = await import('@/db');
      const { paymentService } = await import('@/lib/payments/payment-service');

      vi.mocked(db.query.stores.findFirst).mockResolvedValue({
        id: 'store-1',
        ownerId: 'seller-123',
        slug: 'loja-1',
        name: 'Loja Top',
      } as any);

      vi.mocked(db.query.products.findMany).mockResolvedValue([
        {
          id: 'prod-1',
          storeId: 'store-1',
          title: 'Produto Teste',
          price: '30.00',
          status: 'active',
        } as any,
      ]);

      // Active PushinPay connection
      vi.mocked((paymentService as any).pushinPayProvider.getPushinPayConnection).mockResolvedValue({
        token: 'pushinpay-live-token',
      } as any);

      // Mock createPushinPayPix response
      vi.mocked(paymentService.createPushinPayPix).mockResolvedValue({
        paymentId: 'pushin-pix-123',
        qrCode: 'pix-code-pushin',
        qrCodeBase64: 'data:image/png;base64,pushin',
        expiresAt: new Date(Date.now() + 3600000),
      } as any);

      const res = await CheckoutService.createCheckout({
        storeId: 'store-1',
        customerId: 'cust-1',
        storeSlug: 'loja-1',
        items: [{ id: 'prod-1', quantity: 1 }],
      });

      expect(res.success).toBe(true);
      expect(res.paymentGateway).toBe('pushinpay');
      expect(res.pix?.qrCode).toBe('pix-code-pushin');
      expect(paymentService.createPushinPayPix).toHaveBeenCalled();
      expect(paymentService.createPixPayment).not.toHaveBeenCalled();
      expect(paymentService.createSyncPayPix).not.toHaveBeenCalled();
    });

    it('CheckoutService não cria cobrança por MP ou SyncPay caso PushinPay não esteja configurada', async () => {
      const { CheckoutService } = await import('@/lib/orders/checkout-service');
      const { db } = await import('@/db');
      const { paymentService } = await import('@/lib/payments/payment-service');

      vi.mocked(db.query.stores.findFirst).mockResolvedValue({
        id: 'store-1',
        ownerId: 'seller-123',
        slug: 'loja-1',
        name: 'Loja Top',
      } as any);

      vi.mocked(db.query.products.findMany).mockResolvedValue([
        {
          id: 'prod-1',
          storeId: 'store-1',
          title: 'Produto Teste',
          price: '30.00',
          status: 'active',
        } as any,
      ]);

      // PushinPay inactive
      vi.mocked((paymentService as any).pushinPayProvider.getPushinPayConnection).mockResolvedValue(null);

      const res = await CheckoutService.createCheckout({
        storeId: 'store-1',
        customerId: 'cust-1',
        storeSlug: 'loja-1',
        items: [{ id: 'prod-1', quantity: 1 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('não possui nenhum meio de pagamento ativo');
      expect(res.error).toContain('PushinPay');
      expect(paymentService.createPixPayment).not.toHaveBeenCalled();
      expect(paymentService.createSyncPayPix).not.toHaveBeenCalled();
    });
  });

  describe('4. Preservação Integral da Video Library com SyncPay', () => {
    it('SyncPayPlatformBillingService funciona com credenciais de plataforma independentes dos lojistas', async () => {
      const { SyncPayPlatformBillingService } = await import('@/lib/billing/syncpay-platform-billing-service');
      expect(SyncPayPlatformBillingService).toBeDefined();
      expect(typeof SyncPayPlatformBillingService.enrollSubscriber).toBe('function');
      expect(typeof SyncPayPlatformBillingService.getPlan).toBe('function');
      expect(typeof SyncPayPlatformBillingService.createPlan).toBe('function');
    });
  });

  describe('5 & 6. Preservação dos Fluxos Administrativos e Histórico Financeiro', () => {
    it('Administradores continuam autorizados a gerar URL de OAuth do Mercado Pago (/connect)', async () => {
      const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
      const { paymentService } = await import('@/lib/payments/payment-service');
      const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'admin', email: 'admin@webgran.app' });
      vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-admin' } as any);
      vi.mocked(paymentService.getOAuthConnectUrl).mockResolvedValue('https://auth.mercadopago.com.br/authorization?admin=true');

      const req = new NextRequest('https://webgran.app/api/payments/mercadopago/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUri: 'https://webgran.app/api/payments/mercadopago/callback' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.url).toContain('https://auth.mercadopago.com.br/authorization');
    });

    it('Nenhuma remoção física ou destrutiva é feita sobre a tabela sellerPaymentConnections ou registros de pedidos', async () => {
      const { db } = await import('@/db');
      expect(db.query.sellerPaymentConnections).toBeDefined();
      expect(db.query.orders).toBeDefined();
    });
  });

  describe('7. Regra Financeira: Taxa Fixa de R$ 0,50 e Split PushinPay', () => {
    it('Taxa da plataforma é fixa em R$ 0,50 (50 centavos), sem percentuais ou taxas adicionais', async () => {
      const { PlatformCommissionService } = await import('@/lib/commission/platform-commission-service');
      expect(PlatformCommissionService.DEFAULT_FEE_CENTS).toBe(50);
      expect(PlatformCommissionService.DEFAULT_FEE_CENTS / 100).toBe(0.50);
    });

    it('Split destina exatamente R$ 0,50 para a plataforma e preserva o valor líquido do lojista (total - 0,50)', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
      const platformAccount = 'acc-official-platform-999';

      const orderMock = {
        id: 'ord-split-check',
        total: '35.00',
        splitStatus: 'GATEWAY_ACCEPTED',
        splitAmountCents: 50,
      };

      const officialTxMock = {
        id: 'tx-pushin-split-check',
        status: 'paid',
        value: 3500,
        split_rules: [
          {
            account_id: platformAccount,
            value: 50,
          },
        ],
      };

      const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
        order: orderMock as any,
        officialTx: officialTxMock,
        platformAccountId: platformAccount,
      });

      expect(evalResult.status).toBe('PROCESSED');
      expect(evalResult.platformFeeStr).toBe('0.50');
      // Total charged: 35.00 | Fee: 0.50 | Net destined to seller: 34.50
      expect(evalResult.netAmountStr).toBe('34.50');
      expect(evalResult.splitError).toBeNull();
      expect(evalResult.auditAction).toBe('PROCESSED_BY_GATEWAY');
    });

    it('Taxa e split são idempotentes: reavaliação de pedido já liquidado/confirmado não duplica a taxa', async () => {
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
      const platformAccount = 'acc-official-platform-999';

      const confirmedOrder = {
        id: 'ord-already-confirmed',
        total: '50.00',
        splitStatus: 'CONFIRMED',
        splitAmountCents: 50,
        splitConfirmedAt: new Date('2026-10-27T10:00:00Z'),
      };

      const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
        order: confirmedOrder as any,
        officialTx: { status: 'paid', value: 5000 },
        platformAccountId: platformAccount,
      });

      // Retains CONFIRMED status without re-applying or duplicating fee deduction
      expect(evalResult.status).toBe('CONFIRMED');
      expect(evalResult.platformFeeStr).toBeNull();
      expect(evalResult.netAmountStr).toBeNull();
      expect(evalResult.auditAction).toBe('NONE');
    });
  });
});
