import { MercadoPagoProvider } from './providers/mercado-pago';
import { CreateCheckoutParams, CheckoutResponse } from './types';

export class PaymentService {
  private mercadoPagoProvider: MercadoPagoProvider;

  constructor() {
    this.mercadoPagoProvider = new MercadoPagoProvider();
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

  async handleWebhook(provider: string, payload: any): Promise<void> {
    if (provider === 'mercado_pago' || provider === 'mercadopago') {
      await this.mercadoPagoProvider.handleWebhook(payload);
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
}

export const paymentService = new PaymentService();
