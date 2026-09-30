import { MercadoPagoProvider } from './providers/mercado-pago';
import { pushinPayProvider, PushinPayProvider } from './providers/pushinpay';
import { CreateCheckoutParams, CheckoutResponse } from './types';

export class PaymentService {
  private mercadoPagoProvider: MercadoPagoProvider;
  private pushinPayProvider: PushinPayProvider;

  constructor() {
    this.mercadoPagoProvider = new MercadoPagoProvider();
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

  async createCheckoutPreference(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    return this.mercadoPagoProvider.createCheckout(params);
  }

  async createPixPayment(params: import('./types').CreatePaymentParams) {
    return this.mercadoPagoProvider.createPixPayment(params);
  }

  async createPushinPayPix(params: import('./types').CreatePaymentParams) {
    return this.pushinPayProvider.createPixPayment(params);
  }

  async testPushinPayConnection(token: string) {
    return this.pushinPayProvider.testConnection(token);
  }

  async handleWebhook(provider: string, payload: any): Promise<any> {
    if (provider === 'mercado_pago' || provider === 'mercadopago') {
      await this.mercadoPagoProvider.handleWebhook(payload);
    } else if (provider === 'pushinpay') {
      return await this.pushinPayProvider.handleWebhook(payload);
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}

export const paymentService = new PaymentService();
