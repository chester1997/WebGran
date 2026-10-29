import { MercadoPagoProvider } from './providers/mercado-pago';
import { syncPayProvider, SyncPayProvider } from './providers/syncpay';
import { pushinPayProvider, PushinPayProvider } from './providers/pushinpay';
import { CreateCheckoutParams, CheckoutResponse } from './types';

export class PaymentService {
  private mercadoPagoProvider: MercadoPagoProvider;
  private syncPayProvider: SyncPayProvider;
  private pushinPayProvider: PushinPayProvider;

  constructor() {
    this.mercadoPagoProvider = new MercadoPagoProvider();
    this.syncPayProvider = syncPayProvider;
    this.pushinPayProvider = pushinPayProvider;
  }

  async getSellerConnection(sellerId: string) {
    return this.mercadoPagoProvider.getSellerConnection(sellerId);
  }

  async getOAuthConnectUrl(sellerId: string, redirectUri: string, storeId?: string): Promise<string> {
    return this.mercadoPagoProvider.connectSeller(sellerId, redirectUri, storeId);
  }

  async handleOAuthCallback(code: string, redirectUri: string, state?: string) {
    return this.mercadoPagoProvider.handleOAuthCallback(code, redirectUri, state);
  }

  async disconnectSeller(sellerId: string): Promise<void> {
    return this.mercadoPagoProvider.disconnectSeller(sellerId);
  }

  async testMercadoPagoConnection(sellerId: string) {
    return this.mercadoPagoProvider.testConnection(sellerId);
  }

  async createCheckoutPreference(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    return this.mercadoPagoProvider.createCheckout(params);
  }

  async createPixPayment(params: import('./types').CreatePaymentParams) {
    return this.mercadoPagoProvider.createPixPayment(params);
  }

  async createSyncPayPix(params: import('./types').CreatePaymentParams) {
    return this.syncPayProvider.createPixPayment(params);
  }

  async testSyncPayConnection(clientId: string, clientSecret: string) {
    return this.syncPayProvider.testConnection(clientId, clientSecret);
  }

  async createPushinPayPix(params: import('./types').CreatePaymentParams) {
    return this.pushinPayProvider.createPixPayment(params);
  }

  async testPushinPayConnection(token: string) {
    return this.pushinPayProvider.testConnection(token);
  }

  async handleWebhook(provider: string, payload: any, options?: any): Promise<any> {
    if (provider === 'mercado_pago' || provider === 'mercadopago') {
      await this.mercadoPagoProvider.handleWebhook(payload);
    } else if (provider === 'syncpay') {
      return await this.syncPayProvider.handleWebhook(options?.connectionId, options?.rawBody, options?.headers);
    } else if (provider === 'pushinpay') {
      return await this.pushinPayProvider.handleWebhook(options?.connectionId, options?.rawBody, options?.headers);
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}

export const paymentService = new PaymentService();

