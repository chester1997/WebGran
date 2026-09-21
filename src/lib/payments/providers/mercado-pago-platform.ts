import { db } from '@/db';
import { platformPaymentConnections, systemSettings } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import crypto from 'crypto';
import { 
  PlatformBillingProvider, 
  CreateInvoiceParams, 
  InvoiceResponse 
} from '../types';

export interface PlatformMPConfig {
  id?: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  mpUserId?: string | null;
  mpUserEmail?: string | null;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: Date | null;
  connectedAt?: Date | null;
  updatedAt?: Date | null;
}

export class MercadoPagoPlatformProvider implements PlatformBillingProvider {
  /**
   * Generates OAuth URL for Platform Owner (SUPER_ADMIN)
   */
  async getOAuthConnectUrl(redirectUrl: string): Promise<string> {
    const appId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID;
    if (!appId) {
      throw new Error('Mercado Pago MP_CLIENT_ID/MP_APP_ID não configurado nas variáveis de ambiente.');
    }
    const state = Buffer.from(JSON.stringify({ role: 'super_admin', type: 'platform_subscription' })).toString('base64url');
    const encodedRedirect = encodeURIComponent(redirectUrl);
    return `https://auth.mercadopago.com.br/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodedRedirect}`;
  }

  /**
   * Handles OAuth Callback for Platform Owner
   */
  async handleOAuthCallback(code: string, redirectUri: string): Promise<{ userId: string; email: string | null }> {
    const clientId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID;
    const clientSecret = process.env.MP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do Mercado Pago (MP_CLIENT_ID / MP_CLIENT_SECRET) ausentes.');
    }

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      throw new Error(data.message || data.error_description || 'Falha ao conectar com o Mercado Pago.');
    }

    const accessTokenEncrypted = encrypt(data.access_token);
    const refreshTokenEncrypted = data.refresh_token ? encrypt(data.refresh_token) : null;
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    const mpUserId = String(data.user_id || '');

    let mpUserEmail: string | null = null;
    try {
      const userRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        mpUserEmail = userData.email || null;
      }
    } catch {
      // Non-blocking
    }

    await this.saveConnection({
      status: 'CONNECTED',
      mpUserId,
      mpUserEmail,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      connectedAt: new Date(),
    });

    return { userId: mpUserId, email: mpUserEmail };
  }

  /**
   * Saves or updates platform connection in DB
   */
  async saveConnection(data: Partial<PlatformMPConfig>): Promise<void> {
    const existing = await db.query.platformPaymentConnections.findFirst({
      where: eq(platformPaymentConnections.provider, 'MERCADO_PAGO'),
    });

    if (existing) {
      await db.update(platformPaymentConnections)
        .set({
          status: data.status || existing.status,
          mpUserId: data.mpUserId ?? existing.mpUserId,
          mpUserEmail: data.mpUserEmail ?? existing.mpUserEmail,
          accessTokenEncrypted: data.accessTokenEncrypted ?? existing.accessTokenEncrypted,
          refreshTokenEncrypted: data.refreshTokenEncrypted ?? existing.refreshTokenEncrypted,
          tokenExpiresAt: data.tokenExpiresAt ?? existing.tokenExpiresAt,
          connectedAt: data.connectedAt ?? existing.connectedAt,
          updatedAt: new Date(),
        })
        .where(eq(platformPaymentConnections.id, existing.id));
    } else {
      await db.insert(platformPaymentConnections).values({
        provider: 'MERCADO_PAGO',
        status: data.status || 'CONNECTED',
        mpUserId: data.mpUserId || null,
        mpUserEmail: data.mpUserEmail || null,
        accessTokenEncrypted: data.accessTokenEncrypted || null,
        refreshTokenEncrypted: data.refreshTokenEncrypted || null,
        tokenExpiresAt: data.tokenExpiresAt || null,
        connectedAt: data.connectedAt || new Date(),
      });
    }

    // Mirror status & email in system_settings for fast access
    if (data.accessTokenEncrypted) {
      await this.saveSystemSetting('mp_platform_access_token', data.accessTokenEncrypted);
    }
    if (data.mpUserEmail) {
      await this.saveSystemSetting('mp_platform_email', data.mpUserEmail);
    }
    if (data.mpUserId) {
      await this.saveSystemSetting('mp_platform_user_id', data.mpUserId);
    }
    await this.saveSystemSetting('mp_platform_status', data.status || 'CONNECTED');
    await this.saveSystemSetting('mp_platform_updated_at', new Date().toISOString());
  }

  /**
   * Save a key-value in systemSettings
   */
  private async saveSystemSetting(key: string, value: string): Promise<void> {
    const existing = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    });

    if (existing) {
      await db.update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.id, existing.id));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  }

  /**
   * Directly save raw Access Token for Platform Owner
   */
  async saveAccessTokenDirect(accessToken: string, email?: string): Promise<{ success: boolean; mpUserId?: string }> {
    const cleanToken = accessToken.trim();
    if (!cleanToken) {
      throw new Error('Access Token não pode ser vazio.');
    }

    // Verify token with Mercado Pago /users/me
    const userRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      throw new Error(`Token inválido no Mercado Pago: ${errText}`);
    }

    const userData = await userRes.json();
    const mpUserId = String(userData.id || '');
    const mpUserEmail = email || userData.email || null;

    const accessTokenEncrypted = encrypt(cleanToken);

    await this.saveConnection({
      status: 'CONNECTED',
      mpUserId,
      mpUserEmail,
      accessTokenEncrypted,
      connectedAt: new Date(),
    });

    return { success: true, mpUserId };
  }

  /**
   * Disconnect Platform Account
   */
  async disconnectPlatform(): Promise<void> {
    const existing = await db.query.platformPaymentConnections.findFirst({
      where: eq(platformPaymentConnections.provider, 'MERCADO_PAGO'),
    });

    if (existing) {
      await db.update(platformPaymentConnections)
        .set({
          status: 'DISCONNECTED',
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          updatedAt: new Date(),
        })
        .where(eq(platformPaymentConnections.id, existing.id));
    }

    await this.saveSystemSetting('mp_platform_status', 'DISCONNECTED');
    await this.saveSystemSetting('mp_platform_access_token', '');
  }

  /**
   * Get Active Platform Connection Status (for Admin UI)
   */
  async getPlatformStatus(): Promise<{
    isConnected: boolean;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    mpUserId: string | null;
    mpUserEmail: string | null;
    connectedAt: string | null;
    updatedAt: string | null;
  }> {
    try {
      const conn = await db.query.platformPaymentConnections.findFirst({
        where: eq(platformPaymentConnections.provider, 'MERCADO_PAGO'),
      });

      if (conn && conn.status === 'CONNECTED' && conn.accessTokenEncrypted) {
        return {
          isConnected: true,
          status: 'CONNECTED',
          mpUserId: conn.mpUserId || null,
          mpUserEmail: conn.mpUserEmail || null,
          connectedAt: conn.connectedAt ? new Date(conn.connectedAt).toISOString() : null,
          updatedAt: conn.updatedAt ? new Date(conn.updatedAt).toISOString() : null,
        };
      }

      // Check process.env fallback
      if (process.env.MP_ACCESS_TOKEN || process.env.MP_CLIENT_SECRET) {
        return {
          isConnected: true,
          status: 'CONNECTED',
          mpUserId: 'ENV_CONFIGURED',
          mpUserEmail: 'Proprietário (Variável de Ambiente)',
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        isConnected: false,
        status: 'DISCONNECTED',
        mpUserId: null,
        mpUserEmail: null,
        connectedAt: null,
        updatedAt: null,
      };
    } catch {
      return {
        isConnected: false,
        status: 'DISCONNECTED',
        mpUserId: null,
        mpUserEmail: null,
        connectedAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * Fetch valid unencrypted Access Token for Platform Owner
   */
  async getValidAccessToken(): Promise<string> {
    const conn = await db.query.platformPaymentConnections.findFirst({
      where: eq(platformPaymentConnections.provider, 'MERCADO_PAGO'),
    });

    if (conn && conn.status === 'CONNECTED' && conn.accessTokenEncrypted) {
      // Check expiration and refresh if refresh token available
      if (conn.tokenExpiresAt && new Date(conn.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000 && conn.refreshTokenEncrypted) {
        try {
          const refreshToken = decrypt(conn.refreshTokenEncrypted);
          const clientId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID;
          const clientSecret = process.env.MP_CLIENT_SECRET;

          if (clientId && clientSecret) {
            const refreshRes = await fetch('https://api.mercadopago.com/oauth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_secret: clientSecret,
                client_id: clientId,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
              }).toString(),
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const newAccessEncrypted = encrypt(refreshData.access_token);
              const newRefreshEncrypted = refreshData.refresh_token ? encrypt(refreshData.refresh_token) : conn.refreshTokenEncrypted;
              const newExpiresAt = refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000) : conn.tokenExpiresAt;

              await this.saveConnection({
                status: 'CONNECTED',
                accessTokenEncrypted: newAccessEncrypted,
                refreshTokenEncrypted: newRefreshEncrypted,
                tokenExpiresAt: newExpiresAt,
              });

              return refreshData.access_token;
            }
          }
        } catch (err) {
          console.error('Falha ao renovar token do Mercado Pago da plataforma:', err);
        }
      }

      return decrypt(conn.accessTokenEncrypted);
    }

    // Fallback to process.env.MP_ACCESS_TOKEN
    const envToken = process.env.MP_ACCESS_TOKEN || process.env.MP_CLIENT_SECRET;
    if (envToken) {
      return envToken;
    }

    throw new Error('Conta Mercado Pago do proprietário não está conectada. Conecte no painel /admin.');
  }

  /**
   * Create a REAL PIX Payment for WebGran Platform Subscription (30 MINUTES EXPIRATION)
   */
  async createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
    const accessToken = await this.getValidAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://webgran.online';

    // Amount is FIXED at R$ 89,90 server-side
    const amount = 89.90;
    const now = new Date();
    // EXACT 30 MINUTES EXPIRATION SERVER-SIDE
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const idempotencyKey = crypto.randomUUID();
    const externalRef = `WEBGRAN_SUB_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const paymentPayload = {
      transaction_amount: amount,
      description: 'Assinatura WebGran SaaS - R$ 89,90/mês',
      payment_method_id: 'pix',
      payer: {
        email: params.customerEmail || 'vendedor@webgran.online',
        first_name: params.customerName || 'Vendedor WebGran',
      },
      date_of_expiration: expiresAt.toISOString(),
      external_reference: externalRef,
      notification_url: `${appUrl}/api/webhooks/mercadopago/platform`,
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      console.error('[MP SUBSCRIPTION CREATION FAIL]', response.status, data);
      throw new Error(`Erro ao criar PIX de assinatura no Mercado Pago (HTTP ${response.status}): ${data.message || JSON.stringify(data)}`);
    }

    const transactionData = data.point_of_interaction?.transaction_data;
    const qrCodeText = transactionData?.qr_code || data.qr_code;
    const qrCodeBase64 = transactionData?.qr_code_base64;

    if (!qrCodeText) {
      throw new Error('O Mercado Pago criou a cobrança mas não retornou o código Pix Copia e Cola (qr_code).');
    }

    const qrCodeImageUrl = qrCodeBase64 
      ? `data:image/png;base64,${qrCodeBase64}` 
      : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeText)}`;

    console.log(`[MP SUBSCRIPTION SUCCESS] HTTP 201 | Payment ID: ${data.id} | ExternalRef: ${externalRef} | ExpiresAt: ${expiresAt.toISOString()}`);

    return {
      id: String(data.id),
      status: 'PENDING',
      qrCode: qrCodeImageUrl,
      qrCodeText: qrCodeText,
    };
  }

  /**
   * Fetch payment status from Mercado Pago API
   */
  async getInvoice(paymentId: string): Promise<InvoiceResponse> {
    const accessToken = await this.getValidAccessToken();

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`[MP GET PAYMENT FAIL] HTTP ${response.status} | ID: ${paymentId}`);
      throw new Error(`Erro ao consultar pagamento ${paymentId} no Mercado Pago (HTTP ${response.status}).`);
    }

    const data = await response.json();
    const mpStatus = (data.status || '').toLowerCase();

    let mappedStatus: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED' = 'PENDING';
    if (mpStatus === 'approved') {
      mappedStatus = 'PAID';
    } else if (mpStatus === 'cancelled' || mpStatus === 'refunded' || mpStatus === 'charged_back') {
      mappedStatus = 'CANCELLED';
    } else if (mpStatus === 'rejected') {
      mappedStatus = 'FAILED';
    } else if (mpStatus === 'expired') {
      mappedStatus = 'EXPIRED';
    }

    const transactionData = data.point_of_interaction?.transaction_data;
    const qrCodeText = transactionData?.qr_code || data.qr_code;
    const qrCodeBase64 = transactionData?.qr_code_base64;
    const qrCodeImageUrl = qrCodeBase64 
      ? `data:image/png;base64,${qrCodeBase64}` 
      : (qrCodeText ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeText)}` : undefined);

    return {
      id: String(data.id),
      status: mappedStatus,
      qrCode: qrCodeImageUrl,
      qrCodeText: qrCodeText || undefined,
    };
  }

  /**
   * Cancel payment on Mercado Pago
   */
  async cancelInvoice(paymentId: string): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken();
      await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      console.log(`[MP CANCEL PAYMENT] ID: ${paymentId}`);
    } catch (err) {
      console.error(`[MP CANCEL PAYMENT ERROR] Failed to cancel ${paymentId}:`, err);
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    // Handled in dedicated platform webhook route
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<string> {
    return 'ACTIVE';
  }
}

export const mercadoPagoPlatformProvider = new MercadoPagoPlatformProvider();
