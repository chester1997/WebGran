import crypto from 'crypto';
import { db } from '@/db';
import { sellerPaymentConnections, orders, stores, paymentWebhookEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { CreatePaymentParams, PixPaymentResponse } from '../types';
import { AccessDeliveryService } from '@/lib/delivery/access-delivery-service';
import { hasFeature } from '@/lib/entitlements/entitlement-service';

export interface SyncPayAuthTokenResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  [key: string]: any;
}

export interface SyncPayCashInResponse {
  id?: string;
  reference_id?: string;
  transaction_id?: string;
  status?: string;
  amount?: number;
  pix_code?: string;
  qr_code?: string;
  pix_copia_e_cola?: string;
  br_code?: string;
  emv?: string;
  [key: string]: any;
}

/**
 * Server-Side SyncPay Token Cache Service.
 * Manages access tokens in memory per clientId:clientSecret pair.
 * Prevents redundant token generation on every request and automatically refreshes when expired or upon 401.
 */
export class SyncPayAuthService {
  private static tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  static getCacheKey(clientId: string, clientSecret: string): string {
    return crypto.createHash('sha256').update(`${clientId}:${clientSecret}`).digest('hex');
  }

  /**
   * Retrieves or fetches a valid SyncPay bearer token.
   */
  static async getAccessToken(clientId: string, clientSecret: string, forceRefresh = false): Promise<string> {
    const key = this.getCacheKey(clientId, clientSecret);
    const now = Date.now();
    const cached = this.tokenCache.get(key);

    // Reuse token if valid for at least 5 more minutes
    if (!forceRefresh && cached && cached.expiresAt > now + 5 * 60 * 1000) {
      return cached.token;
    }

    const authUrl = 'https://api.syncpayments.com.br/api/partner/v1/auth-token';

    const res = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[SyncPayAuthService] Error obtaining token:', res.status);
      throw new Error(`Falha ao autenticar com a SyncPay (${res.status}): Credenciais inválidas.`);
    }

    const data: SyncPayAuthTokenResponse = await res.json();
    const token = data.access_token || data.token;

    if (!token) {
      throw new Error('SyncPay não retornou um access_token válido.');
    }

    // Default 1 hour validity (55 min safety window)
    const expiresInMs = (data.expires_in || 3600) * 1000;
    const expiresAt = now + Math.min(expiresInMs, 55 * 60 * 1000);

    this.tokenCache.set(key, { token, expiresAt });
    return token;
  }

  static invalidateCache(clientId: string, clientSecret: string) {
    const key = this.getCacheKey(clientId, clientSecret);
    this.tokenCache.delete(key);
  }
}

import { ensurePaymentTables } from '@/db/ensure-payment-tables';

/**
 * Helper to safely extract status string from nested SyncPay response payloads.
 */
export function extractSyncPayStatus(resData: any): string {
  if (!resData) return '';
  if (typeof resData === 'string') return resData.toLowerCase().trim();
  const raw = resData.status || resData.data?.status || resData.data?.transaction?.status || resData.transaction?.status || resData.data?.state || resData.state || resData.transaction_status || '';
  return String(raw).toLowerCase().trim();
}

/**
 * Helper function to determine if a SyncPay webhook payload or status query represents a confirmed payment.
 * CRITICAL RULE: transaction.created NEVER confirms payment (prevents auto-confirmation on Pix charge generation).
 * Only transaction.updated (or direct status query) with status completed/paid/approved confirms payment.
 */
export function isSyncPayPaymentConfirmed(eventType: string, rawStatusOrData: any): boolean {
  const normEvent = String(eventType || '').toLowerCase().trim();
  const normStatus = extractSyncPayStatus(rawStatusOrData);

  // transaction.created MUST NEVER confirm a payment
  if (normEvent === 'transaction.created') {
    return false;
  }

  const validConfirmedStatuses = [
    'completed',
    'paid',
    'approved',
    'sucesso',
    'concluido',
    'concluida',
    'pago',
    'aprovado',
    'confirmado',
    'confirmada',
  ];
  return validConfirmedStatuses.includes(normStatus);
}

export class SyncPayProvider {
  getBaseUrl(): string {
    return 'https://api.syncpayments.com.br/api/partner/v1';
  }

  getV2BaseUrl(): string {
    return 'https://api.syncpayments.com.br/api/partner/v2';
  }

  /**
   * Resolves active SyncPay connection for a seller or store.
   */
  async getSyncPayConnection(sellerId?: string, storeId?: string) {
    await ensurePaymentTables();
    let resolvedSellerId = sellerId;

    if (!resolvedSellerId && storeId) {
      const store = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
      });
      if (store) {
        resolvedSellerId = store.ownerId;
      }
    }

    if (!resolvedSellerId) return null;

    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, resolvedSellerId),
        eq(sellerPaymentConnections.provider, 'syncpay'),
        eq(sellerPaymentConnections.status, 'active')
      ),
    });

    if (!conn) return null;

    try {
      const clientId = decrypt(conn.accessTokenEncrypted);
      const clientSecret = conn.refreshTokenEncrypted ? decrypt(conn.refreshTokenEncrypted) : '';
      const webhookSecret = conn.webhookSecretEncrypted ? decrypt(conn.webhookSecretEncrypted) : '';

      return {
        id: conn.id,
        sellerId: conn.sellerId,
        storeId: conn.storeId,
        clientId,
        clientSecret,
        webhookId: conn.webhookId,
        webhookSecret,
        updatedAt: conn.updatedAt,
      };
    } catch (err) {
      console.error('[SyncPayProvider] Error decrypting credentials for connection:', conn.id, err);
      return null;
    }
  }

  /**
   * Tests SyncPay credentials server-side via authenticating with auth-token endpoint.
   */
  async testConnection(clientId: string, clientSecret: string): Promise<{ success: boolean; message: string }> {
    if (!clientId?.trim() || !clientSecret?.trim()) {
      return { success: false, message: 'Client ID e Client Secret são obrigatórios.' };
    }

    try {
      const token = await SyncPayAuthService.getAccessToken(clientId, clientSecret, true);
      if (token) {
        return { success: true, message: 'Conexão SyncPay autenticada e validada com sucesso!' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao conectar com a SyncPay.' };
    }

    return { success: false, message: 'Não foi possível validar as credenciais SyncPay.' };
  }

  /**
   * Register Webhook on SyncPay for specific connection ID.
   */
  async registerWebhook(clientId: string, clientSecret: string, connectionId: string): Promise<{ webhookId?: string; webhookSecret: string }> {
    const token = await SyncPayAuthService.getAccessToken(clientId, clientSecret);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.webgran.online');
    const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const webhookUrl = `${cleanAppUrl.replace(/\/+$/, '')}/api/webhooks/syncpay/${connectionId}`;

    // Fallback secret if SyncPay API does not return a custom secret in webhook response
    let webhookSecret = crypto.randomBytes(32).toString('hex');
    let webhookId: string | undefined = undefined;

    try {
      const res = await fetch(`${this.getBaseUrl()}/webhooks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'WebGran Webhook',
          url: webhookUrl,
          event: 'transaction',
          trigger_all_products: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.id || data.webhook_id) {
          webhookId = String(data.id || data.webhook_id);
        }
        if (data.token || data.secret || data.webhook_secret) {
          webhookSecret = String(data.token || data.secret || data.webhook_secret);
        }
      } else {
        const errText = await res.text();
        console.warn('[SyncPayProvider] Remote webhook creation failed:', res.status, errText);
      }
    } catch (err) {
      console.warn('[SyncPayProvider] Remote webhook creation call warning:', err);
    }

    return { webhookId, webhookSecret };
  }

  /**
   * Creates a PIX CashIn transaction on SyncPay.
   */
  async createPixPayment(params: CreatePaymentParams): Promise<PixPaymentResponse> {
    const conn = await this.getSyncPayConnection(params.sellerId);
    if (!conn || !conn.clientId || !conn.clientSecret) {
      throw new Error('SyncPay não está configurado para esta loja.');
    }

    // 1. Verify Entitlement: payment_gateways_enabled
    const isAllowed = await hasFeature(conn.sellerId, 'payment_gateways_enabled');
    if (!isAllowed) {
      throw new Error('O plano atual da loja não permite o uso de gateways de pagamento.');
    }

    // 2. Amount Validation (Minimum R$ 1,00 as documented)
    const amountNum = Number(params.amount);
    if (isNaN(amountNum) || amountNum < 1.0) {
      throw new Error('O valor mínimo para pagamentos via SyncPay Pix é R$ 1,00.');
    }

    // 3. Verify order exists and is not already paid
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, params.orderId),
    });

    if (!order) {
      throw new Error('Pedido não encontrado.');
    }

    if (order.status === 'paid') {
      throw new Error('Este pedido já foi pago.');
    }

    const token = await SyncPayAuthService.getAccessToken(conn.clientId, conn.clientSecret);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.webgran.online');
    const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const webhookUrl = `${cleanAppUrl.replace(/\/+$/, '')}/api/webhooks/syncpay/${conn.id}`;

    const payload = {
      amount: Number(amountNum.toFixed(2)),
      description: params.description || `Pedido WebGran #${params.orderId}`,
      webhook_url: webhookUrl,
      client: {
        name: params.customer?.name || params.customer?.firstName || 'Cliente Telegram',
        email: params.customer?.email || 'cliente@webgran.app',
      },
    };

    let res = await fetch(`${this.getBaseUrl()}/cash-in`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Handle 401 retry once with fresh token
    if (res.status === 401) {
      console.warn('[SyncPayProvider] 401 received. Retrying with fresh token...');
      SyncPayAuthService.invalidateCache(conn.clientId, conn.clientSecret);
      const freshToken = await SyncPayAuthService.getAccessToken(conn.clientId, conn.clientSecret, true);
      res = await fetch(`${this.getBaseUrl()}/cash-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${freshToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('[SyncPayProvider] Cash-in error:', res.status, errorBody);
      throw new Error(`SyncPay API Error (${res.status}): ${errorBody}`);
    }

    const data: SyncPayCashInResponse = await res.json();

    const paymentId = String(data.identifier || data.reference_id || data.id || data.transaction_id || params.orderId);
    const pixCode = data.pix_code || data.pix_copia_e_cola || data.qr_code || data.br_code || data.emv || '';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiration

    // Persist SyncPay payment reference in order
    await db.update(orders)
      .set({
        paymentId,
        paymentMethod: 'syncpay',
        pixQrCode: pixCode,
        pixExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, params.orderId));

    return {
      paymentId,
      status: 'pending',
      qrCode: pixCode,
      qrCodeBase64: '',
      expiresAt,
    };
  }

  /**
   * Validates server-side HMAC-SHA256 signature for incoming SyncPay Webhooks.
   * Header: X-SyncPay-Signature -> t=TIMESTAMP,v1=SIGNATURE
   * Signed payload: `${timestamp}.${rawBody}`
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null, webhookSecret: string, clientSecret?: string): { isValid: boolean; error?: string } {
    if (!signatureHeader) {
      return { isValid: false, error: 'Header X-SyncPay-Signature ausente.' };
    }

    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key?.trim() === 't') timestamp = val?.trim() || '';
      if (key?.trim() === 'v1' || key?.trim() === 'sha256' || key?.trim() === 'sig') signature = val?.trim() || '';
    }

    if (!signature && signatureHeader && !signatureHeader.includes('=')) {
      signature = signatureHeader.trim();
    }

    if (!signature) {
      return { isValid: false, error: 'Formato do header X-SyncPay-Signature inválido.' };
    }

    // 1. Replay Protection: 300 seconds window (only if timestamp is provided)
    if (timestamp) {
      const nowInSec = Math.floor(Date.now() / 1000);
      const eventTimeSec = parseInt(timestamp, 10);
      if (!isNaN(eventTimeSec) && Math.abs(nowInSec - eventTimeSec) > 300) {
        return { isValid: false, error: 'Timestamp do webhook fora da janela permitida (Replay Attack protection).' };
      }
    }

    // 2. Try HMAC-SHA256 verification using webhookSecret or clientSecret
    const secretsToTry = Array.from(new Set([webhookSecret, clientSecret])).filter(Boolean) as string[];

    for (const sec of secretsToTry) {
      let signedPayload = rawBody;
      if (timestamp) {
        signedPayload = `${timestamp}.${rawBody}`;
      }

      const expectedSignature = crypto
        .createHmac('sha256', sec)
        .update(signedPayload)
        .digest('hex');

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return { isValid: true };
      }

      if (timestamp) {
        const altExpected = crypto
          .createHmac('sha256', sec)
          .update(rawBody)
          .digest('hex');
        const altExpectedBuffer = Buffer.from(altExpected);
        if (sigBuffer.length === altExpectedBuffer.length && crypto.timingSafeEqual(sigBuffer, altExpectedBuffer)) {
          return { isValid: true };
        }
      }
    }

    return { isValid: false, error: 'Assinatura HMAC-SHA256 do webhook inválida.' };
  }

  /**
   * Processes incoming SyncPay Webhooks with strict multi-tenancy, HMAC validation, idempotency via event_id, and event ordering.
   */
  async handleWebhook(connectionId: string, rawBody: string, headers: Headers): Promise<{ success: boolean; alreadyProcessed?: boolean; pending?: boolean; error?: string }> {
    // 1. Locate connection
    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.id, connectionId),
        eq(sellerPaymentConnections.provider, 'syncpay')
      ),
    });

    if (!conn) {
      return { success: false, error: 'Conexão SyncPay não encontrada.' };
    }

    // 2. Validate HMAC Signature
    const signatureHeader = headers.get('X-SyncPay-Signature') || headers.get('x-syncpay-signature') || headers.get('x-signature') || headers.get('signature');
    const webhookSecret = conn.webhookSecretEncrypted ? decrypt(conn.webhookSecretEncrypted) : '';
    const clientSecret = conn.refreshTokenEncrypted ? decrypt(conn.refreshTokenEncrypted) : '';

    if (webhookSecret || clientSecret) {
      const sigValidation = this.verifyWebhookSignature(rawBody, signatureHeader, webhookSecret, clientSecret);
      if (!sigValidation.isValid) {
        console.warn(`[SyncPayWebhook] Validation failed for connection ${connectionId}:`, sigValidation.error);
        return { success: false, error: sigValidation.error };
      }
    }

    // 3. Parse JSON Body AFTER Signature Validation
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { success: false, error: 'Body do webhook não é um JSON válido.' };
    }

    const eventId = String(payload.event_id || payload.id || payload.delivery_id || '').trim();
    const eventType = String(payload.event || payload.type || 'transaction.updated').trim();

    if (!eventId) {
      return { success: false, error: 'event_id ausente no webhook SyncPay.' };
    }

    // 4. Idempotency Check via paymentWebhookEvents
    const existingEvent = await db.query.paymentWebhookEvents.findFirst({
      where: and(
        eq(paymentWebhookEvents.provider, 'syncpay'),
        eq(paymentWebhookEvents.eventId, eventId)
      ),
    });

    if (existingEvent) {
      console.log(`[SyncPayWebhook] Evento ${eventId} já processado anteriormente. Ignorando.`);
      return { success: true, alreadyProcessed: true };
    }

    // Record Event Idempotently
    try {
      await db.insert(paymentWebhookEvents).values({
        provider: 'syncpay',
        eventId,
        eventType,
        connectionId,
        payload,
      });
    } catch {
      // Ignore unique constraint conflict on concurrent race
    }

    // 5. Locate order by transaction reference_id, identifier or order ID
    const transactionData = payload.data?.transaction || payload.data || payload.transaction || payload;
    const referenceId = String(transactionData.reference_id || transactionData.identifier || transactionData.id || payload.reference_id || payload.identifier || payload.id || '').trim();

    if (!referenceId) {
      console.warn('[SyncPayWebhook] Webhook sem reference_id de transação:', payload);
      return { success: true };
    }

    let order = await db.query.orders.findFirst({
      where: and(
        eq(orders.paymentId, referenceId),
        eq(orders.paymentMethod, 'syncpay')
      ),
    });

    if (!order) {
      order = await db.query.orders.findFirst({
        where: and(
          eq(orders.id, referenceId),
          eq(orders.paymentMethod, 'syncpay')
        ),
      });
    }

    if (!order) {
      order = await db.query.orders.findFirst({
        where: and(
          eq(orders.paymentId, `sync_${referenceId}`),
          eq(orders.paymentMethod, 'syncpay')
        ),
      });
    }

    if (!order) {
      console.warn(`[SyncPayWebhook] Nenhum pedido WebGran encontrado para paymentId SyncPay: ${referenceId}`);
      return { success: true };
    }

    // Ensure order store belongs to connection seller/store (Multi-Tenant Guard)
    if (conn.storeId && order.storeId !== conn.storeId) {
      console.error(`[SyncPayWebhook] Alerta de segurança: Pedido ${order.id} não pertence à loja da conexão ${connectionId}`);
      return { success: false, error: 'Acesso negado: loja incorreta.' };
    }

    // 6. Event Type Check: transaction.created is ONLY creation notification, MUST NEVER confirm payment
    if (eventType.toLowerCase() === 'transaction.created') {
      console.log(`[SyncPayWebhook] Evento transaction.created recebido para o pedido ${order.id}. Mantendo status pending.`);
      return { success: true, pending: true };
    }

    // 7. Event Ordering Check: if order is ALREADY paid or refunded, do not regress status
    if (order.status === 'paid' && eventType !== 'transaction.refunded') {
      console.log(`[SyncPayWebhook] Pedido ${order.id} já está como 'paid'. Ignorando atualização antiga.`);
      return { success: true, alreadyProcessed: true };
    }

    const rawStatus = String(transactionData.status || payload.status || '').toLowerCase().trim();

    const isPaid = isSyncPayPaymentConfirmed(eventType, rawStatus);
    const isFailed = ['failed', 'refused', 'cancelled', 'canceled', 'expired'].includes(rawStatus);
    const isRefunded = ['refunded', 'reembolsado'].includes(rawStatus);

    if (isPaid) {
      const updatedRows = await db.update(orders)
        .set({
          status: 'paid',
          paymentMethod: 'syncpay',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending') // ATOMIC GUARD
        ))
        .returning();

      if (updatedRows.length > 0) {
        console.log(`[SyncPayWebhook] Order ${order.id} marcada como PAID via SyncPay! Disparando entrega...`);
        await AccessDeliveryService.processOrderDelivery(order.id);
      }
    } else if (isFailed) {
      await db.update(orders)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
    } else if (isRefunded) {
      await db.update(orders)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(orders.id, order.id));
    }

    return { success: true };
  }

  /**
   * Queries transaction status on SyncPay API GET /api/partner/v2/transactions/{reference_id}.
   */
  async getPixPaymentStatus(referenceId: string, clientId: string, clientSecret: string): Promise<SyncPayCashInResponse | null> {
    if (!referenceId || !clientId || !clientSecret) return null;

    try {
      const token = await SyncPayAuthService.getAccessToken(clientId, clientSecret);
      
      // Try V1 /transaction/{id} endpoint first
      let res = await fetch(`${this.getBaseUrl()}/transaction/${referenceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        // Fallback to V2 /transactions/{id} endpoint
        res = await fetch(`${this.getV2BaseUrl()}/transactions/${referenceId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
      }

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('[SyncPayProvider] Error querying transaction status:', err);
    }
    return null;
  }

  /**
   * Requests refund for a SyncPay transaction POST /api/partner/v1/transaction/{reference_id}/refund.
   */
  async refundPayment(sellerId: string, orderId: string): Promise<{ success: boolean; message: string }> {
    const conn = await this.getSyncPayConnection(sellerId);
    if (!conn) {
      throw new Error('Conexão SyncPay não encontrada para este vendedor.');
    }

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.paymentMethod, 'syncpay')
      ),
    });

    if (!order || !order.paymentId) {
      throw new Error('Pedido SyncPay não encontrado ou ausente de ID de transação.');
    }

    if (order.status !== 'paid') {
      throw new Error('Apenas pedidos com status "pago" podem ser reembolsados.');
    }

    const token = await SyncPayAuthService.getAccessToken(conn.clientId, conn.clientSecret);

    const res = await fetch(`${this.getBaseUrl()}/transaction/${order.paymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[SyncPayProvider] Refund error:', res.status, errorText);
      throw new Error(`Erro ao solicitar reembolso SyncPay (${res.status}): ${errorText}`);
    }

    await db.update(orders)
      .set({
        status: 'refunded',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return { success: true, message: 'Reembolso solicitado com sucesso.' };
  }
}

export const syncPayProvider = new SyncPayProvider();
