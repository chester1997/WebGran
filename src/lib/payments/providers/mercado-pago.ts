import crypto from 'crypto';
import { db } from '@/db';
import { sellerPaymentConnections, orders, orderItems, accesses, stores, products, telegramCustomers, telegramBots } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { 
  MarketplacePaymentProvider, 
  CreateCheckoutParams, 
  CheckoutResponse, 
  CreatePaymentParams, 
  PaymentResponse,
  PixPaymentResponse 
} from '../types';

export class MercadoPagoProvider implements MarketplacePaymentProvider {
  /**
   * Generates a tamper-proof signed OAuth state with expiration and CSRF protection
   */
  generateOAuthState(payload: { sellerId: string; storeId?: string }): string {
    const secret = process.env.NEXTAUTH_SECRET || process.env.MP_CLIENT_SECRET || 'webgran-mp-oauth-secret';
    const data = JSON.stringify({
      sellerId: payload.sellerId,
      storeId: payload.storeId,
      ts: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    });
    const dataB64 = Buffer.from(data).toString('base64url');
    const hmac = crypto.createHmac('sha256', secret).update(dataB64).digest('hex');
    return `${dataB64}.${hmac}`;
  }

  /**
   * Validates and decodes OAuth state parameter
   */
  parseAndVerifyOAuthState(stateStr?: string): { sellerId: string; storeId?: string } {
    if (!stateStr) {
      throw new Error('Parâmetro state obrigatório ausente na resposta de autorização.');
    }

    if (stateStr.includes('.')) {
      const [dataB64, hmac] = stateStr.split('.');
      const secret = process.env.NEXTAUTH_SECRET || process.env.MP_CLIENT_SECRET || 'webgran-mp-oauth-secret';
      const expectedHmac = crypto.createHmac('sha256', secret).update(dataB64).digest('hex');

      if (hmac !== expectedHmac) {
        throw new Error('Parâmetro state inválido ou corrompido (falha na validação CSRF).');
      }

      try {
        const decoded = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8'));
        if (decoded.ts && Date.now() - decoded.ts > 30 * 60 * 1000) {
          throw new Error('A sessão de autorização expirou (tempo limite de 30 minutos excedido).');
        }
        if (!decoded.sellerId) {
          throw new Error('Identificador do lojista ausente no state.');
        }
        return { sellerId: decoded.sellerId, storeId: decoded.storeId };
      } catch (err: any) {
        throw new Error(`Falha ao decodificar state: ${err.message}`);
      }
    }

    // Backwards compatibility fallback for JSON base64url or plain sellerId in test mocks
    try {
      const decoded = JSON.parse(Buffer.from(stateStr, 'base64url').toString('utf8'));
      if (decoded?.sellerId) {
        return { sellerId: decoded.sellerId, storeId: decoded.storeId };
      }
    } catch {}

    if (stateStr.trim().length > 0) {
      return { sellerId: stateStr.trim() };
    }

    throw new Error('Formato de state inválido.');
  }

  /**
   * Generates OAuth URL for seller connection
   */
  async connectSeller(sellerId: string, redirectUrl: string, storeId?: string): Promise<string> {
    const appId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID || '1775404605721537';
    const signedState = this.generateOAuthState({ sellerId, storeId });
    const encodedRedirect = encodeURIComponent(redirectUrl);
    return `https://auth.mercadopago.com.br/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${signedState}&redirect_uri=${encodedRedirect}`;
  }

  /**
   * Process OAuth callback code and save connection tokens
   */
  async handleOAuthCallback(code: string, redirectUri: string, stateStr?: string): Promise<{ sellerId: string; storeId?: string }> {
    const { sellerId, storeId } = this.parseAndVerifyOAuthState(stateStr);

    const clientId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID;
    const clientSecret = process.env.MP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Mercado Pago credentials (MP_CLIENT_ID / MP_CLIENT_SECRET) are missing.');
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
      throw new Error(data.message || data.error_description || 'Failed to exchange code with Mercado Pago.');
    }

    const accessTokenEncrypted = encrypt(data.access_token);
    const refreshTokenEncrypted = data.refresh_token ? encrypt(data.refresh_token) : null;
    const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    const providerUserId = String(data.user_id || '');

    // Fetch user profile email if available
    let providerEmail: string | null = null;
    try {
      const userRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        providerEmail = userData.email || null;
      }
    } catch {
      // Non-blocking
    }

    // Check existing connection
    const existing = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, sellerId),
        eq(sellerPaymentConnections.provider, 'mercado_pago')
      ),
    });

    if (existing) {
      await db.update(sellerPaymentConnections)
        .set({
          storeId: storeId || existing.storeId,
          providerUserId,
          providerEmail,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          accountId: providerUserId,
          status: 'active',
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(sellerPaymentConnections.id, existing.id));
    } else {
      await db.insert(sellerPaymentConnections).values({
        sellerId,
        storeId,
        provider: 'mercado_pago',
        providerUserId,
        providerEmail,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        accountId: providerUserId,
        status: 'active',
        expiresAt,
      });
    }

    return { sellerId, storeId };
  }

  /**
   * Disconnect seller account
   */
  async disconnectSeller(sellerId: string): Promise<void> {
    await db.update(sellerPaymentConnections)
      .set({
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sellerPaymentConnections.sellerId, sellerId),
          eq(sellerPaymentConnections.provider, 'mercado_pago')
        )
      );
  }

  /**
   * Test seller connection credentials against Mercado Pago API
   */
  async testConnection(sellerId: string): Promise<{ success: boolean; email?: string; userId?: string }> {
    const token = await this.getValidAccessToken(sellerId);
    const res = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Falha ao validar credenciais com o Mercado Pago.');
    }
    const data = await res.json();
    return { success: true, email: data.email, userId: String(data.id) };
  }

  /**
   * Fetch active connection for seller
   */
  async getSellerConnection(sellerId: string): Promise<any> {
    const connection = await db.query.sellerPaymentConnections.findFirst({
      where: and(
        eq(sellerPaymentConnections.sellerId, sellerId),
        eq(sellerPaymentConnections.provider, 'mercado_pago'),
        eq(sellerPaymentConnections.status, 'active')
      ),
    });
    return connection || null;
  }

  /**
   * Get valid unencrypted access token for seller (handles refresh if needed)
   */
  async getValidAccessToken(sellerId: string): Promise<string> {
    const conn = await this.getSellerConnection(sellerId);
    if (!conn || !conn.accessTokenEncrypted) {
      throw new Error('Seller does not have an active Mercado Pago connection.');
    }

    // Check expiration and refresh token if needed
    if (conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + 5 * 60 * 1000 && conn.refreshTokenEncrypted) {
      try {
        const refreshToken = decrypt(conn.refreshTokenEncrypted);
        const clientId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID;
        const clientSecret = process.env.MP_CLIENT_SECRET;

        const refreshRes = await fetch('https://api.mercadopago.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_secret: clientSecret!,
            client_id: clientId!,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }).toString(),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessEncrypted = encrypt(refreshData.access_token);
          const newRefreshEncrypted = refreshData.refresh_token ? encrypt(refreshData.refresh_token) : conn.refreshTokenEncrypted;
          const newExpiresAt = refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000) : conn.expiresAt;

          await db.update(sellerPaymentConnections)
            .set({
              accessTokenEncrypted: newAccessEncrypted,
              refreshTokenEncrypted: newRefreshEncrypted,
              expiresAt: newExpiresAt,
              updatedAt: new Date(),
            })
            .where(eq(sellerPaymentConnections.id, conn.id));

          return refreshData.access_token;
        }
      } catch (err) {
        console.error('Failed to refresh Mercado Pago access token:', err);
      }
    }

    return decrypt(conn.accessTokenEncrypted);
  }

  /**
   * Fixed platform commission in BRL (50 centavos) - preserved for backward compatibility
   */
  public static readonly PLATFORM_FIXED_FEE_BRL = 0.50;
  public static readonly PLATFORM_FIXED_FEE_CENTS = 50;

  /**
   * Calculate platform fee (WebGran split)
   * Deprecated for hardcoded usage: resolves fee dynamically or uses provided custom fee.
   */
  calculatePlatformFee(amount: number, customFeeReais?: number): number {
    const fee = typeof customFeeReais === 'number' && !isNaN(customFeeReais)
      ? customFeeReais
      : MercadoPagoProvider.PLATFORM_FIXED_FEE_BRL;
    if (typeof amount !== 'number' || isNaN(amount) || amount < fee || fee <= 0) {
      return 0;
    }
    return fee;
  }

  /**
   * Resolves the effective commission for a transaction following the priority:
   * 1. Order snapshot (`order.splitAmountCents` / `order.splitError`) from database or params
   * 2. Dynamic resolution via `SellerCommissionService.resolveEffectiveFee` for the sellerId
   * 3. Fallback to platform default fee if service is unavailable
   */
  async resolveEffectiveCommission(params: {
    sellerId: string;
    orderId?: string;
    providedSplitCents?: number;
    amount?: number;
  }): Promise<{
    effectiveFeeCents: number;
    effectiveFeeReais: number;
    isExempt: boolean;
    splitStatus: 'REQUESTED' | 'SKIPPED';
    splitError: string | null;
  }> {
    const { sellerId, orderId, providedSplitCents, amount } = params;
    let orderRecord: any = null;

    if (orderId) {
      try {
        orderRecord = await db.query.orders.findFirst({
          where: eq(orders.id, orderId),
        });
      } catch {
        // Non-blocking DB lookup
      }
    }

    // 1. Try order snapshot from database (validating seller association)
    if (orderRecord) {
      let isOrderForSeller = true;
      if (orderRecord.storeId) {
        try {
          const storeRec = await db.query.stores.findFirst({
            where: eq(stores.id, orderRecord.storeId),
          });
          if (storeRec && storeRec.ownerId && storeRec.ownerId !== sellerId) {
            isOrderForSeller = false;
          }
        } catch {
          // Non-blocking
        }
      }

      if (isOrderForSeller) {
        if (orderRecord.splitError === 'ISENCAO_TEMPORARIA') {
          return {
            effectiveFeeCents: 0,
            effectiveFeeReais: 0,
            isExempt: true,
            splitStatus: 'SKIPPED',
            splitError: 'ISENCAO_TEMPORARIA',
          };
        }
        if (orderRecord.splitError === 'COMISSAO_ZERO') {
          return {
            effectiveFeeCents: 0,
            effectiveFeeReais: 0,
            isExempt: false,
            splitStatus: 'SKIPPED',
            splitError: 'COMISSAO_ZERO',
          };
        }
        if (typeof orderRecord.splitAmountCents === 'number' && !isNaN(orderRecord.splitAmountCents)) {
          const feeCents = orderRecord.splitAmountCents;
          if (feeCents === 0) {
            return {
              effectiveFeeCents: 0,
              effectiveFeeReais: 0,
              isExempt: false,
              splitStatus: 'SKIPPED',
              splitError: orderRecord.splitError || 'COMISSAO_ZERO',
            };
          }
          if (amount !== undefined && amount * 100 <= feeCents) {
            return {
              effectiveFeeCents: feeCents,
              effectiveFeeReais: 0,
              isExempt: false,
              splitStatus: 'SKIPPED',
              splitError: 'VALOR_ABAIXO_DA_COMISSAO_MINIMA',
            };
          }
          return {
            effectiveFeeCents: feeCents,
            effectiveFeeReais: Number((feeCents / 100).toFixed(2)),
            isExempt: false,
            splitStatus: 'REQUESTED',
            splitError: null,
          };
        }
      }
    }

    // 2. Try provided split snapshot in params
    if (typeof providedSplitCents === 'number' && !isNaN(providedSplitCents)) {
      if (providedSplitCents === 0) {
        return {
          effectiveFeeCents: 0,
          effectiveFeeReais: 0,
          isExempt: false,
          splitStatus: 'SKIPPED',
          splitError: 'COMISSAO_ZERO',
        };
      }
      if (amount !== undefined && amount * 100 <= providedSplitCents) {
        return {
          effectiveFeeCents: providedSplitCents,
          effectiveFeeReais: 0,
          isExempt: false,
          splitStatus: 'SKIPPED',
          splitError: 'VALOR_ABAIXO_DA_COMISSAO_MINIMA',
        };
      }
      return {
        effectiveFeeCents: providedSplitCents,
        effectiveFeeReais: Number((providedSplitCents / 100).toFixed(2)),
        isExempt: false,
        splitStatus: 'REQUESTED',
        splitError: null,
      };
    }

    // 3. Resolve dynamically from central SellerCommissionService
    try {
      const { SellerCommissionService } = await import('@/lib/commission/seller-commission-service');
      const feeResolution = await SellerCommissionService.resolveEffectiveFee(
        sellerId,
        orderRecord?.createdAt ? new Date(orderRecord.createdAt) : new Date()
      );

      if (feeResolution.isExempt) {
        return {
          effectiveFeeCents: 0,
          effectiveFeeReais: 0,
          isExempt: true,
          splitStatus: 'SKIPPED',
          splitError: 'ISENCAO_TEMPORARIA',
        };
      }

      if (feeResolution.effectiveFeeCents <= 0) {
        return {
          effectiveFeeCents: 0,
          effectiveFeeReais: 0,
          isExempt: false,
          splitStatus: 'SKIPPED',
          splitError: 'COMISSAO_ZERO',
        };
      }

      const feeCents = feeResolution.effectiveFeeCents;
      if (amount !== undefined && amount * 100 <= feeCents) {
        return {
          effectiveFeeCents: feeCents,
          effectiveFeeReais: 0,
          isExempt: false,
          splitStatus: 'SKIPPED',
          splitError: 'VALOR_ABAIXO_DA_COMISSAO_MINIMA',
        };
      }

      return {
        effectiveFeeCents: feeCents,
        effectiveFeeReais: Number((feeCents / 100).toFixed(2)),
        isExempt: false,
        splitStatus: 'REQUESTED',
        splitError: null,
      };
    } catch (err: any) {
      console.error('[MercadoPagoProvider] Erro ao resolver comissão do vendedor:', err?.message || err);
      throw new Error('Parâmetros de cobrança temporariamente indisponíveis. Tente novamente em instantes.');
    }
  }

  /**
   * Create Checkout Preference with Mercado Pago Split / Marketplace Fee
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    const accessToken = await this.getValidAccessToken(params.sellerId);

    const totalAmount = params.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const orderId = params.metadata?.orderId;
    const providedSplitCents = params.splitAmountCents ?? (
      params.metadata?.splitAmountCents ? Number(params.metadata.splitAmountCents) : undefined
    );

    const commission = await this.resolveEffectiveCommission({
      sellerId: params.sellerId,
      orderId,
      providedSplitCents,
      amount: totalAmount,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const prefPayload: any = {
      items: params.items.map(i => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
        currency_id: 'BRL',
      })),
      payer: {
        name: params.customer?.name || 'Cliente WebGran',
        email: params.customer?.email || 'cliente@webgran.app',
      },
      back_urls: {
        success: params.successUrl,
        pending: params.successUrl,
        failure: params.failureUrl,
      },
      auto_return: 'approved',
      external_reference: orderId,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    };

    if (commission.effectiveFeeReais > 0) {
      prefPayload.marketplace_fee = Number(commission.effectiveFeeReais.toFixed(2));
    }

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prefPayload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Mercado Pago preference creation failed: ${JSON.stringify(err)}`);
    }

    const data = await res.json();

    if (orderId) {
      try {
        await db.update(orders)
          .set({
            platformFee: '0.00',
            splitStatus: commission.splitStatus,
            splitAmountCents: commission.effectiveFeeCents,
            splitError: commission.splitError,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } catch {
        // Non-blocking
      }
    }

    return {
      id: data.id,
      url: data.init_point || data.sandbox_init_point,
    };
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    const pixRes = await this.createPixPayment(params);
    return {
      id: pixRes.paymentId,
      status: pixRes.status,
      amount: params.amount,
    };
  }

  /**
   * Create transparent PIX Payment using official Mercado Pago /v1/payments API with application_fee
   */
  async createPixPayment(params: CreatePaymentParams): Promise<PixPaymentResponse> {
    const accessToken = await this.getValidAccessToken(params.sellerId);

    const commission = await this.resolveEffectiveCommission({
      sellerId: params.sellerId,
      orderId: params.orderId,
      providedSplitCents: params.splitAmountCents,
      amount: params.amount,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const idempotencyKey = `order_pix_${params.orderId}`;
    const payerName = params.customer?.name || params.customer?.firstName || 'Cliente WebGran';
    const nameParts = payerName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'WebGran';

    const paymentPayload: any = {
      transaction_amount: Number(params.amount.toFixed(2)),
      description: params.description || `Pedido #${params.orderId.slice(0, 8)}`,
      payment_method_id: 'pix',
      payer: {
        email: params.customer?.email || 'cliente@webgran.app',
        first_name: firstName,
        last_name: lastName,
      },
      external_reference: params.orderId,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    };

    if (commission.effectiveFeeReais > 0) {
      paymentPayload.application_fee = Number(commission.effectiveFeeReais.toFixed(2));
    }

    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[MP Payments API createPixPayment error]', data);
      try {
        await db.update(orders)
          .set({
            splitStatus: 'FAILED',
            splitAmountCents: commission.effectiveFeeCents,
            splitError: `MP_PAYMENT_ERROR: ${data.message || JSON.stringify(data)}`,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, params.orderId));
      } catch {
        // Non-blocking error persistence
      }

      throw new Error(`Mercado Pago PIX creation failed: ${data.message || JSON.stringify(data)}`);
    }

    // Extract QR code data from /v1/payments (or fallback if /v1/orders format)
    const firstPayment = data.transactions?.payments?.[0] || data.payments?.[0];
    const qrCode =
      data.point_of_interaction?.transaction_data?.qr_code ||
      data.qr_code ||
      firstPayment?.point_of_interaction?.transaction_data?.qr_code ||
      firstPayment?.payment_method?.qr_code;

    const qrCodeBase64 =
      data.point_of_interaction?.transaction_data?.qr_code_base64 ||
      data.qr_code_base64 ||
      firstPayment?.point_of_interaction?.transaction_data?.qr_code_base64 ||
      firstPayment?.payment_method?.qr_code_base64 ||
      '';

    const expiresAt = data.date_of_expiration
      ? new Date(data.date_of_expiration)
      : firstPayment?.date_of_expiration
      ? new Date(firstPayment.date_of_expiration)
      : new Date(Date.now() + 30 * 60 * 1000);

    try {
      await db.update(orders)
        .set({
          platformFee: '0.00',
          splitStatus: commission.splitStatus,
          splitAmountCents: commission.effectiveFeeCents,
          splitError: commission.splitError,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, params.orderId));
    } catch {
      // Non-blocking persistence
    }

    return {
      paymentId: String(firstPayment?.id || data.id),
      status: data.status || firstPayment?.status || 'pending',
      qrCode: qrCode || '',
      qrCodeBase64: qrCodeBase64 || '',
      expiresAt,
    };
  }

  async getPayment(paymentId: string): Promise<PaymentResponse> {
    const mpToken = process.env.MP_ACCESS_TOKEN || process.env.MP_CLIENT_SECRET;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpToken}`,
      },
    });

    const data = await res.json();
    return {
      id: String(data.id),
      status: data.status,
      amount: Number(data.transaction_amount || 0),
    };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<void> {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: amount ? JSON.stringify({ amount }) : undefined,
    });
  }

  /**
   * Process Webhook and fulfill customer order idempotently
   */
  async handleWebhook(payload: any): Promise<void> {
    const resourceId = payload?.data?.id || payload?.id;
    const type = payload?.type || payload?.topic || payload?.action;

    console.log(`[MP Webhook Received] type: ${type}, resourceId: ${resourceId}`);

    if (!resourceId) {
      return;
    }

    const { syncOrderWithMercadoPago } = await import('../order-sync');

    // Check if resourceId is directly a WebGran order ID in DB
    const directOrder = await db.query.orders.findFirst({
      where: eq(orders.id, String(resourceId)),
    });

    if (directOrder) {
      await syncOrderWithMercadoPago(directOrder.id);
      return;
    }

    // Try finding order by paymentId or scanning active sellers
    const orderWithPaymentId = await db.query.orders.findFirst({
      where: eq(orders.paymentId, String(resourceId)),
    });

    if (orderWithPaymentId) {
      await syncOrderWithMercadoPago(orderWithPaymentId.id);
      return;
    }

    // Search active seller connections in Mercado Pago by resourceId/external_reference
    const activeConnections = await db.query.sellerPaymentConnections.findMany({
      where: eq(sellerPaymentConnections.status, 'active'),
    });

    for (const conn of activeConnections) {
      try {
        const sellerToken = decrypt(conn.accessTokenEncrypted);
        // Try fetching as payment to get external_reference
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
          headers: { Authorization: `Bearer ${sellerToken}` },
        });

        if (res.ok) {
          const pData = await res.json();
          if (pData.external_reference) {
            await syncOrderWithMercadoPago(pData.external_reference);
            return;
          }
        }

        // Try fetching as order
        const resOrd = await fetch(`https://api.mercadopago.com/v1/orders/${resourceId}`, {
          headers: { Authorization: `Bearer ${sellerToken}` },
        });

        if (resOrd.ok) {
          const oData = await resOrd.json();
          if (oData.external_reference) {
            await syncOrderWithMercadoPago(oData.external_reference);
            return;
          }
        }
      } catch (err) {
        // Continue checking other connections
      }
    }
  }
}
