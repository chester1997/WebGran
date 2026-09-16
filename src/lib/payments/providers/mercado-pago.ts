import { 
  MarketplacePaymentProvider, 
  CreateCheckoutParams, 
  CheckoutResponse, 
  CreatePaymentParams, 
  PaymentResponse 
} from '../types';

export class MercadoPagoProvider implements MarketplacePaymentProvider {
  async connectSeller(sellerId: string, redirectUrl: string): Promise<string> {
    // Generate OAuth URL for MP
    const appId = process.env.MP_APP_ID;
    return `https://auth.mercadopago.com/authorization?client_id=${appId}&response_type=code&platform_id=mp&redirect_uri=${redirectUrl}`;
  }

  async disconnectSeller(sellerId: string): Promise<void> {
    // Revoke tokens in DB and MP
  }

  async getSellerConnection(sellerId: string): Promise<any> {
    // Query seller_payment_connections
    return null;
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
    // Call MP Preferences API with marketplace fee
    return { id: 'mock_pref_id', url: 'https://mp.com/mock-checkout' };
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    return { id: 'mock_payment_id', status: 'approved', amount: params.amount };
  }

  calculatePlatformFee(amount: number): number {
    // Default 10% platform fee
    return amount * 0.10;
  }

  async getPayment(paymentId: string): Promise<PaymentResponse> {
    return { id: paymentId, status: 'approved', amount: 0 };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<void> {
    // Call MP Refund API
  }

  async handleWebhook(payload: any): Promise<void> {
    // Parse topic, id, signature
    // Update order status in WebGran
  }
}
