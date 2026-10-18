import crypto from 'crypto';
import { db } from '@/db';
import { sellerPaymentConnections, orders, stores, paymentWebhookEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { CreatePaymentParams, PixPaymentResponse } from '../types';
import { AccessDeliveryService } from '@/lib/delivery/access-delivery-service';
import { ensurePaymentTables } from '@/db/ensure-payment-tables';

export interface PushinPayCashInResponse {
  id: string;
  qr_code: string;
  status: string;
  value: number;
  webhook_url?: string | null;
  qr_code_base64?: string | null;
  webhook?: any;
  split_rules?: any[];
  end_to_end_id?: string | null;
  payer_name?: string | null;
  payer_national_registration?: string | null;
  [key: string]: any;
}

export interface PushinPayTransactionResponse {
  id: string;
  status: 'created' | 'paid' | 'canceled' | 'expired' | string;
  value: number | string;
  description?: string | null;
  end_to_end_id?: string | null;
  pix_details?: {
    emv?: string;
    expiration_date?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export class PushinPayProvider {
  private static inFlightPixRequests: Map<string, Promise<PixPaymentResponse>> = new Map();

  getBaseUrl(): string {
    const customUrl = process.env.PUSHINPAY_BASE_URL?.trim();
    if (customUrl) {
      return customUrl.replace(/\/+$/, '');
    }
    return 'https://api.pushinpay.com.br/api';
  }

  /**
   * Resolves active PushinPay connection for a seller or store.
   */
  async getPushinPayConnection(sellerId?: string, storeId?: string) {
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
        eq(sellerPaymentConnections.provider, 'pushinpay'),
        eq(sellerPaymentConnections.status, 'active')
      ),
    });

    if (!conn) return null;

    try {
      const token = decrypt(conn.accessTokenEncrypted);
      const webhookSecret = conn.webhookSecretEncrypted ? decrypt(conn.webhookSecretEncrypted) : '';

      return {
        id: conn.id,
        sellerId: conn.sellerId,
        storeId: conn.storeId,
        token,
        webhookId: conn.webhookId,
        webhookSecret,
        updatedAt: conn.updatedAt,
      };
    } catch (err) {
      console.error('[PushinPayProvider] Error decrypting credentials for connection:', conn.id);
      return null;
    }
  }

  /**
   * Tests PushinPay credentials server-side via the official balance endpoint.
   * Uses GET /api/balance (PushinPay balance route supports GET/HEAD).
   * Does not create real charges or modify balances.
   */
  async testConnection(token: string): Promise<{ success: boolean; message: string; balance?: any }> {
    if (!token?.trim()) {
      return { success: false, message: 'O token da API PushinPay é obrigatório.' };
    }

    const cleanToken = token.trim();
    const testUrl = `${this.getBaseUrl()}/balance`;

    try {
      const res = await fetch(testUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          message: 'Conexão com a PushinPay autenticada e validada com sucesso!',
          balance: data,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Falha de autenticação: Token de API da PushinPay inválido ou não autorizado.' };
      }

      if (res.status === 405) {
        return { success: false, message: 'Método não permitido na API da PushinPay (HTTP 405). Verifique a rota da API.' };
      }

      return {
        success: false,
        message: `Falha ao validar credenciais da PushinPay (HTTP ${res.status}). Verifique o token informado.`,
      };
    } catch (err: any) {
      console.error('[PushinPayProvider] testConnection error:', err?.message);
      return { success: false, message: 'Falha ao conectar com o servidor da PushinPay. Verifique sua conexão e tente novamente.' };
    }
  }

  /**
   * Creates a Pix Cash-In charge on PushinPay for an order.
   * Amount is sent in cents as an integer (minimum 50 cents).
   */
  async createPixPayment(params: CreatePaymentParams): Promise<PixPaymentResponse> {
    const existingFlight = PushinPayProvider.inFlightPixRequests.get(params.orderId);
    if (existingFlight) {
      return existingFlight;
    }

    const flightPromise = this.executeCreatePixPayment(params);
    PushinPayProvider.inFlightPixRequests.set(params.orderId, flightPromise);

    try {
      return await flightPromise;
    } finally {
      PushinPayProvider.inFlightPixRequests.delete(params.orderId);
    }
  }

  private async executeCreatePixPayment(params: CreatePaymentParams): Promise<PixPaymentResponse> {
    if (!params.orderId) {
      throw new Error('orderId é obrigatório para gerar Pix via PushinPay.');
    }

    // 1. Verify order in database and protect against concurrent duplicate charges
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, params.orderId),
    });

    if (order) {
      if (order.status === 'paid') {
        throw new Error('Este pedido já foi pago.');
      }

      // Concurrency & Idempotency: reuse active non-expired Pix charge if already generated in DB
      if (
        order.paymentMethod === 'pushinpay' &&
        order.paymentId &&
        order.pixQrCode &&
        order.pixExpiresAt &&
        new Date(order.pixExpiresAt) > new Date()
      ) {
        return {
          paymentId: order.paymentId,
          status: 'pending',
          qrCode: order.pixQrCode,
          qrCodeBase64: order.pixQrCodeBase64 || '',
          expiresAt: new Date(order.pixExpiresAt),
        };
      }
    }

    // Amount validation in cents (Minimum 50 cents)
    const amountInCents = Math.round(Number(params.amount) * 100);
    if (isNaN(amountInCents) || amountInCents < 50) {
      throw new Error('Valor mínimo para cobrança via PushinPay é R$ 0,50 (50 centavos).');
    }

    // Resolve seller PushinPay connection
    const conn = await this.getPushinPayConnection(params.sellerId);
    if (!conn || !conn.token) {
      throw new Error('PushinPay não está configurada ou ativa para esta loja.');
    }

    // Build dedicated webhook URL for this connection with order_id query parameter
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.webgran.online');
    let cleanAppUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    if (cleanAppUrl.includes('webgran.online') && !cleanAppUrl.includes('www.webgran.online')) {
      cleanAppUrl = cleanAppUrl.replace('webgran.online', 'www.webgran.online');
    }
    const webhookUrl = `${cleanAppUrl.replace(/\/+$/, '')}/api/webhooks/pushinpay/${conn.id}?order_id=${params.orderId}`;

    const cashInUrl = `${this.getBaseUrl()}/pix/cashIn`;
    const payload = {
      value: amountInCents,
      webhook_url: webhookUrl,
    };

    let res: Response;
    try {
      res = await fetch(cashInUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr: any) {
      console.error('[PushinPayProvider] Network error creating Pix:', netErr?.message);
      throw new Error('Não foi possível conectar aos servidores da PushinPay. Tente novamente em alguns instantes.');
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error(`[PushinPayProvider] Pix CashIn error HTTP ${res.status}:`, errorText);

      if (res.status === 401 || res.status === 403) {
        throw new Error('Falha de autenticação na PushinPay. Verifique o token no painel de recebimentos.');
      }
      if (res.status === 400 || res.status === 422) {
        throw new Error(`Dados de cobrança recusados pela PushinPay (Erro ${res.status}).`);
      }
      throw new Error(`Erro ao gerar Pix na PushinPay (HTTP ${res.status}). Tente novamente.`);
    }

    const data: PushinPayCashInResponse = await res.json();

    if (!data.id || !data.qr_code) {
      throw new Error('Resposta inválida da PushinPay: id ou qr_code ausentes.');
    }

    const paymentId = String(data.id);
    const pixCode = String(data.qr_code);
    const qrCodeBase64 = data.qr_code_base64 || '';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    // Persist PushinPay charge in database
    await db.update(orders)
      .set({
        paymentId,
        paymentMethod: 'pushinpay',
        pixQrCode: pixCode,
        pixQrCodeBase64: qrCodeBase64,
        pixExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, params.orderId));

    return {
      paymentId,
      status: 'pending',
      qrCode: pixCode,
      qrCodeBase64,
      expiresAt,
    };
  }


  /**
   * Queries Pix transaction status from PushinPay API: GET /transactions/{id}
   */
  async getPixPaymentStatus(paymentId: string, apiToken: string): Promise<PushinPayTransactionResponse | null> {
    if (!paymentId || !apiToken) return null;

    const queryUrl = `${this.getBaseUrl()}/transactions/${paymentId}`;
    try {
      const res = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken.trim()}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        console.warn(`[PushinPayProvider] Status query HTTP ${res.status} for payment ${paymentId}`);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.error('[PushinPayProvider] Error querying payment status:', err?.message);
      return null;
    }
  }

  /**
   * Authenticates incoming PushinPay webhooks.
   * PushinPay supports sending a custom header configured in the merchant panel (e.g. X-PushinPay-Token or Authorization).
   */
  verifyWebhookAuth(headers: Headers | Record<string, string | null | undefined>, webhookSecret: string): boolean {
    if (!webhookSecret) return true; // If no secret configured, fallback to connection validation

    const getHeader = (name: string): string | null => {
      if (typeof (headers as any)?.get === 'function') {
        return (headers as Headers).get(name);
      }
      const rec = headers as Record<string, string | null | undefined>;
      return rec[name.toLowerCase()] || rec[name] || null;
    };

    // Supported headers where the merchant might configure the secret
    const headerCandidates = [
      getHeader('x-pushinpay-token'),
      getHeader('x-pushinpay-secret'),
      getHeader('x-webhook-secret'),
      getHeader('x-custom-header'),
      getHeader('x-api-key'),
      getHeader('authorization'),
    ].filter(Boolean) as string[];

    const expectedBuf = Buffer.from(webhookSecret.trim());

    for (const rawVal of headerCandidates) {
      let candidate = rawVal.trim();
      if (candidate.toLowerCase().startsWith('bearer ')) {
        candidate = candidate.slice(7).trim();
      }

      const candBuf = Buffer.from(candidate);
      if (candBuf.length === expectedBuf.length && crypto.timingSafeEqual(candBuf, expectedBuf)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Processes incoming PushinPay Webhook notifications.
   * Ensures strict idempotency via paymentWebhookEvents, payload verification, store isolation, and atomic order transition.
   */
  async handleWebhook(
    connectionId: string,
    rawBody: string,
    headers: Headers | Record<string, string | null | undefined>,
    orderIdHint?: string
  ): Promise<{ success: boolean; alreadyProcessed?: boolean; pending?: boolean; error?: string }> {

    // 1. Locate connection
    const conn = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.id, connectionId),
        eq(sellerPaymentConnections.provider, 'pushinpay')
      ),
    });

    if (!conn) {
      return { success: false, error: 'Conexão PushinPay não encontrada.' };
    }

    // 2. Validate Custom Header Authentication (if merchant configured secret)
    const webhookSecret = conn.webhookSecretEncrypted ? decrypt(conn.webhookSecretEncrypted) : '';
    if (webhookSecret) {
      const isAuthValid = this.verifyWebhookAuth(headers, webhookSecret);
      if (!isAuthValid) {
        console.warn(`[PushinPayWebhook] Autenticação do webhook inválida para conexão ${connectionId}`);
        return { success: false, error: 'Autenticação do webhook inválida.' };
      }
    }

    // 3. Parse Body (JSON, URL-encoded, BOM-safe, or form data)
    let payload: any = {};
    const cleanBody = (rawBody || '').replace(/^\uFEFF/, '').trim();

    if (cleanBody) {
      if (cleanBody.startsWith('{') || cleanBody.startsWith('[')) {
        try {
          payload = JSON.parse(cleanBody);
        } catch {
          return { success: false, error: 'Body do webhook não é um JSON válido.' };
        }
      } else if (cleanBody.includes('=')) {
        try {
          const params = new URLSearchParams(cleanBody);
          const parsedParams: Record<string, any> = {};
          let paramCount = 0;
          for (const [key, val] of params.entries()) {
            parsedParams[key] = val;
            paramCount++;
          }
          if (paramCount > 0 && (parsedParams.id || parsedParams.transaction_id || parsedParams.status || parsedParams.value)) {
            payload = parsedParams;
          }
        } catch {
          // ignore
        }
      } else {
        return { success: false, error: 'Body do webhook não é um JSON válido.' };
      }
    }

    let transactionId = String(
      payload.id || 
      payload.transaction_id || 
      payload.transactionId || 
      payload.ID || 
      payload.tx_id || 
      ''
    ).trim();

    let rawStatus = String(payload.status || payload.Status || '').toLowerCase().trim();

    // Fallback: If body was empty or missing transactionId, but orderIdHint was passed in URL query param
    if (!transactionId && orderIdHint) {
      const hintOrder = await db.query.orders.findFirst({
        where: eq(orders.id, orderIdHint),
      });
      if (hintOrder?.paymentId && hintOrder.paymentMethod === 'pushinpay') {
        transactionId = hintOrder.paymentId;
        rawStatus = rawStatus || 'paid';
      }
    }

    if (!transactionId) {
      return { success: false, error: 'ID da transação ausente no webhook PushinPay.' };
    }

    // 4. Construct persistent idempotent event key
    // If webhook does not provide event_id, use composite key based on transaction and status
    const eventId = String(payload.event_id || `pushin_${transactionId}_${rawStatus}`).trim();

    // Idempotency check via paymentWebhookEvents
    const existingEvent = await db.query.paymentWebhookEvents.findFirst({
      where: and(
        eq(paymentWebhookEvents.provider, 'pushinpay'),
        eq(paymentWebhookEvents.eventId, eventId)
      ),
    });

    if (existingEvent) {
      return { success: true, alreadyProcessed: true };
    }

    // Record event
    try {
      await db.insert(paymentWebhookEvents).values({
        provider: 'pushinpay',
        eventId,
        eventType: rawStatus,
        connectionId,
        payload,
      });
    } catch {
      // Ignore unique constraint race
    }

    // 5. Find Order strictly by paymentId (Charge created for that order) - Case-Insensitive for UUID safety
    let order = await db.query.orders.findFirst({
      where: and(
        eq(orders.paymentId, transactionId),
        eq(orders.paymentMethod, 'pushinpay')
      ),
    });

    if (!order) {
      order = await db.query.orders.findFirst({
        where: and(
          eq(orders.paymentId, transactionId.toLowerCase()),
          eq(orders.paymentMethod, 'pushinpay')
        ),
      });
    }

    if (!order) {
      order = await db.query.orders.findFirst({
        where: and(
          eq(orders.paymentId, transactionId.toUpperCase()),
          eq(orders.paymentMethod, 'pushinpay')
        ),
      });
    }

    if (!order) {
      console.warn(`[PushinPayWebhook] Nenhum pedido encontrado vinculado à transação ${transactionId}`);
      return { success: true };
    }

    // Guard against order_id URL manipulation (case-insensitive)
    if (orderIdHint && order.id.toLowerCase() !== orderIdHint.toLowerCase()) {
      console.error(`[PushinPayWebhook] Alerta de segurança: parâmetro order_id da URL (${orderIdHint}) diverge do pedido associado à transação (${order.id})`);
      return { success: false, error: 'Parâmetro order_id inconsistente com a transação.' };
    }

    // Assert paymentId explicitly matches transactionId (case-insensitive)
    if (!order.paymentId || order.paymentId.toLowerCase() !== transactionId.toLowerCase()) {
      console.error(`[PushinPayWebhook] Alerta de segurança: paymentId do pedido (${order.paymentId}) não confere com transactionId (${transactionId})`);
      return { success: false, error: 'Identificador da transação diverge do pedido.' };
    }

    // 6. Multi-Tenant Guard: Confirm order, store, seller and connection validate in conjunction
    if (conn.storeId && order.storeId !== conn.storeId) {
      console.error(`[PushinPayWebhook] Alerta de segurança: Pedido ${order.id} não pertence à loja da conexão ${connectionId}`);
      return { success: false, error: 'Acesso negado: loja incorreta.' };
    }

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, order.storeId),
    });

    if (!store || (conn.sellerId && store.ownerId !== conn.sellerId)) {
      console.error(`[PushinPayWebhook] Alerta de segurança: Vendedor ${conn.sellerId} não é proprietário da loja do pedido ${order.id}`);
      return { success: false, error: 'Acesso negado: loja incorreta.' };
    }

    // 7. Value confirmation (Payload value in cents vs Order total in cents)
    const expectedCents = Math.round(Number(order.total) * 100);
    if (payload.value !== undefined && payload.value !== null && payload.value !== '') {
      let receivedCents = Number(payload.value);
      if (!isNaN(receivedCents) && receivedCents === Number(order.total) && expectedCents > receivedCents * 10) {
        receivedCents = Math.round(receivedCents * 100);
      }
      if (!isNaN(receivedCents) && receivedCents !== expectedCents) {
        console.error(`[PushinPayWebhook] Divergência de valores! Pedido ${order.id}: esperado ${expectedCents} centavos, recebido ${receivedCents}`);
        return { success: false, error: 'Divergência de valor na cobrança.' };
      }
    }

    // 8. Order Status Progression Guard
    if (order.status === 'paid') {
      return { success: true, alreadyProcessed: true };
    }

    // Only strictly 'paid' status confirms payment
    const isPaid = rawStatus === 'paid';
    const isCanceled = rawStatus === 'canceled' || rawStatus === 'expired';

    if (isPaid) {
      // Direct Official API Verification (Notification alone is NOT sufficient to release order)
      if (!conn.accessTokenEncrypted) {
        console.error(`[PushinPayWebhook] Conexão ${connectionId} não possui token de API para validação oficial.`);
        return { success: false, error: 'Token de autenticação da conexão não disponível.' };
      }

      let token = '';
      try {
        token = decrypt(conn.accessTokenEncrypted);
      } catch {
        token = '';
      }

      if (!token) {
        console.error(`[PushinPayWebhook] Falha ao descriptografar token para validação oficial.`);
        return { success: false, error: 'Falha na autenticação da API oficial PushinPay.' };
      }

      const officialTx = await this.getPixPaymentStatus(transactionId, token);
      if (!officialTx) {
        console.error(`[PushinPayWebhook] Transação ${transactionId} não confirmada na API oficial da PushinPay.`);
        return { success: false, error: 'Transação não confirmada na API oficial.' };
      }

      // Validate official API returned transaction identifier matches persisted order.paymentId & transactionId (case-insensitive)
      if (
        String(officialTx.id).trim().toLowerCase() !== transactionId.toLowerCase() ||
        String(officialTx.id).trim().toLowerCase() !== String(order.paymentId).trim().toLowerCase()
      ) {
        console.error(`[PushinPayWebhook] ID retornado pela API oficial (${officialTx.id}) diverge do pedido (${order.paymentId})`);
        return { success: false, error: 'Identificador retornado pela API oficial não confere com o pedido.' };
      }

      const officialStatus = String(officialTx.status || '').toLowerCase().trim();
      if (officialStatus !== 'paid') {
        console.warn(`[PushinPayWebhook] Status divergente na API oficial: esperado 'paid', retornado '${officialStatus}'`);
        return { success: false, error: 'Status de pagamento não confirmado pela API oficial.' };
      }

      if (officialTx.value !== undefined && officialTx.value !== null) {
        const officialCents = Number(officialTx.value);
        if (!isNaN(officialCents) && officialCents !== expectedCents) {
          console.error(`[PushinPayWebhook] Divergência de valores na API oficial! Pedido ${order.id}: esperado ${expectedCents}, retornado ${officialCents}`);
          return { success: false, error: 'Divergência de valor na cobrança oficial.' };
        }
      }

      const updatedRows = await db.update(orders)
        .set({
          status: 'paid',
          paymentMethod: 'pushinpay',
          paymentId: transactionId,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending') // ATOMIC GUARD
        ))
        .returning();

      if (updatedRows.length > 0) {
        console.log(`[PushinPayWebhook] Pedido ${order.id} confirmado via PushinPay! Processando entrega...`);
        await AccessDeliveryService.processOrderDelivery(order.id);
      }

      return { success: true };
    } else if (isCanceled) {
      await db.update(orders)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending')
        ));

      return { success: true };
    }

    // Status 'created' or other intermediate status remains pending
    return { success: true, pending: true };
  }
}

export const pushinPayProvider = new PushinPayProvider();

