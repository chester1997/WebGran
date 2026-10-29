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

/**
 * Determines whether two PushinPay account identifiers refer to the same account.
 * Accounts are proven identical strictly by exact case-insensitive equality
 * of official identifiers returned by Pushin Pay, after safe normalization.
 * Identifiers that differ in any character (even if sharing a prefix) are NOT presumed identical.
 */
export function isSamePushinPayAccount(
  sellerAccountId: string | null | undefined,
  platformAccountId: string | null | undefined
): boolean {
  if (!sellerAccountId || !platformAccountId) return false;

  const cleanSeller = sellerAccountId.trim().toLowerCase();
  const cleanPlatform = platformAccountId.trim().toLowerCase();

  if (!cleanSeller || !cleanPlatform) return false;

  return cleanSeller === cleanPlatform;
}

/**
 * Resolves the official platform store identifier from explicit server-side configuration.
 * Supported environment variables:
 * - PUSHINPAY_PLATFORM_STORE_ID
 * - PLATFORM_STORE_ID
 * - WEBGRAN_OFFICIAL_STORE_ID
 */
export function getPlatformStoreId(): string | null {
  return process.env.PUSHINPAY_PLATFORM_STORE_ID?.trim() ||
         process.env.PLATFORM_STORE_ID?.trim() ||
         process.env.WEBGRAN_OFFICIAL_STORE_ID?.trim() || null;
}

/**
 * Determines whether a given store ID belongs to the official platform store.
 * Identification is server-side and explicit via verified configuration.
 * Does NOT rely on user role 'admin' or arbitrary ID assumptions.
 */
export function isOfficialPlatformStore(storeId: string | null | undefined): boolean {
  if (!storeId || typeof storeId !== 'string') return false;
  const officialStoreId = getPlatformStoreId();
  if (!officialStoreId) return false;
  return storeId.trim().toLowerCase() === officialStoreId.toLowerCase();
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
        accountId: conn.accountId || null,
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
   * Retrieves official user information from PushinPay API via GET /api/user.
   * Only returns accountId if officially provided by the API; never treats User ID (id) as accountId.
   */
  async getAccountUser(token: string): Promise<{
    success: boolean;
    accountId?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    error?: string;
  }> {
    if (!token?.trim()) {
      return { success: false, error: 'Token PushinPay não informado.' };
    }

    const cleanToken = token.trim();
    const userUrl = `${this.getBaseUrl()}/user`;

    try {
      const res = await fetch(userUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Falha ao obter dados do usuário na PushinPay (HTTP ${res.status}).`,
        };
      }

      const data = await res.json().catch(() => null);
      const accountId = typeof data?.account_id === 'string' && data.account_id.trim() ? data.account_id.trim() : undefined;
      const userId = typeof data?.id === 'string' && data.id.trim() ? data.id.trim() : undefined;

      return {
        success: true,
        accountId,
        userId,
        userName: data?.name || undefined,
        userEmail: data?.email || undefined,
      };
    } catch (err: any) {
      console.error('[PushinPayProvider] getAccountUser error:', err?.message);
      return {
        success: false,
        error: 'Erro de comunicação ao consultar usuário na PushinPay.',
      };
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
    const payload: any = {
      value: amountInCents,
      webhook_url: webhookUrl,
    };

    // Split configuration: dynamic platform commission from SellerCommissionService
    const { SellerCommissionService } = await import('@/lib/commission/seller-commission-service');
    let effectiveFeeCents = 50;
    let isExempt = false;

    try {
      const feeResult = await SellerCommissionService.resolveEffectiveFee(
        params.sellerId,
        order?.createdAt ? new Date(order.createdAt) : new Date()
      );
      effectiveFeeCents = feeResult.effectiveFeeCents;
      isExempt = feeResult.isExempt;
    } catch (commErr: any) {
      console.error('[PushinPayProvider] Erro ao resolver taxa de comissão do vendedor:', commErr?.message);
      throw new Error('Parâmetros de cobrança temporariamente indisponíveis. Tente novamente em instantes.');
    }

    // Preserve immutable order snapshot if explicitly recorded on the order
    if (order?.splitError === 'ISENCAO_TEMPORARIA') {
      isExempt = true;
      effectiveFeeCents = 0;
    } else if (order?.splitError === 'COMISSAO_ZERO') {
      isExempt = false;
      effectiveFeeCents = 0;
    } else if (order && typeof order.splitAmountCents === 'number' && !isNaN(order.splitAmountCents) && order.splitAmountCents !== 50) {
      // Non-default custom snapshot on order is preserved
      effectiveFeeCents = order.splitAmountCents;
    }

    const platformAccountId = process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID?.trim() || 
                              process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID?.trim() || null;
    let splitStatus: 'REQUESTED' | 'GATEWAY_ACCEPTED' | 'FAILED' | 'SKIPPED' = 'REQUESTED';
    let splitError: string | null = null;
    let splitAmountCents = effectiveFeeCents;

    // Resolve store identity for charge
    const chargeStoreId = params.storeId || order?.storeId || conn.storeId || null;
    if (!chargeStoreId) {
      throw new Error('Não foi possível identificar a loja do pedido para emissão da cobrança.');
    }

    if (isExempt) {
      splitStatus = 'SKIPPED';
      splitError = 'ISENCAO_TEMPORARIA';
      splitAmountCents = 0;
    } else if (effectiveFeeCents <= 0) {
      splitStatus = 'SKIPPED';
      splitError = 'COMISSAO_ZERO';
      splitAmountCents = 0;
    } else if (amountInCents <= effectiveFeeCents) {
      // Order amount is too low to split commission leaving merchant balance
      splitStatus = 'SKIPPED';
      splitError = 'VALOR_ABAIXO_DA_COMISSAO_MINIMA';
      splitAmountCents = effectiveFeeCents;
    } else if (platformAccountId) {
      const platformStoreId = getPlatformStoreId();

      if (!platformStoreId) {
        // Bloqueio seguro: Se a identificação da loja oficial da plataforma não estiver configurada,
        // não é possível determinar com segurança se a cobrança é própria ou de terceiro.
        // Interrompe a criação com mensagem explícita, sem enviar split potencialmente inválido.
        throw new Error('Configuração da loja oficial da plataforma ausente (PUSHINPAY_PLATFORM_STORE_ID). Cobrança interrompida para prevenir split potencialmente inválido.');
      }

      if (isOfficialPlatformStore(chargeStoreId)) {
        // Exigência 2: Loja oficial da plataforma:
        // - omite completamente split_rules do payload;
        // - marca o split como SKIPPED com CONTA_PROPRIETARIA_PLATAFORMA;
        // - não registra comissão como transferência de split;
        // - mantém a criação normal da cobrança.
        splitStatus = 'SKIPPED';
        splitError = 'CONTA_PROPRIETARIA_PLATAFORMA';
      } else {
        // Loja de terceiro (incluindo lojas de usuários administradores que não sejam a loja oficial configurada):
        // Preserva o split normal com a taxa efetiva resolvida.
        payload.split_rules = [
          {
            value: effectiveFeeCents,
            account_id: platformAccountId,
          }
        ];
        splitStatus = 'REQUESTED';
      }
    } else {
      // Platform account not configured: do NOT send invalid split rule to prevent gateway rejection
      splitStatus = 'FAILED';
      splitError = 'CONTA_PLATAFORMA_NAO_CONFIGURADA';
    }

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

      // Record split failure if order exists
      try {
        await db.update(orders)
          .set({
            splitStatus: 'FAILED',
            splitAmountCents,
            splitError: `PUSHINPAY_API_ERROR_HTTP_${res.status}: ${errorText.slice(0, 255)}`,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, params.orderId));
      } catch {
        // Non-blocking error persistence
      }

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

    // Se o gateway aceitou a criação com sucesso e espelhou a regra, transiciona para GATEWAY_ACCEPTED
    let creationSplitStatus: 'REQUESTED' | 'GATEWAY_ACCEPTED' | 'FAILED' | 'SKIPPED' = splitStatus;
    if (splitStatus === 'REQUESTED' && (data.split_rules || data.id)) {
      creationSplitStatus = 'GATEWAY_ACCEPTED';
    }

    // Persist PushinPay charge and split audit state in database
    await db.update(orders)
      .set({
        paymentId,
        paymentMethod: 'pushinpay',
        pixQrCode: pixCode,
        pixQrCodeBase64: qrCodeBase64,
        platformFee: '0.00', // Somente reconhecido como receita após processamento confirmado
        splitStatus: creationSplitStatus,
        splitAmountCents,
        splitError,
        splitDetails: data.split_rules ? data.split_rules : (payload.split_rules || null),
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

    const normalizedOrderIdHint = typeof orderIdHint === 'string'
      ? orderIdHint.trim()
      : typeof (orderIdHint as any)?.order_id === 'string'
      ? (orderIdHint as any).order_id.trim()
      : null;

    // Fallback: If body was empty or missing transactionId, but orderIdHint was passed in URL query param
    if (!transactionId && normalizedOrderIdHint) {
      const hintOrder = await db.query.orders.findFirst({
        where: eq(orders.id, normalizedOrderIdHint),
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
    if (normalizedOrderIdHint && order.id.toLowerCase() !== normalizedOrderIdHint.toLowerCase()) {
      console.error(`[PushinPayWebhook] Alerta de segurança: parâmetro order_id da URL (${normalizedOrderIdHint}) diverge do pedido associado à transação (${order.id})`);
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

      // Split Confirmation Logic with strict verification
      const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
      const platformAccountId = process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID?.trim() ||
                                process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID?.trim() || null;

      const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
        order,
        officialTx,
        platformAccountId,
      });

      let orderWasUpdated = false;

      const runUpdateTx = async (tx: any) => {
        const updatePayload: Record<string, any> = {
          status: 'paid',
          paymentMethod: 'pushinpay',
          paymentId: transactionId,
          splitStatus: evalResult.status,
          splitError: evalResult.splitError,
          splitDetails: evalResult.splitDetails,
          paidAt: new Date(),
          updatedAt: new Date(),
        };

        if (evalResult.platformFeeStr !== null) {
          updatePayload.platformFee = evalResult.platformFeeStr;
        }
        if (evalResult.netAmountStr !== null) {
          updatePayload.netAmount = evalResult.netAmountStr;
        }
        if (evalResult.splitConfirmedAt !== null) {
          updatePayload.splitConfirmedAt = evalResult.splitConfirmedAt;
        }

        const updatedRows = await tx.update(orders)
          .set(updatePayload)
          .where(and(
            eq(orders.id, order.id),
            eq(orders.status, 'pending') // ATOMIC GUARD
          ))
          .returning();

        if (updatedRows.length > 0) {
          orderWasUpdated = true;

          // Registrar auditoria financeira dedicada na mesma transação atômica
          if (evalResult.auditAction !== 'NONE') {
            await SplitReconciliationService.recordAuditLog({
              orderId: order.id,
              previousStatus: order.splitStatus,
              newStatus: evalResult.status,
              action: evalResult.auditAction,
              splitAmountCents: typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50,
              platformAccountId,
              evidenceDetails: evalResult.splitDetails,
              notes: evalResult.divergenceReason || null,
            }, tx);
          }
        }
      };

      await (db as any).transaction(runUpdateTx);

      if (orderWasUpdated) {
        console.log(`[PushinPayWebhook] Pedido ${order.id} confirmado via PushinPay! Split: ${evalResult.status}. Processando entrega...`);
        await AccessDeliveryService.processOrderDelivery(order.id);

        if (evalResult.status === 'PROCESSED') {
          try {
            const { PlatformFinancialNotificationService } = await import('@/lib/push/platform-financial-notification-service');
            await PlatformFinancialNotificationService.notifyOwnerOfCommission({
              orderId: order.id,
              eventType: 'SPLIT_PROCESSED',
              platformFeeReais: evalResult.platformFeeStr,
              splitAmountCents: typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50,
            });
          } catch (notifErr) {
            console.warn('[PushinPayWebhook] Falha não bloqueante ao notificar proprietário sobre split:', notifErr);
          }
        }
      }

      return { success: true };
    } else if (isCanceled) {
      // 1. Não sobrescrever estados de pedidos já pagos ou com split processado/liquidado/confirmado
      if (order.status === 'paid' || order.splitStatus === 'PROCESSED' || order.splitStatus === 'SETTLED' || order.splitStatus === 'CONFIRMED') {
        console.warn(`[PushinPayWebhook] Tentativa de cancelar pedido ${order.id} ignorada: pedido já está pago ou com split ${order.splitStatus}.`);
        return { success: true };
      }

      // 2. Tratar corretamente REQUESTED e GATEWAY_ACCEPTED quando a transação for cancelada ou expirar
      let resolvedCancelSplit = order.splitStatus;
      if (order.splitStatus === 'REQUESTED' || order.splitStatus === 'GATEWAY_ACCEPTED') {
        resolvedCancelSplit = 'FAILED';
      }

      const splitAmountCents = typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50;
      let orderWasCancelled = false;

      const runCancelTx = async (tx: any) => {
        const updatedRows = await tx.update(orders)
          .set({
            status: 'cancelled',
            splitStatus: resolvedCancelSplit,
            splitError: 'TRANSACAO_CANCELADA_OU_EXPIRADA',
            platformFee: '0.00',
            updatedAt: new Date(),
          })
          .where(and(
            eq(orders.id, order.id),
            eq(orders.status, 'pending')
          ))
          .returning();

        if (updatedRows.length > 0) {
          orderWasCancelled = true;

          // Se o split transicionou para FAILED, grava a auditoria correspondente na mesma transação
          if (resolvedCancelSplit === 'FAILED') {
            const { SplitReconciliationService } = await import('@/lib/payments/split-reconciliation-service');
            const platformAccountId = process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID?.trim() ||
                                      process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID?.trim() || null;

            await SplitReconciliationService.recordAuditLog({
              orderId: order.id,
              previousStatus: order.splitStatus,
              newStatus: 'FAILED',
              action: 'FAILED',
              splitAmountCents,
              platformAccountId,
              notes: 'Transação cancelada ou expirada no gateway',
            }, tx);
          }
        }
      };

      await (db as any).transaction(runCancelTx);

      if (orderWasCancelled) {
        console.log(`[PushinPayWebhook] Pedido ${order.id} cancelado/expirado via PushinPay. Split atualizado para ${resolvedCancelSplit}.`);
      }

      return { success: true };
    }

    // Status 'created' or other intermediate status remains pending
    return { success: true, pending: true };
  }
}

export const pushinPayProvider = new PushinPayProvider();

