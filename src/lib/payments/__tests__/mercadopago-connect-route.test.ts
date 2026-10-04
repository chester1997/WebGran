import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks for Auth & Entitlements
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getCurrentStore: vi.fn(),
}));

vi.mock('@/lib/entitlements/entitlement-service', () => ({
  hasFeature: vi.fn(),
}));

vi.mock('@/lib/payments/payment-service', () => ({
  paymentService: {
    getOAuthConnectUrl: vi.fn(),
  },
}));

vi.mock('next/server', async (importOriginal) => {
  const mod = await importOriginal<typeof import('next/server')>();
  return {
    ...mod,
    connection: vi.fn(),
  };
});

describe('Mercado Pago OAuth Seller Connect API Route Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.MP_CLIENT_ID = 'test_app_id';
    process.env.NEXT_PUBLIC_APP_URL = 'https://webgran.online';
  });

  it('1. POST autenticado retorna HTTP 200 com JSON contendo success: true e url OAuth', async () => {
    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { paymentService } = await import('@/lib/payments/payment-service');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-123', role: 'seller', email: 'seller@test.com' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-123', name: 'Minha Loja' } as any);
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(paymentService.getOAuthConnectUrl).mockResolvedValue('https://auth.mercadopago.com/authorization?client_id=test_app_id');

    const req = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri: 'https://webgran.online/api/payments/mercadopago/callback' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.url).toContain('https://auth.mercadopago.com/authorization');
  });

  it('2. POST com seller não autenticado é rejeitado com HTTP 401', async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue(undefined as any);

    const req = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Não autorizado');
  });

  it('3. GET continua funcionando e retorna Redirect 307/302 para a mesma URL OAuth', async () => {
    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { paymentService } = await import('@/lib/payments/payment-service');
    const { GET, POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-123', role: 'seller' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-123' } as any);
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(paymentService.getOAuthConnectUrl).mockResolvedValue('https://auth.mercadopago.com/authorization?client_id=test_app_id&state=xyz');

    const getReq = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', { method: 'GET' });
    const getRes = await GET(getReq);

    expect(getRes.status).toBe(307); // NextResponse.redirect default
    expect(getRes.headers.get('location')).toBe('https://auth.mercadopago.com/authorization?client_id=test_app_id&state=xyz');

    const postReq = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', { method: 'POST' });
    const postRes = await POST(postReq);
    const postBody = await postRes.json();

    expect(postBody.url).toBe(getRes.headers.get('location'));
  });

  it('4. POST sem feature entitlement de gateway retorna HTTP 403', async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-123', role: 'seller' });
    vi.mocked(hasFeature).mockResolvedValue(false);

    const req = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Gateways de pagamento não estão disponíveis');
  });
});
