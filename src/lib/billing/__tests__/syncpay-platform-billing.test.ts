import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/db', () => {
  return {
    db: {
      query: {
        systemSettings: {
          findFirst: vi.fn(),
        },
        subscriptions: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        invoices: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(),
        })),
      })),
    },
    systemSettings: {
      key: 'key',
    },
    subscriptions: {
      syncpaySubscriptionToken: 'syncpay_subscription_token',
      id: 'id',
    },
    invoices: {
      subscriptionId: 'subscription_id',
      status: 'status',
      id: 'id',
    },
    paymentWebhookEvents: {},
  };
});

import { SyncPayPlatformBillingService } from '../syncpay-platform-billing-service';
import { SyncPayPlatformBillingReconciliationService } from '../syncpay-platform-reconciliation-service';
import { SyncPayAuthService } from '@/lib/payments/providers/syncpay';

describe('SyncPay Platform Billing Integration & Isolation Tests', () => {
  const mockClientId = 'platform_client_123';
  const mockClientSecret = 'platform_secret_abc';

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SYNCPAY_PLATFORM_CLIENT_ID = mockClientId;
    process.env.SYNCPAY_PLATFORM_CLIENT_SECRET = mockClientSecret;
    SyncPayAuthService.invalidateCache(mockClientId, mockClientSecret);
  });

  afterEach(() => {
    delete process.env.SYNCPAY_PLATFORM_CLIENT_ID;
    delete process.env.SYNCPAY_PLATFORM_CLIENT_SECRET;
  });

  describe('1. Platform Credentials Isolation', () => {
    it('resolves platform credentials strictly from SYNCPAY_PLATFORM_CLIENT_ID / SECRET', async () => {
      const creds = await SyncPayPlatformBillingService.getPlatformCredentials();
      expect(creds.clientId).toBe(mockClientId);
      expect(creds.clientSecret).toBe(mockClientSecret);
    });

    it('throws explicit error if platform credentials are missing', async () => {
      delete process.env.SYNCPAY_PLATFORM_CLIENT_ID;
      delete process.env.SYNCPAY_PLATFORM_CLIENT_SECRET;

      await expect(SyncPayPlatformBillingService.getPlatformCredentials()).rejects.toThrow(
        /Credenciais da plataforma SyncPay não configuradas/
      );
    });
  });

  describe('2. Authentication & Token Cache', () => {
    it('caches access token in memory for platform requests', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('auth-token')) {
          return new Response(JSON.stringify({ access_token: 'platform_token_xyz', expires_in: 3600 }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      });

      const token1 = await SyncPayAuthService.getAccessToken(mockClientId, mockClientSecret);
      const token2 = await SyncPayAuthService.getAccessToken(mockClientId, mockClientSecret);

      expect(token1).toBe('platform_token_xyz');
      expect(token2).toBe('platform_token_xyz');
      // Auth URL should only be fetched ONCE due to caching
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache and retries on HTTP 401', async () => {
      let authCalls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const u = typeof url === 'string' ? url : (url as Request).url;
        if (u.includes('auth-token')) {
          authCalls++;
          return new Response(JSON.stringify({ access_token: `token_v${authCalls}`, expires_in: 3600 }), { status: 200 });
        }
        if (u.includes('subscription-plans') && authCalls === 1) {
          return new Response('Unauthorized', { status: 401 });
        }
        return new Response(JSON.stringify({ data: [{ id: 'plan_123' }] }), { status: 200 });
      });

      const plans = await SyncPayPlatformBillingService.listPlans();
      expect(plans).toEqual({ data: [{ id: 'plan_123' }] });
      expect(authCalls).toBe(2);
    });
  });

  describe('3. Plan Creation & Subscriber Enrollment', () => {
    it('creates a platform plan via POST /api/partner/v1/subscription-plans', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        const u = typeof url === 'string' ? url : (url as Request).url;
        if (u.includes('auth-token')) {
          return new Response(JSON.stringify({ access_token: 'token_123' }), { status: 200 });
        }
        if (u.includes('subscription-plans') && options?.method === 'POST') {
          return new Response(
            JSON.stringify({
              data: {
                token: 'syncpay_plan_token_999',
                checkout_url: 'https://checkout.syncpayments.com.br/plan999',
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 400 });
      });

      const res = await SyncPayPlatformBillingService.createPlan({
        name: 'WebGran SaaS',
        amount: 89.9,
        billing_method: 'qr_code',
      });

      expect(res.token).toBe('syncpay_plan_token_999');
      expect(res.checkout_url).toBe('https://checkout.syncpayments.com.br/plan999');
    });

    it('enrolls a subscriber via POST /api/partner/v1/subscription-plans/{planToken}/enroll', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        const u = typeof url === 'string' ? url : (url as Request).url;
        if (u.includes('auth-token')) {
          return new Response(JSON.stringify({ access_token: 'token_123' }), { status: 200 });
        }
        if (u.includes('enroll')) {
          return new Response(
            JSON.stringify({
              data: {
                subscription_token: 'sub_tok_007',
                subscriber_token: 'user_tok_007',
                status: 'pending_first_payment',
                first_cycle: {
                  pix_code: '00020126580014br.gov.bcb.pix...',
                  qr_code: 'https://syncpay.com/qr/007.png',
                },
              },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 400 });
      });

      const enroll = await SyncPayPlatformBillingService.enrollSubscriber('plan_tok_999', {
        name: 'Vendedor Teste',
        email: 'vendedor@teste.com',
        document: '123.456.789-00',
      });

      expect(enroll.subscriptionToken).toBe('sub_tok_007');
      expect(enroll.subscriberToken).toBe('user_tok_007');
      expect(enroll.status).toBe('pending_first_payment');
      expect(enroll.pixCode).toBe('00020126580014br.gov.bcb.pix...');
    });
  });

  describe('4. Status Mapping & Reconciliation', () => {
    it('correctly maps SyncPay status strings to WebGran local status', () => {
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('active')).toBe('ACTIVE');
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('paid')).toBe('ACTIVE');
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('overdue')).toBe('PAST_DUE');
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('em_atraso')).toBe('PAST_DUE');
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('suspended')).toBe('SUSPENDED');
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('cancelled')).toBe('CANCELLED');
      expect(SyncPayPlatformBillingReconciliationService.mapStatus('pending_first_payment')).toBe('PENDING');
    });
  });

  describe('5. Platform Operations (Suspend, Reactivate, Cancel, Resend Charge)', () => {
    it('sends PATCH request to cancel subscription with reason', async () => {
      let patchMethod = '';
      let patchBody: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        const u = typeof url === 'string' ? url : (url as Request).url;
        if (u.includes('auth-token')) {
          return new Response(JSON.stringify({ access_token: 'token_123' }), { status: 200 });
        }
        if (u.includes('cancel')) {
          patchMethod = options?.method || '';
          patchBody = JSON.parse(options?.body as string || '{}');
          return new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 400 });
      });

      const res = await SyncPayPlatformBillingService.cancelSubscription('sub_123', 'Inadimplência');
      expect(patchMethod).toBe('PATCH');
      expect(patchBody).toEqual({ reason: 'Inadimplência' });
      expect(res).toEqual({ status: 'cancelled' });
    });
  });
});
