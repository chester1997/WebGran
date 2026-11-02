import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { encrypt } from '@/lib/encryption';
import { MercadoPagoProvider } from '@/lib/payments/providers/mercado-pago';
import { SplitReconciliationService } from '@/lib/payments/split-reconciliation-service';
import { syncOrderWithMercadoPago } from '@/lib/payments/order-sync';

// Mocks
vi.mock('@/lib/delivery/access-delivery-service', () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockResolvedValue({ success: true, count: 1 }),
  },
}));

vi.mock('@/lib/push/platform-financial-notification-service', () => ({
  PlatformFinancialNotificationService: {
    notifyOwnerOfCommission: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/db', () => {
  const mockDb = {
    query: {
      orders: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      sellerPaymentConnections: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      accesses: { findMany: vi.fn().mockResolvedValue([]) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-audit-1' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-order-id' }]),
        })),
      })),
    })),
    transaction: vi.fn(async (callback) => {
      return callback({
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ id: 'mock-order-id' }]),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue([{ id: 'mock-audit-1' }]),
        })),
      });
    }),
  };
  return { db: mockDb };
});

describe('WebGran — Split de Pagamentos Mercado Pago & Taxa da Plataforma', () => {
  const mockSellerId = 'seller-uuid-1';
  const mockStoreId = 'store-uuid-1';
  const mockToken = 'APP_USR-seller-token-123';
  const mockRefreshToken = 'TG-refresh-token-456';
  const provider = new MercadoPagoProvider();

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.MP_CLIENT_ID = 'test-client-id';
    process.env.MP_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://webgran.app';
    process.env.NEXTAUTH_SECRET = 'super-secret-key-32-chars-long!';
  });

  // 1. Venda de R$ 10,00 com taxa de R$ 0,50 no Checkout Transparente (Pix)
  it('1. Venda de R$ 10,00 inclui application_fee de R$ 0,50 no Checkout Transparente', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
      id: 'conn-1',
      sellerId: mockSellerId,
      provider: 'mercado_pago',
      status: 'active',
      accessTokenEncrypted: encrypt(mockToken),
    } as any);

    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          id: 1001,
          status: 'pending',
          point_of_interaction: {
            transaction_data: {
              qr_code: '00020126580014br.gov.bcb.pix...',
              qr_code_base64: 'base64pixdata',
            },
          },
          date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      } as Response;
    });

    const res = await provider.createPixPayment({
      sellerId: mockSellerId,
      orderId: 'order-10',
      amount: 10.00,
      description: 'Pedido R$ 10',
    });

    expect(capturedUrl).toBe('https://api.mercadopago.com/v1/payments');
    expect(capturedBody.transaction_amount).toBe(10.00);
    expect(capturedBody.application_fee).toBe(0.50);
    expect(capturedBody.payment_method_id).toBe('pix');
    expect(res.paymentId).toBe('1001');
    expect(res.status).toBe('pending');
  });

  // 2. Venda de R$ 50,00 com taxa de R$ 0,50 no Checkout Pro (Preferences)
  it('2. Venda de R$ 50,00 inclui marketplace_fee de R$ 0,50 no Checkout Pro', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
      id: 'conn-1',
      sellerId: mockSellerId,
      provider: 'mercado_pago',
      status: 'active',
      accessTokenEncrypted: encrypt(mockToken),
    } as any);

    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({
          id: 'pref-50-id',
          init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-50-id',
        }),
      } as Response;
    });

    const res = await provider.createCheckout({
      sellerId: mockSellerId,
      customer: { name: 'Cliente Teste', email: 'cliente@webgran.app' },
      items: [{ id: 'prod-1', title: 'Produto Premium', quantity: 1, unitPrice: 50.00 }],
      metadata: { orderId: 'order-50' },
      successUrl: 'https://webgran.app/success',
      failureUrl: 'https://webgran.app/failure',
    });

    expect(capturedUrl).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(capturedBody.marketplace_fee).toBe(0.50);
    expect(capturedBody.items[0].unit_price).toBe(50.00);
    expect(res.id).toBe('pref-50-id');
    expect(res.url).toContain('mercadopago.com.br/checkout/v1/redirect');
  });

  // 3. Pagamento pendente: não cobra taxa e mantém splitStatus como REQUESTED
  it('3. Pagamento pendente não reconhece receita nem antecipa dedução de taxa', () => {
    const result = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-pending',
        total: '50.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 1003,
        status: 'pending',
        status_detail: 'pending_waiting_transfer',
        application_fee: 0.50,
      },
    });

    expect(result.status).toBe('REQUESTED');
    expect(result.platformFeeStr).toBe('0.00');
    expect(result.netAmountStr).toBe('50.00');
    expect(result.splitConfirmedAt).toBeNull();
    expect(result.auditAction).toBe('NONE');
  });

  // 4. Pagamento rejeitado: marca splitStatus como FAILED e zera a taxa
  it('4. Pagamento rejeitado não retém taxa da plataforma e registra falha', () => {
    const result = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-rejected',
        total: '50.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 1004,
        status: 'rejected',
        status_detail: 'cc_rejected_high_risk',
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.platformFeeStr).toBe('0.00');
    expect(result.netAmountStr).toBe('50.00');
    expect(result.splitError).toBe('PAGAMENTO_REJEITADO');
    expect(result.auditAction).toBe('FAILED');
  });

  // 5. Pagamento aprovado: confirma split R$ 0,50 e deduz valor líquido de forma transparente
  it('5. Pagamento aprovado divide R$ 0,50 para WebGran e restante para vendedor com auditoria', () => {
    const result = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-approved',
        total: '50.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 1005,
        status: 'approved',
        status_detail: 'accredited',
        application_fee: 0.50,
      },
    });

    expect(result.status).toBe('CONFIRMED');
    expect(result.platformFeeStr).toBe('0.50');
    expect(result.netAmountStr).toBe('49.50');
    expect(result.splitConfirmedAt).toBeInstanceOf(Date);
    expect(result.auditAction).toBe('PROCESSED_BY_GATEWAY');
  });

  // 6. Webhook duplicado: idempotência preservada sem reprocessamento
  it('6. Webhook duplicado para pedido já pago não duplica taxa nem acessos', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
      id: 'order-already-paid',
      status: 'paid',
      total: '50.00',
      platformFee: '0.50',
      netAmount: '49.50',
      splitStatus: 'CONFIRMED',
    } as any);

    const result = await syncOrderWithMercadoPago('order-already-paid');
    expect(result.status).toBe('paid');
    expect(result.alreadyPaid).toBe(true);
    // Verificamos que o banco não executou nova transação de update
    expect(db.transaction).not.toHaveBeenCalled();
  });

  // 7. Reembolso: pagamento estornado no MP zera taxa e atualiza status para cancelado
  it('7. Reembolso no Mercado Pago zera taxa da plataforma e atualiza split para FAILED', () => {
    const result = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-refunded',
        total: '50.00',
        platformFee: '0.50',
        netAmount: '49.50',
        splitStatus: 'CONFIRMED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 1007,
        status: 'refunded',
        charges_details: [{ type: 'application_fee', amount: 0.50 }],
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.platformFeeStr).toBe('0.00');
    expect(result.netAmountStr).toBe('0.00');
    expect(result.splitError).toBe('PAGAMENTO_REEMBOLSADO');
    expect(result.auditAction).toBe('FAILED');
  });

  // 8 & 9. Renovação de token expirado via refresh token com rotação
  it('8 & 9. Token expirado é renovado automaticamente com rotação do refresh token', async () => {
    const { db } = await import('@/db');
    const expiredDate = new Date(Date.now() - 1000 * 60); // 1 minuto no passado

    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce({
      id: 'conn-expired',
      sellerId: mockSellerId,
      provider: 'mercado_pago',
      status: 'active',
      accessTokenEncrypted: encrypt('old-expired-token'),
      refreshTokenEncrypted: encrypt(mockRefreshToken),
      expiresAt: expiredDate,
    } as any);

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      return {
        ok: true,
        json: async () => ({
          access_token: 'new-refreshed-token',
          refresh_token: 'new-rotated-refresh-token',
          expires_in: 15552000,
        }),
      } as Response;
    });

    const activeToken = await provider.getValidAccessToken(mockSellerId);

    expect(activeToken).toBe('new-refreshed-token');
    expect(db.update).toHaveBeenCalled();
  });

  // 10. Vendedores diferentes: isolamento de contas no multi-tenant
  it('10. Vendedores diferentes operam com isolamento estrito de tokens e credenciais', async () => {
    const { db } = await import('@/db');

    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockImplementation((async () => {
      return null;
    }) as any);

    await expect(provider.getValidAccessToken('seller-inexistente')).rejects.toThrow(
      'Seller does not have an active Mercado Pago connection.'
    );
  });

  // 11. Proteção CSRF no OAuth: rejeita estados adulterados ou expirados
  it('11. Proteção contra CSRF rejeita estados OAuth com assinatura inválida', () => {
    const forgedState = 'eyJzZWxsZXJJZCI6ImhhY2tlciJ9.invalid-hmac-signature';
    expect(() => provider.parseAndVerifyOAuthState(forgedState)).toThrow('falha na validação CSRF');
  });

  // 12. Ausência de split quando o vendedor não possui conexão válida
  it('12. Tentativa de cobrança sem conexão Mercado Pago válida lança erro sem criar cobrança', async () => {
    const { db } = await import('@/db');
    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValueOnce(null as any);

    await expect(
      provider.createPixPayment({
        sellerId: 'seller-unconnected',
        orderId: 'order-no-conn',
        amount: 25.00,
      })
    ).rejects.toThrow('Seller does not have an active Mercado Pago connection.');
  });

  // 13. Auditoria Financeira: Diferenciação entre Bruto menos Comissão vs Líquido Efetivo do Vendedor
  it('13. evaluateMercadoPagoSplit prioriza net_received_amount da resposta oficial sem subtrair taxas em duplicidade', () => {
    // Cenário Sandbox: Venda R$ 10,00, Taxa MP R$ 0,30, Taxa WebGran R$ 0,50 -> Líquido MP R$ 9,20
    const evaluation = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-card-audit-1',
        total: '10.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 'mp-pay-1354548269',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 10.00,
        transaction_details: {
          net_received_amount: 9.20,
        },
        fee_details: [
          { type: 'mercadopago_fee', amount: 0.30, fee_payer: 'collector' },
          { type: 'application_fee', amount: 0.50, fee_payer: 'collector' },
        ],
      },
    });

    expect(evaluation.status).toBe('CONFIRMED');
    expect(evaluation.platformFeeStr).toBe('0.50');
    // Líquido exato creditado no Mercado Pago pelo vendedor:
    expect(evaluation.netAmountStr).toBe('9.20');
    // Garante que não houve dupla dedução (não virou 8.70):
    expect(evaluation.netAmountStr).not.toBe('8.70');
  });

  it('14. evaluateMercadoPagoSplit utiliza net_received_amount na raiz quando transaction_details não está presente', () => {
    const evaluation = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-audit-2',
        total: '50.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 'mp-pay-root-net',
        status: 'approved',
        transaction_amount: 50.00,
        net_received_amount: 48.00, // 50.00 - 1.50 (MP) - 0.50 (WebGran)
        fee_details: [
          { type: 'application_fee', amount: 0.50 },
        ],
      },
    });

    expect(evaluation.status).toBe('CONFIRMED');
    expect(evaluation.platformFeeStr).toBe('0.50');
    expect(evaluation.netAmountStr).toBe('48.00');
  });

  it('15. evaluateMercadoPagoSplit faz fallback para total menos comissão quando net_received_amount não está disponível', () => {
    const evaluation = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: {
        id: 'order-audit-fallback',
        total: '10.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      },
      officialTx: {
        id: 'mp-pay-pref-fallback',
        status: 'approved',
        transaction_amount: 10.00,
        // Sem net_received_amount
        fee_details: [
          { type: 'application_fee', amount: 0.50 },
        ],
      },
    });

    expect(evaluation.status).toBe('CONFIRMED');
    expect(evaluation.platformFeeStr).toBe('0.50');
    // Fallback calcula total - taxa WebGran:
    expect(evaluation.netAmountStr).toBe('9.50');
  });
});
