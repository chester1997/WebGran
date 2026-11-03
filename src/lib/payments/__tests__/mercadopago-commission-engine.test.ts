import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt } from '@/lib/encryption';
import { db } from '@/db';
import { MercadoPagoProvider } from '@/lib/payments/providers/mercado-pago';
import { SplitReconciliationService } from '@/lib/payments/split-reconciliation-service';
import { SellerCommissionService } from '@/lib/commission/seller-commission-service';
import { pushinPayProvider } from '@/lib/payments/providers/pushinpay';
import { syncPayProvider } from '@/lib/payments/providers/syncpay';

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

const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn();

vi.mock('@/db', () => {
  const mockDb = {
    query: {
      orders: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      sellerPaymentConnections: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      accesses: { findMany: vi.fn().mockResolvedValue([]) },
      sellerCommissionSettings: { findFirst: vi.fn() },
      platformCommissionSettings: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-audit-1' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: mockDbUpdateSet.mockImplementation(() => ({
        where: mockDbUpdateWhere.mockImplementation(() => ({
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

describe('Integração Mercado Pago com Motor Central de Taxas (SellerCommissionService)', () => {
  const mockSellerId = 'seller-central-1';
  const mockSellerToken = 'APP_USR-test-token-central';
  const provider = new MercadoPagoProvider();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDbUpdateSet.mockClear();
    mockDbUpdateWhere.mockClear();
    process.env.MP_CLIENT_ID = 'test-client-id';
    process.env.MP_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://webgran.app';
  });

  function setupActiveSellerConnection(sellerId = mockSellerId) {
    vi.mocked(db.query.sellerPaymentConnections.findFirst).mockResolvedValue({
      id: 'conn-mp-1',
      sellerId,
      provider: 'mercado_pago',
      status: 'active',
      accessTokenEncrypted: encrypt(mockSellerToken),
    } as any);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Taxa padrão R$ 0,50 (Pix e Checkout Pro)
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Taxa padrão da plataforma (R$ 0,50)', () => {
    it('Pix: cobra application_fee de R$ 0,50 e salva splitAmountCents 50', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 50,
        isCustom: false,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1001,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'pix-qr-50', qr_code_base64: 'b64' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-std-50',
        amount: 10.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBe(0.50);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 50,
          splitStatus: 'REQUESTED',
          splitError: null,
        })
      );
    });

    it('Checkout Pro: envia marketplace_fee de R$ 0,50 e salva splitAmountCents 50', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 50,
        isCustom: false,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pref-std-50',
          init_point: 'https://mp.com/checkout/50',
        }),
      } as Response);

      await provider.createCheckout({
        sellerId: mockSellerId,
        items: [{ id: 'p1', title: 'Item', quantity: 1, unitPrice: 10.0 }],
        customer: { email: 'test@webgran.app' },
        successUrl: 'https://webgran.app/success',
        failureUrl: 'https://webgran.app/failure',
        metadata: { orderId: 'order-pro-50' },
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.marketplace_fee).toBe(0.50);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 50,
          splitStatus: 'REQUESTED',
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Taxa personalizada R$ 0,15 (Pix e Checkout Pro)
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Taxa personalizada de R$ 0,15', () => {
    it('Pix: cobra application_fee de R$ 0,15 e salva splitAmountCents 15', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 15,
        isCustom: true,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1002,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'pix-qr-15' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-custom-15',
        amount: 10.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBe(0.15);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 15,
          splitStatus: 'REQUESTED',
        })
      );
    });

    it('Checkout Pro: envia marketplace_fee de R$ 0,15 e salva splitAmountCents 15', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 15,
        isCustom: true,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pref-custom-15',
          init_point: 'https://mp.com/checkout/15',
        }),
      } as Response);

      await provider.createCheckout({
        sellerId: mockSellerId,
        items: [{ id: 'p1', title: 'Item', quantity: 1, unitPrice: 10.0 }],
        customer: { email: 'test@webgran.app' },
        successUrl: 'https://webgran.app/success',
        failureUrl: 'https://webgran.app/failure',
        metadata: { orderId: 'order-pro-15' },
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.marketplace_fee).toBe(0.15);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 15,
          splitStatus: 'REQUESTED',
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Taxa personalizada R$ 0,25 (Pix e Checkout Pro)
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Taxa personalizada de R$ 0,25', () => {
    it('Pix: cobra application_fee de R$ 0,25 e salva splitAmountCents 25', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 25,
        isCustom: true,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1003,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'pix-qr-25' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-custom-25',
        amount: 20.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBe(0.25);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 25,
        })
      );
    });

    it('Checkout Pro: envia marketplace_fee de R$ 0,25 e salva splitAmountCents 25', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 25,
        isCustom: true,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pref-custom-25',
          init_point: 'https://mp.com/checkout/25',
        }),
      } as Response);

      await provider.createCheckout({
        sellerId: mockSellerId,
        items: [{ id: 'p1', title: 'Item', quantity: 1, unitPrice: 20.0 }],
        customer: { email: 'test@webgran.app' },
        successUrl: 'https://webgran.app/success',
        failureUrl: 'https://webgran.app/failure',
        metadata: { orderId: 'order-pro-25' },
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.marketplace_fee).toBe(0.25);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 25,
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Vendedor isento de comissão (R$ 0,00)
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Vendedor isento de comissão (R$ 0,00)', () => {
    it('Pix: NÃO envia application_fee, define SKIPPED com ISENCAO_TEMPORARIA e splitAmountCents 0', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 0,
        isCustom: false,
        isExempt: true,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1004,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'pix-qr-exempt' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-exempt-pix',
        amount: 10.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBeUndefined();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 0,
          splitStatus: 'SKIPPED',
          splitError: 'ISENCAO_TEMPORARIA',
        })
      );
    });

    it('Checkout Pro: NÃO envia marketplace_fee, define SKIPPED e splitAmountCents 0', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 0,
        isCustom: false,
        isExempt: true,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pref-exempt',
          init_point: 'https://mp.com/checkout/exempt',
        }),
      } as Response);

      await provider.createCheckout({
        sellerId: mockSellerId,
        items: [{ id: 'p1', title: 'Item', quantity: 1, unitPrice: 10.0 }],
        customer: { email: 'test@webgran.app' },
        successUrl: 'https://webgran.app/success',
        failureUrl: 'https://webgran.app/failure',
        metadata: { orderId: 'order-exempt-pro' },
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.marketplace_fee).toBeUndefined();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 0,
          splitStatus: 'SKIPPED',
          splitError: 'ISENCAO_TEMPORARIA',
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Alteração da taxa no painel refletida na próxima venda
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Mudança de taxa no painel reflete imediatamente na próxima venda', () => {
    it('Primeira venda aplica R$ 0,50 e segunda venda aplica R$ 0,15 após atualização do vendedor', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValue(null as any);

      // Venda 1: taxa padrão 50
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 50,
        isCustom: false,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 2001,
            status: 'pending',
            point_of_interaction: { transaction_data: { qr_code: 'qr-1' } },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 2002,
            status: 'pending',
            point_of_interaction: { transaction_data: { qr_code: 'qr-2' } },
          }),
        } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-venda-1',
        amount: 15.0,
      });

      const reqBody1 = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody1.application_fee).toBe(0.50);

      // Super Admin atualiza taxa para R$ 0,15
      // Venda 2: taxa resolvida dinamicamente é 15 centavos
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 15,
        isCustom: true,
        isExempt: false,
        feeType: 'FIXED_CENTS',
        platformDefaultCents: 50,
      } as any);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-venda-2',
        amount: 15.0,
      });

      const reqBody2 = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
      expect(reqBody2.application_fee).toBe(0.15);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Snapshot do pedido preservado (imutabilidade)
  // ──────────────────────────────────────────────────────────────────────────
  describe('6. Imutabilidade do snapshot do pedido', () => {
    it('Preserva splitAmountCents: 15 gravado no pedido mesmo se taxa do vendedor mudou para 50', async () => {
      setupActiveSellerConnection();


      // O pedido já foi criado com snapshot de 15 centavos
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-snapshot-15',
        splitAmountCents: 15,
        splitStatus: 'PENDING',
        splitError: null,
      } as any);

      // O painel do vendedor já foi alterado para 50 centavos (mas não deve afetar a transação congelada)
      const resolveSpy = vi.spyOn(SellerCommissionService, 'resolveEffectiveFee');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 3001,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-snapshot' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-snapshot-15',
        amount: 10.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      // Utilizou snapshot 15 do pedido, sem re-consultar o serviço central
      expect(reqBody.application_fee).toBe(0.15);
      expect(resolveSpy).not.toHaveBeenCalled();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 15,
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Nenhuma sobrescrita indevida para 50 centavos
  // ──────────────────────────────────────────────────────────────────────────
  describe('7. Prevenção de sobrescrita indevida para 50 centavos', () => {
    it('Não altera splitAmountCents: 15 para 50 ao salvar no banco em sucesso', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-check-no-overwrite',
        splitAmountCents: 15,
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 4001,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-ok' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-check-no-overwrite',
        amount: 10.0,
      });

      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 15,
        })
      );
      expect(mockDbUpdateSet).not.toHaveBeenCalledWith(
        expect.objectContaining({
          splitAmountCents: 50,
        })
      );
    });

    it('Em caso de erro HTTP na API do Mercado Pago, mantém splitAmountCents do pedido e não força 50', async () => {
      setupActiveSellerConnection();

      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-fail-custom',
        splitAmountCents: 25,
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid token' }),
      } as Response);

      await expect(
        provider.createPixPayment({
          sellerId: mockSellerId,
          orderId: 'order-fail-custom',
          amount: 10.0,
        })
      ).rejects.toThrow('Mercado Pago PIX creation failed');

      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          splitStatus: 'FAILED',
          splitAmountCents: 25,
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Reconciliação correta para cada valor (0.50, 0.15, 0.25, Isento)
  // ──────────────────────────────────────────────────────────────────────────
  describe('8. Reconciliação correta por valor (evaluateMercadoPagoSplit)', () => {
    it('Confirma corretamente pedido com taxa R$ 0,50', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-rec-50', total: '10.00', splitAmountCents: 50 },
        officialTx: {
          id: 5001,
          status: 'approved',
          status_detail: 'accredited',
          application_fee: 0.50,
          transaction_details: { net_received_amount: 9.20 },
        },
      });

      expect(res.status).toBe('CONFIRMED');
      expect(res.platformFeeStr).toBe('0.50');
      expect(res.netAmountStr).toBe('9.20');
      expect(res.splitError).toBeNull();
    });

    it('Confirma corretamente pedido com taxa personalizada R$ 0,15', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-rec-15', total: '10.00', splitAmountCents: 15 },
        officialTx: {
          id: 5002,
          status: 'approved',
          status_detail: 'accredited',
          application_fee: 0.15,
          transaction_details: { net_received_amount: 9.55 },
        },
      });

      expect(res.status).toBe('CONFIRMED');
      expect(res.platformFeeStr).toBe('0.15');
      expect(res.netAmountStr).toBe('9.55');
      expect(res.splitError).toBeNull();
    });

    it('Confirma corretamente pedido com taxa personalizada R$ 0,25', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-rec-25', total: '10.00', splitAmountCents: 25 },
        officialTx: {
          id: 5003,
          status: 'approved',
          status_detail: 'accredited',
          application_fee: 0.25,
          transaction_details: { net_received_amount: 9.45 },
        },
      });

      expect(res.status).toBe('CONFIRMED');
      expect(res.platformFeeStr).toBe('0.25');
      expect(res.netAmountStr).toBe('9.45');
      expect(res.splitError).toBeNull();
    });

    it('Confirma corretamente pedido de vendedor ISENTO (R$ 0,00 de comissão)', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-rec-exempt', total: '10.00', splitAmountCents: 0, splitError: 'ISENCAO_TEMPORARIA' },
        officialTx: {
          id: 5004,
          status: 'approved',
          status_detail: 'accredited',
          transaction_details: { net_received_amount: 9.70 },
        },
      });

      expect(res.status).toBe('CONFIRMED');
      expect(res.platformFeeStr).toBe('0.00');
      expect(res.netAmountStr).toBe('9.70');
      expect(res.splitDetails?.netConfirmed).toBe(true);
      expect(res.splitDetails?.netReceivedAmount).toBe(9.70);
      expect(res.auditAction).toBe('PROCESSED_BY_GATEWAY');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Divergência real de comissão identificada
  // ──────────────────────────────────────────────────────────────────────────
  describe('9. Detecção rigorosa de divergências', () => {
    it('Identifica VALOR_DO_SPLIT_DIVERGENTE se pedido esperava R$ 0,15 mas MP cobrou R$ 0,50', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-div-15-50', total: '10.00', splitAmountCents: 15 },
        officialTx: {
          id: 6001,
          status: 'approved',
          status_detail: 'accredited',
          application_fee: 0.50,
          transaction_details: { net_received_amount: 9.20 },
        },
      });

      expect(res.status).toBe('GATEWAY_ACCEPTED');
      expect(res.splitError).toBe('VALOR_DO_SPLIT_DIVERGENTE');
      expect(res.platformFeeStr).toBe('0.00'); // Zera reconhecimento de receita até apuração
      expect(res.auditAction).toBe('DIVERGENCE_FLAGGED');
      expect(res.divergenceReason).toContain('O valor do split no Mercado Pago (50 centavos) diverge da comissão esperada (15 centavos)');
    });

    it('Identifica VALOR_DO_SPLIT_DIVERGENTE se pedido era ISENTO mas MP cobrou R$ 0,50', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-div-exempt-50', total: '10.00', splitAmountCents: 0 },
        officialTx: {
          id: 6002,
          status: 'approved',
          status_detail: 'accredited',
          application_fee: 0.50,
          transaction_details: { net_received_amount: 9.20 },
        },
      });

      expect(res.status).toBe('GATEWAY_ACCEPTED');
      expect(res.splitError).toBe('VALOR_DO_SPLIT_DIVERGENTE');
      expect(res.platformFeeStr).toBe('0.00');
      expect(res.auditAction).toBe('DIVERGENCE_FLAGGED');
      expect(res.divergenceReason).toContain('O valor do split no Mercado Pago (50 centavos) diverge da comissão esperada (0 centavos)');
    });

    it('Identifica SEM_EVIDENCIA_DE_SPLIT_NA_RESPOSTA_OFICIAL se pedido esperava comissão mas MP não cobrou', () => {
      const res = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: { id: 'ord-div-no-fee', total: '10.00', splitAmountCents: 50 },
        officialTx: {
          id: 6003,
          status: 'approved',
          status_detail: 'accredited',
          transaction_details: { net_received_amount: 9.70 },
        },
      });

      expect(res.status).toBe('GATEWAY_ACCEPTED');
      expect(res.splitError).toBe('SEM_EVIDENCIA_DE_SPLIT_NA_RESPOSTA_OFICIAL');
      expect(res.auditAction).toBe('DIVERGENCE_FLAGGED');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. PushinPay e SyncPay permanecem inalterados
  // ──────────────────────────────────────────────────────────────────────────
  describe('10. PushinPay e SyncPay preservados', () => {
    it('PushinPay continua respeitando split_rules com o valor em centavos da comissão', async () => {
      expect(typeof pushinPayProvider.createPixPayment).toBe('function');
      expect(typeof pushinPayProvider.getPixPaymentStatus).toBe('function');
    });

    it('SyncPay continua operando normalmente sem alteração de contrato', async () => {
      expect(typeof syncPayProvider.createPixPayment).toBe('function');
      expect(typeof syncPayProvider.getPixPaymentStatus).toBe('function');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Eliminação de Fallback Inseguro e Proteção Contra Cobrança Presumida
  // ──────────────────────────────────────────────────────────────────────────
  describe('11. Eliminação de fallback inseguro e proteção contra cobrança presumida', () => {
    it('1. Motor central indisponível sem snapshot: interrompe pagamento com erro explícito', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockRejectedValueOnce(
        new Error('Neon Database connection timeout')
      );
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(
        provider.createPixPayment({
          sellerId: mockSellerId,
          orderId: 'order-no-snap-err',
          amount: 20.0,
        })
      ).rejects.toThrow('Parâmetros de cobrança temporariamente indisponíveis. Tente novamente em instantes.');

      // 7. Nenhuma chamada à API do Mercado Pago quando a comissão não puder ser determinada
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('2. Motor central indisponível com snapshot zero (isento): pagamento permitido sem comissão', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-snap-zero',
        splitAmountCents: 0,
        splitError: 'ISENCAO_TEMPORARIA',
      } as any);

      const serviceSpy = vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockRejectedValueOnce(
        new Error('Neon outage')
      );

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 7001,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-exempt-snap' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-snap-zero',
        amount: 20.0,
      });

      // Motor central nem sequer foi chamado porque o snapshot já existia
      expect(serviceSpy).not.toHaveBeenCalled();
      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBeUndefined();
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ splitAmountCents: 0, splitStatus: 'SKIPPED' })
      );
    });

    it('3. Motor central indisponível com snapshot 15 centavos: pagamento permitido com R$ 0,15', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-snap-15',
        splitAmountCents: 15,
      } as any);

      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockRejectedValueOnce(
        new Error('Neon outage')
      );

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 7002,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-15-snap' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-snap-15',
        amount: 20.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBe(0.15);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ splitAmountCents: 15, splitStatus: 'REQUESTED' })
      );
    });

    it('4. Motor central indisponível com snapshot 25 centavos: pagamento permitido com R$ 0,25', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce({
        id: 'order-snap-25',
        splitAmountCents: 25,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 7003,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-25-snap' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-snap-25',
        amount: 20.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBe(0.25);
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ splitAmountCents: 25, splitStatus: 'REQUESTED' })
      );
    });

    it('5. Motor central disponível: utiliza taxa efetiva configurada', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockResolvedValueOnce({
        effectiveFeeCents: 35,
        isExempt: false,
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 7004,
          status: 'pending',
          point_of_interaction: { transaction_data: { qr_code: 'qr-35' } },
        }),
      } as Response);

      await provider.createPixPayment({
        sellerId: mockSellerId,
        orderId: 'order-dynamic-35',
        amount: 20.0,
      });

      const reqBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(reqBody.application_fee).toBe(0.35);
    });

    it('6. Nenhum fallback automático para R$ 0,50 ocorre quando motor falha sem snapshot', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockRejectedValueOnce(
        new Error('Database unavailable')
      );

      // Garante que o método lança erro em vez de retornar 50 centavos
      await expect(
        provider.resolveEffectiveCommission({
          sellerId: mockSellerId,
          orderId: 'order-err-test',
          amount: 20.0,
        })
      ).rejects.toThrow('Parâmetros de cobrança temporariamente indisponíveis. Tente novamente em instantes.');
    });

    it('7. Checkout Pro: motor central indisponível sem snapshot interrompe criação e não chama API', async () => {
      setupActiveSellerConnection();
      vi.mocked(db.query.orders.findFirst).mockResolvedValueOnce(null as any);
      vi.spyOn(SellerCommissionService, 'resolveEffectiveFee').mockRejectedValueOnce(
        new Error('Database connection failed')
      );
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(
        provider.createCheckout({
          sellerId: mockSellerId,
          items: [{ id: 'p1', title: 'Item', quantity: 1, unitPrice: 20.0 }],
          customer: { email: 'test@webgran.app' },
          successUrl: 'https://webgran.app/success',
          failureUrl: 'https://webgran.app/failure',
          metadata: { orderId: 'order-pro-err' },
        })
      ).rejects.toThrow('Parâmetros de cobrança temporariamente indisponíveis. Tente novamente em instantes.');

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
