export interface MarketplacePaymentProvider {
  connectSeller(sellerId: string, redirectUrl: string): Promise<string>; // Returns auth URL
  disconnectSeller(sellerId: string): Promise<void>;
  getSellerConnection(sellerId: string): Promise<any>;
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse>;
  createPayment(params: CreatePaymentParams): Promise<PaymentResponse>;
  createPixPayment?(params: CreatePaymentParams): Promise<PixPaymentResponse>;
  calculatePlatformFee(amount: number): number;
  getPayment(paymentId: string): Promise<PaymentResponse>;
  refundPayment(paymentId: string, amount?: number): Promise<void>;
  handleWebhook(payload: any): Promise<void>;
}

export interface PlatformBillingProvider {
  createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse>;
  getInvoice(invoiceId: string): Promise<InvoiceResponse>;
  cancelInvoice(invoiceId: string): Promise<void>;
  handleWebhook(payload: any): Promise<void>;
  getSubscriptionStatus(subscriptionId: string): Promise<string>;
}

export interface CreateCheckoutParams {
  sellerId: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unitPrice: number;
  }>;
  customer: {
    email?: string;
    name?: string;
  };
  successUrl: string;
  failureUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResponse {
  id: string;
  url: string;
}

export interface CreatePaymentParams {
  sellerId: string;
  amount: number;
  paymentMethod?: string;
  description?: string;
  orderId: string;
  token?: string;
  customer?: {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface PixPaymentResponse {
  paymentId: string;
  status: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: Date;
}

export interface PaymentResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | string;
  amount: number;
}

export interface CreateInvoiceParams {
  sellerId: string;
  subscriptionId: string;
  amount: number;
  dueDate: Date;
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  documentType?: 'CPF' | 'CNPJ';
}

export interface InvoiceResponse {
  id: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  qrCode?: string;
  qrCodeText?: string;
  url?: string;
}
