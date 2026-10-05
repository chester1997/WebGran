import { SyncPayAuthService } from '@/lib/payments/providers/syncpay';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SYNCPAY_BASE_URL = 'https://api.syncpayments.com.br';

export interface CreatePlatformPlanParams {
  name: string;
  amount: number;
  billing_method?: 'qr_code' | 'pix_automatico';
  description?: string;
  periodicity_days?: number;
  billing_advance_days?: number;
  grace_period_days?: number;
  max_retry_attempts?: number;
}

export interface EnrollSubscriberParams {
  name: string;
  email: string;
  document: string;
  phone?: string;
}

export interface SyncPayPlatformCredentials {
  clientId: string;
  clientSecret: string;
}

export class SyncPayPlatformBillingService {
  /**
   * Resolves platform-only SyncPay credentials.
   * Priority: ENV vars SYNCPAY_PLATFORM_CLIENT_ID / SYNCPAY_PLATFORM_CLIENT_SECRET
   * Fallback: system_settings table keys 'syncpay_platform_client_id' / 'syncpay_platform_client_secret'
   */
  static async getPlatformCredentials(): Promise<SyncPayPlatformCredentials> {
    const clientIdEnv = process.env.SYNCPAY_PLATFORM_CLIENT_ID?.trim();
    const clientSecretEnv = process.env.SYNCPAY_PLATFORM_CLIENT_SECRET?.trim();

    if (clientIdEnv && clientSecretEnv) {
      return { clientId: clientIdEnv, clientSecret: clientSecretEnv };
    }

    // Fallback to database system settings
    const idSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'syncpay_platform_client_id'),
    });
    const secretSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'syncpay_platform_client_secret'),
    });

    const clientId = idSetting?.value?.trim() || clientIdEnv || '';
    const clientSecret = secretSetting?.value?.trim() || clientSecretEnv || '';

    if (!clientId || !clientSecret) {
      throw new Error(
        'Credenciais da plataforma SyncPay não configuradas. ' +
        'Defina SYNCPAY_PLATFORM_CLIENT_ID e SYNCPAY_PLATFORM_CLIENT_SECRET.'
      );
    }

    return { clientId, clientSecret };
  }

  /**
   * Helper to perform authenticated HTTP requests to SyncPay Platform API.
   * Automatically manages 1-hour token caching, 401 auto-retry, and headers.
   */
  private static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    retryOnAuthFail = true
  ): Promise<T> {
    const creds = await this.getPlatformCredentials();
    const token = await SyncPayAuthService.getAccessToken(creds.clientId, creds.clientSecret);

    const url = endpoint.startsWith('http') ? endpoint : `${SYNCPAY_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401 && retryOnAuthFail) {
      console.warn('[SyncPayPlatformBilling] 401 received. Refreshing platform access token...');
      SyncPayAuthService.invalidateCache(creds.clientId, creds.clientSecret);
      const freshToken = await SyncPayAuthService.getAccessToken(creds.clientId, creds.clientSecret, true);
      headers.Authorization = `Bearer ${freshToken}`;

      const retryRes = await fetch(url, {
        ...options,
        headers,
      });

      if (!retryRes.ok) {
        const errText = await retryRes.text();
        throw new Error(`[SyncPayPlatform] Request failed (${retryRes.status}): ${errText}`);
      }

      return retryRes.json();
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[SyncPayPlatform] Request failed (${res.status}): ${errText}`);
    }

    return res.json();
  }

  /**
   * Lists subscription plans created under the platform account.
   */
  static async listPlans(): Promise<any> {
    return this.request('/api/partner/v1/subscription-plans', { method: 'GET' });
  }

  /**
   * Creates a new subscription plan on SyncPay Platform.
   */
  static async createPlan(params: CreatePlatformPlanParams): Promise<{
    token: string;
    checkout_url?: string;
    raw: any;
  }> {
    const payload = {
      name: params.name,
      amount: params.amount,
      billing_method: params.billing_method || 'qr_code',
      ...(params.description ? { description: params.description } : {}),
      ...(params.periodicity_days ? { periodicity_days: params.periodicity_days } : { periodicity_days: 30 }),
      ...(params.billing_advance_days !== undefined ? { billing_advance_days: params.billing_advance_days } : {}),
      ...(params.grace_period_days !== undefined ? { grace_period_days: params.grace_period_days } : {}),
      ...(params.max_retry_attempts !== undefined ? { max_retry_attempts: params.max_retry_attempts } : {}),
    };

    const res = await this.request('/api/partner/v1/subscription-plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const token = res?.data?.token || res?.token || res?.data?.id || res?.id;
    const checkout_url = res?.data?.checkout_url || res?.checkout_url || res?.data?.url || res?.url;

    if (!token) {
      throw new Error('SyncPay não retornou o token do plano criado.');
    }

    return {
      token,
      checkout_url,
      raw: res,
    };
  }

  /**
   * Fetches details of a specific subscription plan by token.
   */
  static async getPlan(planToken: string): Promise<any> {
    return this.request(`/api/partner/v1/subscription-plans/${planToken}`, { method: 'GET' });
  }

  /**
   * Enrolls a subscriber into a plan via:
   * POST /api/partner/v1/subscription-plans/{planToken}/enroll
   */
  static async enrollSubscriber(
    planToken: string,
    params: EnrollSubscriberParams
  ): Promise<{
    subscriptionToken: string;
    subscriberToken?: string;
    pixCode?: string;
    qrCode?: string;
    dueDate?: string;
    expiresAt?: string;
    status: string;
    amount?: number;
    raw: any;
  }> {
    const payload = {
      name: params.name,
      email: params.email,
      document: params.document.replace(/\D/g, ''),
      ...(params.phone ? { phone: params.phone.replace(/\D/g, '') } : {}),
    };

    const res = await this.request(`/api/partner/v1/subscription-plans/${planToken}/enroll`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = res?.data || res;
    const subscriptionToken = data?.subscription_token || data?.token || data?.id || data?.subscriptionToken;
    const subscriberToken = data?.subscriber_token || data?.subscriber_id || data?.subscriber?.token || data?.subscriberToken;

    if (!subscriptionToken) {
      throw new Error('SyncPay não retornou um token de assinatura (subscription_token) no enroll.');
    }

    // Extract first cycle details
    const firstCycle = data?.first_cycle || data?.charge || data?.current_cycle || data;
    const firstCharge = (data?.charges && data.charges[0]) || {};
    const paymentObj = data?.payment || firstCycle?.payment || firstCharge?.payment || {};
    const pixCode =
      paymentObj?.qr_code_pix ||
      paymentObj?.pix_code ||
      firstCycle?.pix_code ||
      firstCycle?.pix_copia_e_cola ||
      firstCharge?.payment?.pix_code ||
      firstCycle?.br_code ||
      firstCycle?.emv ||
      firstCycle?.qr_code_text;
    const rawQrCode = paymentObj?.qr_code || firstCycle?.qr_code || firstCycle?.qr_code_url || firstCycle?.image_url;
    const qrCode = rawQrCode || (pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}` : undefined);
    const dueDate = firstCycle?.due_date || firstCycle?.dueDate || firstCharge?.due_date;
    const expiresAt = paymentObj?.expires_at || firstCycle?.expires_at || firstCycle?.expiresAt || firstCharge?.expires_at;
    const status = (data?.status || firstCycle?.status || firstCharge?.status || 'pending_first_payment').toLowerCase();
    const amount = firstCycle?.amount || firstCharge?.amount || data?.amount;

    return {
      subscriptionToken,
      subscriberToken,
      pixCode,
      qrCode,
      dueDate,
      expiresAt,
      status,
      amount,
      raw: res,
    };
  }

  /**
   * Queries subscription state from SyncPay:
   * GET /api/partner/v1/subscriptions/{token}
   */
  static async getSubscription(subscriptionToken: string): Promise<any> {
    return this.request(`/api/partner/v1/subscriptions/${subscriptionToken}`, { method: 'GET' });
  }

  /**
   * Suspends a subscription:
   * PATCH /api/partner/v1/subscriptions/{token}/suspend
   */
  static async suspendSubscription(subscriptionToken: string, reason?: string): Promise<any> {
    return this.request(`/api/partner/v1/subscriptions/${subscriptionToken}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason || 'Suspenso pela plataforma WebGran' }),
    });
  }

  /**
   * Reactivates a suspended subscription:
   * PATCH /api/partner/v1/subscriptions/{token}/reactivate
   */
  static async reactivateSubscription(subscriptionToken: string): Promise<any> {
    return this.request(`/api/partner/v1/subscriptions/${subscriptionToken}/reactivate`, {
      method: 'PATCH',
    });
  }

  /**
   * Cancels a subscription:
   * PATCH /api/partner/v1/subscriptions/{token}/cancel
   */
  static async cancelSubscription(subscriptionToken: string, reason?: string): Promise<any> {
    return this.request(`/api/partner/v1/subscriptions/${subscriptionToken}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason || 'Cancelado pelo usuário/plataforma WebGran' }),
    });
  }

  /**
   * Resends current cycle charge (e.g. generates new QR/Pix code):
   * PATCH /api/partner/v1/subscriptions/{token}/resend-charge
   */
  static async resendCharge(subscriptionToken: string): Promise<any> {
    return this.request(`/api/partner/v1/subscriptions/${subscriptionToken}/resend-charge`, {
      method: 'PATCH',
    });
  }

  /**
   * Gets billing charge history for a subscription:
   * GET /api/partner/v1/subscriptions/{token}/charges
   */
  static async getChargeHistory(subscriptionToken: string): Promise<any> {
    try {
      return await this.request(`/api/partner/v1/subscriptions/${subscriptionToken}/charges`, { method: 'GET' });
    } catch {
      // Fallback: get charges embedded in subscription object
      const sub = await this.getSubscription(subscriptionToken);
      const data = sub?.data || sub;
      return data?.charges || data?.history || [];
    }
  }
}
