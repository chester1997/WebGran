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
   * Generates OAuth URL for seller connection
   */
  async connectSeller(sellerId: string, redirectUrl: string, storeId?: string): Promise<string> {
    const appId = process.env.MP_CLIENT_ID || process.env.MP_APP_ID;
    if (!appId) {
      throw new Error('Mercado Pago MP_CLIENT_ID/MP_APP_ID is not configured.');
    }
    const state = JSON.stringify({ sellerId, storeId });
    const encodedState = Buffer.from(state).toString('base64url');
    const encodedRedirect = encodeURIComponent(redirectUrl);
    return `https://auth.mercadopago.com.br/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${encodedState}&redirect_uri=${encodedRedirect}`;
  }

  /**
   * Process OAuth callback code and save connection tokens
   */
  async handleOAuthCallback(code: string, redirectUri: string, stateStr?: string): Promise<{ sellerId: string; storeId?: string }> {
    let sellerId = '';
    let storeId: string | undefined;

    if (stateStr) {
      try {
        const decoded = JSON.parse(Buffer.from(stateStr, 'base64url').toString('utf8'));
        sellerId = decoded.sellerId;
        storeId = decoded.storeId;
      } catch (e) {
        sellerId = stateStr;
      }
    }

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
   * Calculate platform fee (WebGran split)
   */
  calculatePlatformFee(amount: number): number {
    const percentage = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENTAGE || 10);
    return Number(((amount * percentage) / 100).toFixed(2));
  }

  /**
   * Create Checkout Preference with Mercado Pago Split / Marketplace Fee
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    const accessToken = await this.getValidAccessToken(params.sellerId);

    const totalAmount = params.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const platformFee = this.calculatePlatformFee(totalAmount);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const prefPayload = {
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
      external_reference: params.metadata?.orderId,
      marketplace_fee: platformFee,
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    };

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
   * Create transparent PIX Payment using Mercado Pago /v1/orders API
   */
  async createPixPayment(params: CreatePaymentParams): Promise<PixPaymentResponse> {
    const accessToken = await this.getValidAccessToken(params.sellerId);
    const platformFee = this.calculatePlatformFee(params.amount);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const orderPayload = {
      type: "online",
      total_amount: params.amount.toFixed(2),
      external_reference: params.orderId,
      processing_mode: "automatic",
      description: params.description || `Pedido #${params.orderId.slice(0, 8)}`,
      marketplace_fee: platformFee.toFixed(2),
      payer: {
        email: params.customer?.email || 'cliente@webgran.app',
        first_name: params.customer?.name?.split(' ')[0] || params.customer?.firstName || 'Cliente',
        last_name: params.customer?.name?.split(' ').slice(1).join(' ') || params.customer?.lastName || 'WebGran',
      },
      transactions: {
        payments: [
          {
            amount: params.amount.toFixed(2),
            payment_method: {
              id: "pix",
              type: "bank_transfer"
            }
          }
        ]
      }
    };

    const idempotencyKey = `order_pix_${params.orderId}`;

    const res = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[MP Orders API createPixPayment error]', data);
      throw new Error(`Mercado Pago Orders API PIX creation failed: ${data.message || JSON.stringify(data)}`);
    }

    const firstPayment = data.transactions?.payments?.[0] || data.payments?.[0];
    const paymentMethodData = firstPayment?.payment_method || firstPayment?.point_of_interaction?.transaction_data;

    const qrCode = paymentMethodData?.qr_code || firstPayment?.qr_code;
    const qrCodeBase64 = paymentMethodData?.qr_code_base64 || firstPayment?.qr_code_base64;
    const expiresAt = firstPayment?.date_of_expiration ? new Date(firstPayment.date_of_expiration) : new Date(Date.now() + 30 * 60 * 1000);

    if (!qrCode) {
      console.warn('[MP Orders API] missing qr_code in response:', data);
    }

    return {
      paymentId: String(firstPayment?.id || data.id),
      status: firstPayment?.status || data.status || 'pending',
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
