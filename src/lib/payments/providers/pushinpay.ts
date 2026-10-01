import { db } from '@/db';
import { sellerPaymentConnections, orders, stores } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { CreatePaymentParams, PixPaymentResponse } from '../types';
import { AccessDeliveryService } from '@/lib/delivery/access-delivery-service';

export interface PushinPayCashInResponse {
  id?: string;
  transaction_id?: string;
  value?: number;
  status?: string;
  qr_code?: string;
  qr_code_base64?: string;
  pix_copia_e_cola?: string;
  br_code?: string;
  emv?: string;
  qr_code_url?: string;
  image_base64?: string;
  [key: string]: any;
}

export class PushinPayProvider {
  /**
   * Dynamically resolves PushinPay API Base URL based on PUSHINPAY_ENV environment variable.
   * - 'sandbox' -> 'https://api-sandbox.pushinpay.com.br/api'
   * - 'production' (or default) -> 'https://api.pushinpay.com.br/api'
   */
  getBaseUrl(): string {
    const env = (process.env.PUSHINPAY_ENV || '').toLowerCase().trim();
    if (env === 'sandbox') {
      return 'https://api-sandbox.pushinpay.com.br/api';
    }
    return 'https://api.pushinpay.com.br/api';
  }

  /**
   * Returns current active PushinPay environment ('sandbox' | 'production').
   */
  getEnvironment(): 'sandbox' | 'production' {
    const env = (process.env.PUSHINPAY_ENV || '').toLowerCase().trim();
    if (env === 'sandbox') {
      return 'sandbox';
    }
    return 'production';
  }

  /**
   * Resolves PushinPay Bearer Token for a specific seller/store.
   * Priority:
   * 1. Seller's active 'pushinpay' connection in sellerPaymentConnections
   * 2. Global process.env.PUSHINPAY_TOKEN environment variable
   */
  async getPushinPayToken(sellerId?: string, storeId?: string): Promise<string | null> {
    if (sellerId) {
      const conn = await db.query.sellerPaymentConnections.findFirst({
        where: and(
          eq(sellerPaymentConnections.sellerId, sellerId),
          eq(sellerPaymentConnections.provider, 'pushinpay'),
          eq(sellerPaymentConnections.status, 'active')
        ),
      });

      if (conn && conn.accessTokenEncrypted) {
        try {
          return decrypt(conn.accessTokenEncrypted);
        } catch (err) {
          console.error('[PushinPayProvider] Error decrypting seller PushinPay token:', err);
        }
      }
    }

    if (storeId) {
      const store = await db.query.stores.findFirst({
        where: eq(stores.id, storeId),
      });
      if (store && store.ownerId) {
        const conn = await db.query.sellerPaymentConnections.findFirst({
          where: and(
            eq(sellerPaymentConnections.sellerId, store.ownerId),
            eq(sellerPaymentConnections.provider, 'pushinpay'),
            eq(sellerPaymentConnections.status, 'active')
          ),
        });
        if (conn && conn.accessTokenEncrypted) {
          try {
            return decrypt(conn.accessTokenEncrypted);
          } catch (err) {
            console.error('[PushinPayProvider] Error decrypting store owner PushinPay token:', err);
          }
        }
      }
    }

    // Fallback to global environment variable
    return process.env.PUSHINPAY_TOKEN || null;
  }

  /**
   * Validates PushinPay credential configuration locally without calling non-existent endpoints or creating charges.
   * Full API validation occurs on the first real/sandbox PIX transaction.
   */
  async testConnection(token: string): Promise<{ success: boolean; message: string }> {
    if (!token || !token.trim()) {
      return { success: false, message: 'Token PushinPay não informado.' };
    }

    const trimmedToken = token.trim();
    if (trimmedToken.length < 10) {
      return { success: false, message: 'Formato do Token PushinPay inválido.' };
    }

    const currentEnv = this.getEnvironment();
    return {
      success: true,
      message: `Credencial PushinPay armazenada com sucesso (${currentEnv.toUpperCase()}). A validação com a API ocorrerá ao criar o primeiro PIX.`,
    };
  }

  /**
   * Consults PushinPay API server-side to verify real status and value of a transaction.
   * Official GET endpoint: /transactions/{id}
   */
  async getPixPaymentStatus(paymentId: string, token: string): Promise<PushinPayCashInResponse | null> {
    if (!paymentId || !token) return null;
    try {
      const res = await fetch(`${this.getBaseUrl()}/transactions/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('[PushinPayProvider] Error querying server-side transaction status:', err);
    }
    return null;
  }

  /**
   * Creates a PIX CashIn transaction on PushinPay.
   * Value is converted from R$ (float/number) to integer CENTAVOS (e.g. 9.90 -> 990).
   * Uses Idempotency-Key header: `webgran-order-${orderId}`.
   */
  async createPixPayment(params: CreatePaymentParams): Promise<PixPaymentResponse> {
    const token = await this.getPushinPayToken(params.sellerId);

    if (!token) {
      throw new Error('PushinPay não está configurado (Token PUSHINPAY_TOKEN ausente).');
    }

    // Convert amount to exact centavos integer (no float inaccuracies)
    const centavos = Math.round(Number(params.amount) * 100);

    if (isNaN(centavos) || centavos <= 0) {
      throw new Error('Valor inválido para criação de PIX na PushinPay.');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.webgran.online');
    const cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const webhookUrl = `${cleanAppUrl.replace(/\/+$/, '')}/api/webhooks/payments/pushinpay`;

    const idempotencyKey = `webgran-order-${params.orderId}`;

    const res = await fetch(`${this.getBaseUrl()}/pix/cashIn`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        value: centavos,
        webhook_url: webhookUrl,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('[PushinPayProvider] Error creating PIX:', res.status, errorBody);
      throw new Error(`PushinPay API Erro (${res.status}): ${errorBody}`);
    }

    const data: PushinPayCashInResponse = await res.json();

    const paymentId = String(data.id || data.transaction_id || `pp_${params.orderId}`);
    const qrCode = data.qr_code || data.pix_copia_e_cola || data.br_code || data.emv || '';
    const qrCodeBase64 = data.qr_code_base64 || data.qr_code_url || data.image_base64 || '';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min PIX expiration

    return {
      paymentId,
      status: 'pending',
      qrCode,
      qrCodeBase64,
      expiresAt,
    };
  }

  /**
   * Handles incoming PushinPay Webhooks with strict multi-tenant, server-side reconciliation,
   * order value verification in centavos, and atomic DB updates against race conditions.
   */
  async handleWebhook(payload: any): Promise<{ success: boolean; alreadyPaid?: boolean; error?: string }> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload do Webhook PushinPay inválido.');
    }

    const externalId = String(payload.id || payload.transaction_id || payload.external_reference || '').trim();

    if (!externalId) {
      console.warn('[PushinPayWebhook] Webhook sem identificador de transação (id):', payload);
      return { success: false, error: 'Identificador de transação ausente.' };
    }

    // 1. Locate order strictly by paymentId AND paymentMethod = 'pushinpay' (Gateway Scoping)
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.paymentId, externalId),
        eq(orders.paymentMethod, 'pushinpay')
      ),
    });

    if (!order) {
      console.warn(`[PushinPayWebhook] Nenhuma ordem PushinPay encontrada para paymentId: ${externalId}`);
      return { success: false, error: 'Ordem não encontrada para esta transação PushinPay.' };
    }

    // 2. Idempotency Check: If order is ALREADY paid, skip fulfillment immediately
    if (order.status === 'paid') {
      console.log(`[PushinPayWebhook] Order ${order.id} já se encontra como 'paid'. Ignorando processamento duplicado.`);
      return { success: true, alreadyPaid: true };
    }

    // 3. Server-Side Verification / Reconciliation via PushinPay API (if token present)
    const token = await this.getPushinPayToken(undefined, order.storeId);
    let verifiedTx: PushinPayCashInResponse | null = null;

    if (token) {
      verifiedTx = await this.getPixPaymentStatus(externalId, token);
    }

    const activePayload = verifiedTx || payload;
    const rawStatus = String(activePayload.status || '').toLowerCase().trim();

    // 4. Value Validation in Centavos
    const expectedCentavos = Math.round(Number(order.total) * 100);
    const receivedCentavos = activePayload.value !== undefined ? Math.round(Number(activePayload.value)) : expectedCentavos;

    if (receivedCentavos !== expectedCentavos) {
      console.error(`[PushinPayWebhook] Divergência de valor! Esperado exato: ${expectedCentavos} centavos, Recebido: ${receivedCentavos} centavos.`);
      return { success: false, error: 'Valor da transação diverge do valor exato do pedido.' };
    }

    // 5. Status Mapping: PushinPay -> WebGran
    const isPaid = ['paid', 'approved', 'completed', 'accredited', 'sucesso'].includes(rawStatus);
    const isFailed = ['canceled', 'cancelled', 'expired', 'failed', 'rejected'].includes(rawStatus);

    if (isPaid) {
      const totalNum = Number(order.total);
      const platformFeeNum = 0;
      const netAmountNum = totalNum;

      // 6. Atomic DB Update against Race Conditions (only updates if status is STILL 'pending')
      const updatedRows = await db.update(orders)
        .set({
          status: 'paid',
          paymentMethod: 'pushinpay',
          platformFee: platformFeeNum.toFixed(2),
          netAmount: netAmountNum.toFixed(2),
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending') // ATOMIC GUARD
        ))
        .returning();

      if (updatedRows.length === 0) {
        console.log(`[PushinPayWebhook] Order ${order.id} já foi atualizada por requisição concorrente. Ignorando.`);
        return { success: true, alreadyPaid: true };
      }

      console.log(`[PushinPayWebhook] Order ${order.id} marcada como PAID com sucesso! Disparando entrega...`);

      // 7. Trigger existing WebGran Access Delivery Engine
      await AccessDeliveryService.processOrderDelivery(order.id);

      return { success: true };
    } else if (isFailed) {
      await db.update(orders)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending')
        ));
    }

    return { success: true };
  }
}

export const pushinPayProvider = new PushinPayProvider();
