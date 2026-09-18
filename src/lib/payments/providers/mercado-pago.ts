import { db } from '@/db';
import { sellerPaymentConnections, orders, orderItems, accesses, stores } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { 
  MarketplacePaymentProvider, 
  CreateCheckoutParams, 
  CheckoutResponse, 
  CreatePaymentParams, 
  PaymentResponse 
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Error creating Mercado Pago checkout preference.');
    }

    const checkoutUrl = process.env.NODE_ENV === 'production' 
      ? data.init_point 
      : (data.sandbox_init_point || data.init_point);

    return {
      id: data.id,
      url: checkoutUrl,
    };
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    throw new Error('Direct API payments require custom transparent checkout. Use createCheckout preference method instead.');
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
    const paymentId = payload?.data?.id || payload?.id;
    const type = payload?.type || payload?.topic;

    if (!paymentId || (type && type !== 'payment')) {
      return;
    }

    // Fetch payment details from Mercado Pago
    let paymentData: any = null;

    const platformToken = process.env.MP_ACCESS_TOKEN;
    if (platformToken) {
      try {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${platformToken}` },
        });
        if (res.ok) {
          paymentData = await res.json();
        }
      } catch (err) {
        console.error('Error fetching payment with platform token:', err);
      }
    }

    // If platform token failed or was not set, try active seller tokens
    if (!paymentData) {
      const activeConnections = await db.query.sellerPaymentConnections.findMany({
        where: eq(sellerPaymentConnections.status, 'active'),
      });

      for (const conn of activeConnections) {
        try {
          const sellerToken = decrypt(conn.accessTokenEncrypted);
          const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${sellerToken}` },
          });
          if (res.ok) {
            paymentData = await res.json();
            break;
          }
        } catch {
          // Continue trying other connections
        }
      }
    }

    if (!paymentData || !paymentData.external_reference) {
      console.warn(`[MP Webhook] Payment ${paymentId} could not be retrieved or has no external_reference.`);
      return;
    }

    const orderId = paymentData.external_reference;
    const paymentStatus = paymentData.status;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        items: true,
      },
    });

    if (!order) {
      console.warn(`[MP Webhook] Order ${orderId} not found in WebGran database.`);
      return;
    }

    if (paymentStatus === 'approved') {
      const platformFee = Number(paymentData.marketplace_fee || this.calculatePlatformFee(Number(order.total)));
      const netAmount = Number(order.total) - platformFee;

      // Update Order Status to paid
      await db.update(orders)
        .set({
          status: 'paid',
          paymentId: String(paymentId),
          paymentMethod: paymentData.payment_method_id || paymentData.payment_type_id || 'mercado_pago',
          platformFee: String(platformFee),
          netAmount: String(netAmount),
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      // Idempotent Access Fulfillment
      const itemsList = order.items || await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
      });

      for (const item of itemsList) {
        const existingAccess = await db.query.accesses.findFirst({
          where: and(
            eq(accesses.orderId, order.id),
            eq(accesses.productId, item.productId)
          ),
        });

        if (!existingAccess) {
          await db.insert(accesses).values({
            storeId: order.storeId,
            customerId: order.customerId,
            productId: item.productId,
            orderId: order.id,
            status: 'active',
            grantedAt: new Date(),
          });
        }
      }

      console.log(`[MP Webhook] Successfully processed payment ${paymentId} for order ${order.id}. Granted access.`);
    } else if (paymentStatus === 'cancelled' || paymentStatus === 'rejected') {
      if (order.status === 'pending') {
        await db.update(orders)
          .set({
            status: 'cancelled',
            paymentId: String(paymentId),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      }
    }
  }
}
