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

  it('1. POST com admin autenticado retorna HTTP 200 com JSON contendo success: true e url OAuth', async () => {
    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { paymentService } = await import('@/lib/payments/payment-service');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-123', role: 'admin', email: 'admin@test.com' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-123', name: 'Minha Loja' } as any);
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(paymentService.getOAuthConnectUrl).mockResolvedValue('https://auth.mercadopago.com.br/authorization?client_id=test_app_id');

    const req = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri: 'https://webgran.online/api/payments/mercadopago/callback' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.url).toContain('https://auth.mercadopago.com.br/authorization');
  });

  it('2. POST com seller é bloqueado com HTTP 403 e mensagem orientando uso da PushinPay', async () => {
    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-123', role: 'seller', email: 'seller@test.com' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-123', name: 'Minha Loja' } as any);
    vi.mocked(hasFeature).mockResolvedValue(true);

    const req = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri: 'https://webgran.online/api/payments/mercadopago/callback' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain('temporariamente indisponível para lojistas');
    expect(body.error).toContain('PushinPay');
  });

  it('3. POST com usuário não autenticado é rejeitado com HTTP 401', async () => {
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

  it('4. GET com admin retorna Redirect para URL OAuth, enquanto GET com seller redireciona com erro', async () => {
    const { getCurrentUser, getCurrentStore } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { paymentService } = await import('@/lib/payments/payment-service');
    const { GET } = await import('@/app/api/payments/mercadopago/connect/route');

    // Admin flow
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-123', role: 'admin' });
    vi.mocked(getCurrentStore).mockResolvedValue({ id: 'store-123' } as any);
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(paymentService.getOAuthConnectUrl).mockResolvedValue('https://auth.mercadopago.com.br/authorization?client_id=test_app_id&state=xyz');

    const adminGetReq = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', { method: 'GET' });
    const adminGetRes = await GET(adminGetReq);

    expect(adminGetRes.status).toBe(307);
    expect(adminGetRes.headers.get('location')).toBe('https://auth.mercadopago.com.br/authorization?client_id=test_app_id&state=xyz');

    // Seller flow (blocked)
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'seller-123', role: 'seller' });
    const sellerGetReq = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', { method: 'GET' });
    const sellerGetRes = await GET(sellerGetReq);

    expect(sellerGetRes.status).toBe(307);
    expect(sellerGetRes.headers.get('location')).toContain('seller/recebimentos?error=');
    expect(sellerGetRes.headers.get('location')).toContain('PushinPay');
  });

  it('5. POST com admin sem feature entitlement de gateway retorna HTTP 403', async () => {
    const { getCurrentUser } = await import('@/lib/auth');
    const { hasFeature } = await import('@/lib/entitlements/entitlement-service');
    const { POST } = await import('@/app/api/payments/mercadopago/connect/route');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-123', role: 'admin' });
    vi.mocked(hasFeature).mockResolvedValue(false);

    const req = new NextRequest('https://webgran.online/api/payments/mercadopago/connect', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Gateways de pagamento não estão disponíveis');
  });
});
