import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { encrypt } from '@/lib/encryption';

// Mock dependencies
vi.mock('next/server', async (importOriginal) => {
  const mod = await importOriginal<typeof import('next/server')>();
  return {
    ...mod,
    connection: vi.fn(),
  };
});

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

vi.mock('@/lib/delivery/access-delivery-service', () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/db', () => {
  const mockDb = {
    query: {
      users: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      products: { findFirst: vi.fn(), findMany: vi.fn() },
      combos: { findMany: vi.fn().mockResolvedValue([]) },
      comboProducts: { findMany: vi.fn().mockResolvedValue([]) },
      coupons: { findFirst: vi.fn().mockResolvedValue(null) },
      telegramCustomers: { findFirst: vi.fn() },
      orders: { findFirst: vi.fn() },
      sellerPaymentConnections: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      accesses: { findMany: vi.fn().mockResolvedValue([]) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'order-mp-123' }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: 'conn-1' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 'updated-1' }]),
      })),
    })),
  };
  return { db: mockDb };
});

describe('WebGran — Integração Completa do Mercado Pago para Lojistas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://webgran.app';
    process.env.MP_CLIENT_ID = 'test-client-id';
    process.env.MP_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXTAUTH_SECRET = 'super-secret-key-32-chars-long!';
  });

  // 1. Exibir o Mercado Pago como disponível quando o recurso estiver habilitado
  it('1. Exibir o Mercado Pago como disponível quando o recurso estiver habilitado', async () => {
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    vi.mocked(hasFeature).mockResolvedValue(true);

    const isAvailable = await hasFeature('seller-123', 'payment_gateways_enabled');
    expect(isAvailable).toBe(true);

    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-123', role: 'seller' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-1', name: 'Loja' } as any);

    const req = new NextRequest('https://webgran.app/api/payments/mercadopago/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri: 'https://webgran.app/api/payments/mercadopago/callback' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.url).toContain('auth.mercadopago.com');
  });

  // 2. Impedir o uso quando a conta ainda não estiver conectada
  it('2. Impedir o uso quando a conta ainda não estiver conectada', async () => {
    const { CheckoutService } = await import('@/lib/orders/checkout-service');
    const { db } = await import('@/db');

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: 'store-1',
      ownerId: 'seller-without-mp',
      slug: 'loja-sem-mp',
      name: 'Loja Sem MP',
    } as any);

    vi.mocked(db.query.products.findMany).mockResolvedValue([
      { id: 'prod-1', storeId: 'store-1', title: 'Prod', price: '25.00', status: 'active' } as any,
    ]);

    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue(null as any);

    const res = await CheckoutService.createCheckout({
      storeId: 'store-1',
      customerId: 'cust-1',
      storeSlug: 'loja-sem-mp',
      items: [{ id: 'prod-1', quantity: 1 }],
      paymentGateway: 'mercadopago',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('O Mercado Pago não está conectado ou ativo para esta loja.');
  });

  // 3. Completar o fluxo de autorização e callback (com troca de código por tokens)
  it('3. Completar o fluxo de autorização e callback (com troca de código por tokens)', async () => {
    const { MercadoPagoProvider } = await import('@/lib/payments/providers/mercado-pago');
    const { db } = await import('@/db');

    const provider = new MercadoPagoProvider();

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.mercadopago.com/oauth/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: 'APP_USR-seller-token-123456',
            refresh_token: 'TG-refresh-token-123',
            user_id: 99887766,
            public_key: 'APP_USR-public-key',
            live_mode: true,
          }),
        });
      }
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ email: 'lojista@mercadopago.com', id: 99887766 }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as any;

    try {
      const connectUrl = await provider.connectSeller('seller-xyz', 'https://webgran.app/api/payments/mercadopago/callback');
      const stateParam = new URL(connectUrl).searchParams.get('state')!;
      expect(stateParam).toBeTruthy();

      const result = await provider.handleOAuthCallback(
        'valid-auth-code',
        'https://webgran.app/api/payments/mercadopago/callback',
        stateParam
      );

      expect(result.sellerId).toBe('seller-xyz');
      expect(db.insert).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 4. Rejeitar estados OAuth inválidos ou adulterados (CSRF)
  it('4. Rejeitar estados OAuth inválidos ou adulterados (CSRF)', async () => {
    const { MercadoPagoProvider } = await import('@/lib/payments/providers/mercado-pago');
    const provider = new MercadoPagoProvider();

    // 1. Estado sem assinatura válida
    const tamperedPayload = Buffer.from(JSON.stringify({ sellerId: 'hacker', ts: Date.now() })).toString('base64url');
    const invalidSignatureState = `${tamperedPayload}.invalid_signature`;

    await expect(
      provider.handleOAuthCallback('code-123', 'https://webgran.app/callback', invalidSignatureState)
    ).rejects.toThrow('falha na validação CSRF');

    // 2. Estado expirado (> 30 min)
    const secret = process.env.NEXTAUTH_SECRET || process.env.MP_CLIENT_SECRET || 'webgran-mp-oauth-secret';
    const expiredPayload = Buffer.from(JSON.stringify({ sellerId: 'seller-old', ts: Date.now() - 40 * 60 * 1000 })).toString('base64url');
    const expiredSig = crypto.createHmac('sha256', secret).update(expiredPayload).digest('hex');
    const expiredState = `${expiredPayload}.${expiredSig}`;

    await expect(
      provider.handleOAuthCallback('code-123', 'https://webgran.app/callback', expiredState)
    ).rejects.toThrow('tempo limite de 30 minutos excedido');
  });

  // 5. Impedir acesso cruzado entre lojistas (multi-tenant isolation)
  it('5. Impedir acesso cruzado entre lojistas (multi-tenant isolation)', async () => {
    const { MercadoPagoProvider } = await import('@/lib/payments/providers/mercado-pago');
    const { db } = await import('@/db');
    const provider = new MercadoPagoProvider();

    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue(null as any);

    const connSellerA = await provider.getSellerConnection('seller-A');
    expect(connSellerA).toBeNull();

    // Test connection endpoint validates seller session
    const { requireSeller } = await import('@/lib/auth');
    const { POST: testPost } = await import('@/app/api/seller/payments/mercadopago/test/route');

    vi.mocked(requireSeller).mockResolvedValue({ id: 'seller-A', role: 'seller' } as any);
    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue(null as any);

    const testReq = new NextRequest('https://webgran.app/api/seller/payments/mercadopago/test', {
      method: 'POST',
    });

    const res = await testPost(testReq);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain('Mercado Pago não conectado para este lojista');
  });

  // 6. Criar uma cobrança usando a conta correta do lojista via /v1/orders
  it('6. Criar uma cobrança usando a conta correta do lojista via /v1/orders', async () => {
    const { MercadoPagoProvider } = await import('@/lib/payments/providers/mercado-pago');
    const { db } = await import('@/db');
    const provider = new MercadoPagoProvider();

    const mockToken = 'APP_USR-SELLER-TOKEN-REAL';
    const encryptedToken = encrypt(mockToken);

    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
      id: 'conn-1',
      sellerId: 'seller-owner-1',
      provider: 'mercadopago',
      status: 'active',
      accessTokenEncrypted: encryptedToken,
    } as any);

    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = init?.headers as any;
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'mp-order-999',
          transactions: {
            payments: [
              {
                id: 'pay-999',
                payment_method: {
                  qr_code: '00020126580014br.gov.bcb.pix...',
                  qr_code_base64: 'iVBORw0KGgoAAAANSUhEUg...',
                },
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              },
            ],
          },
        }),
      });
    }) as any;

    try {
      const pixOrder = await provider.createPixPayment({
        sellerId: 'seller-owner-1',
        orderId: 'order-webgran-123',
        amount: 50.00,
        description: 'Pedido #123 - Loja Alpha',
        customer: { email: 'cliente@teste.com', name: 'João Silva' },
      });

      expect(capturedUrl).toBe('https://api.mercadopago.com/v1/orders');
      expect(capturedHeaders['Authorization']).toBe(`Bearer ${mockToken}`);
      expect(capturedBody.total_amount).toBe('50.00');
      expect(capturedBody.external_reference).toBe('order-webgran-123');
      expect(capturedBody.marketplace_fee).toBe('0.50');
      expect(pixOrder.qrCode).toContain('00020126580014br.gov.bcb.pix');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 7. Processar notificações e webhooks sem duplicar pagamentos (idempotência)
  it('7. Processar notificações e webhooks sem duplicar pagamentos (idempotência)', async () => {
    const { syncOrderWithMercadoPago } = await import('@/lib/payments/order-sync');
    const { db } = await import('@/db');
    const { AccessDeliveryService } = await import('@/lib/delivery/access-delivery-service');

    // Pedido já pago anteriormente (idempotência)
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-already-paid',
      status: 'paid',
      paidAt: new Date(),
    } as any);

    vi.mocked(db.query.accesses.findMany).mockResolvedValue([
      { id: 'acc-1', orderId: 'order-already-paid' } as any,
    ]);

    const res = await syncOrderWithMercadoPago('order-already-paid');

    expect(res.alreadyPaid).toBe(true);
    expect(res.status).toBe('paid');
    expect(db.update).not.toHaveBeenCalled();
    expect(AccessDeliveryService.processOrderDelivery).not.toHaveBeenCalled();
  });

  // 8. Tratar tokens inválidos, desconexões e falhas
  it('8. Tratar tokens inválidos, desconexões e falhas', async () => {
    const { MercadoPagoProvider } = await import('@/lib/payments/providers/mercado-pago');
    const { db } = await import('@/db');
    const provider = new MercadoPagoProvider();

    // 8.1 Falha na conexão de teste com token expirado/revogado
    const encryptedToken = encrypt('REVOKED-TOKEN');

    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
      id: 'conn-revoked',
      sellerId: 'seller-bad',
      provider: 'mercadopago',
      status: 'active',
      accessTokenEncrypted: encryptedToken,
    } as any);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid access token',
    }) as any;

    try {
      await expect(provider.testConnection('seller-bad')).rejects.toThrow(
        'Falha ao validar credenciais com o Mercado Pago'
      );

      // 8.2 Desconexão do lojista
      await provider.disconnectSeller('seller-bad');
      expect(db.update).toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 9. Preservar o funcionamento do PushinPay
  it('9. Preservar o funcionamento do PushinPay', async () => {
    const { CheckoutService } = await import('@/lib/orders/checkout-service');
    const { db } = await import('@/db');
    const { paymentService } = await import('@/lib/payments/payment-service');

    vi.mocked(db.query.stores.findFirst).mockResolvedValue({
      id: 'store-pushin',
      ownerId: 'seller-pushin',
      slug: 'loja-pushin',
      name: 'Loja PushinPay',
    } as any);

    vi.mocked(db.query.products.findMany).mockResolvedValue([
      { id: 'prod-1', storeId: 'store-pushin', title: 'Curso VIP', price: '97.00', status: 'active' } as any,
    ]);

    // PushinPay connection mock
    (paymentService as any).pushinPayProvider = {
      getPushinPayConnection: vi.fn().mockResolvedValue({ token: 'pushinpay-active-token' }),
    };

    paymentService.createPushinPayPix = vi.fn().mockResolvedValue({
      paymentId: 'pushin-order-555',
      qrCode: 'pix-pushin-code',
      qrCodeBase64: 'data:image/png;base64,pushin',
      expiresAt: new Date(Date.now() + 3600000),
    } as any);

    const res = await CheckoutService.createCheckout({
      storeId: 'store-pushin',
      customerId: 'cust-1',
      storeSlug: 'loja-pushin',
      items: [{ id: 'prod-1', quantity: 1 }],
      paymentGateway: 'pushinpay',
    });

    expect(res.success).toBe(true);
    expect(res.paymentGateway).toBe('pushinpay');
    expect(paymentService.createPushinPayPix).toHaveBeenCalled();
  });

  // 10. Preservar o comportamento administrativo do Mercado Pago
  it('10. Preservar o comportamento administrativo do Mercado Pago', async () => {
    const { mercadoPagoPlatformProvider } = await import('@/lib/payments/providers/mercado-pago-platform');
    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    expect(mercadoPagoPlatformProvider).toBeDefined();
    expect(typeof mercadoPagoPlatformProvider.getOAuthConnectUrl).toBe('function');
    expect(typeof mercadoPagoPlatformProvider.saveAccessTokenDirect).toBe('function');
    expect(typeof mercadoPagoPlatformProvider.getPlatformStatus).toBe('function');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-super', role: 'admin' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-admin' } as any);

    const req = new NextRequest('https://webgran.app/api/payments/mercadopago/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri: 'https://webgran.app/api/payments/mercadopago/callback' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.url).toContain('auth.mercadopago.com');
  });
});
