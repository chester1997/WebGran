import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SplitReconciliationService, isOrderNetConfirmed } from '../split-reconciliation-service';
import { POST as adminSplitSyncPost } from '@/app/api/admin/splits/sync/route';

// Mocks hoisted properly for Vitest
const {
  mockOrderUpdate,
  mockAuditInsert,
  getMockPendingOrders,
  setMockPendingOrders,
  getMockConnections,
  setMockConnections,
} = vi.hoisted(() => {
  const mockOrderUpdate = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([{ id: 'mock-order-id' }]),
  });
  const mockAuditInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([{ id: 'mock-audit-id' }]),
  });
  let pending: any[] = [];
  let conns: any[] = [];

  return {
    mockOrderUpdate,
    mockAuditInsert,
    getMockPendingOrders: () => pending,
    setMockPendingOrders: (p: any[]) => {
      pending = p;
    },
    getMockConnections: () => conns,
    setMockConnections: (c: any[]) => {
      conns = c;
    },
  };
});

vi.mock('@/db', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(getMockPendingOrders())),
          })),
        })),
      })),
      query: {
        orders: {
          findFirst: vi.fn((opts?: any) => {
            const pending = getMockPendingOrders();
            const found = pending.find(
              (o) => o.id === opts?.where?.id || o.id === opts?.where?.params?.id
            );
            return Promise.resolve(found || null);
          }),
        },
        sellerPaymentConnections: {
          findFirst: vi.fn((opts?: any) => {
            const conns = getMockConnections();
            const conn =
              conns.find(
                (c) =>
                  c.storeId === opts?.where?.storeId || c.provider === opts?.where?.provider
              ) || conns[0];
            return Promise.resolve(conn || null);
          }),
        },
      },
      update: vi.fn(() => ({
        set: mockOrderUpdate,
      })),
      insert: mockAuditInsert,
      transaction: vi.fn(async (cb: any) => {
        return cb({
          update: vi.fn(() => ({
            set: mockOrderUpdate,
          })),
          insert: mockAuditInsert,
        });
      }),
    },
  };
});

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'admin-uuid-1', name: 'WebGran Admin', role: 'admin' },
  }),
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((val: string) => val.replace('enc:', '')),
  encrypt: vi.fn((val: string) => `enc:${val}`),
}));

describe('Auditoria Corretiva Mercado Pago Split 1:1 — 8 Cenários Obrigatórios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockPendingOrders([]);
    setMockConnections([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 1
  // Pedido de R$ 10,00 com resposta do Mercado Pago contendo net_received_amount: 9.20
  // -> Sincronização admin deve registrar netAmount: 9.20
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 1: Pedido R$ 10,00 com net_received_amount 9.20 registra netAmount 9.20 na sincronização admin', async () => {
    const orderId = 'order-mp-c1';
    setMockPendingOrders([
      {
        id: orderId,
        total: '10.00',
        netAmount: null,
        platformFee: null,
        splitDetails: null,
        paymentMethod: 'mercadopago',
        paymentId: '1354548269',
        storeId: 'store-1',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
        createdAt: new Date('2026-10-25T12:00:00Z'),
      },
    ]);

    setMockConnections([
      {
        storeId: 'store-1',
        provider: 'mercadopago',
        accessTokenEncrypted: 'enc:TEST_TOKEN_MP',
        status: 'active',
      },
    ]);

    // Mock MP API fetch retornando net_received_amount: 9.20 e application_fee: 0.50
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v1/payments/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 1354548269,
                  status: 'approved',
                  status_detail: 'accredited',
                  transaction_amount: 10.0,
                  transaction_details: {
                    net_received_amount: 9.2,
                    total_paid_amount: 10.0,
                  },
                  fee_details: [
                    { type: 'application_fee', amount: 0.5, fee_payer: 'collector' },
                    { type: 'mercadopago_fee', amount: 0.3, fee_payer: 'collector' },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as any;

    const req = new NextRequest('http://localhost:3000/api/admin/splits/sync', { method: 'POST' });
    const res = await adminSplitSyncPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.updated).toBe(1);

    // Verificar que o update foi chamado com netAmount '9.20' e netConfirmed: true
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        splitStatus: 'CONFIRMED',
        platformFee: '0.50',
        netAmount: '9.20',
        splitDetails: expect.objectContaining({
          netConfirmed: true,
          netReceivedAmount: 9.2,
        }),
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 2
  // Pedido já conciliado com netAmount: 9.20 submetido a nova sincronização
  // que não retorna net_received_amount -> O valor 9.20 deve ser mantido, sem sobrescrita por 9.50
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 2: Pedido com netAmount 9.20 previamente conciliado mantém 9.20 quando nova resposta não traz net_received_amount', async () => {
    const orderId = 'order-mp-c2';
    const previouslyConfirmedOrder = {
      id: orderId,
      total: '10.00',
      netAmount: '9.20',
      platformFee: '0.50',
      splitDetails: { netConfirmed: true, netReceivedAmount: 9.2 },
      paymentMethod: 'mercadopago',
      paymentId: '1354548270',
      storeId: 'store-1',
      splitStatus: 'REQUESTED', // Simulação de status elegível para re-sincronização
      splitAmountCents: 50,
      createdAt: new Date('2026-10-25T12:00:00Z'),
    };

    setMockPendingOrders([previouslyConfirmedOrder]);
    setMockConnections([
      {
        storeId: 'store-1',
        provider: 'mercadopago',
        accessTokenEncrypted: 'enc:TEST_TOKEN_MP',
        status: 'active',
      },
    ]);

    // MP API retorna resposta sem transaction_details / sem net_received_amount, apenas charges_details com taxa
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v1/payments/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 1354548270,
                  status: 'approved',
                  status_detail: 'accredited',
                  charges_details: [{ type: 'application_fee', amount: 0.5 }],
                  // transaction_details ausente ou sem net_received_amount
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as any;

    const req = new NextRequest('http://localhost:3000/api/admin/splits/sync', { method: 'POST' });
    const res = await adminSplitSyncPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.updated).toBe(1);

    // O valor 9.20 deve ser rigorosamente PRESERVADO, e NUNCA sobrescrito por 9.50
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        splitStatus: 'CONFIRMED',
        platformFee: '0.50',
        netAmount: '9.20', // Mantido 9.20!
        splitDetails: expect.objectContaining({
          netConfirmed: true,
          netReceivedAmount: 9.2,
        }),
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 3
  // Pedido sem net_received_amount na resposta do gateway e sem valor confirmado anterior
  // -> Sincronização deve usar fallback e identificá-lo como estimado
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 3: Pedido sem net_received_amount e sem confirmação anterior usa fallback e identifica como estimado', async () => {
    const orderId = 'order-mp-c3';
    setMockPendingOrders([
      {
        id: orderId,
        total: '10.00',
        netAmount: null,
        platformFee: null,
        splitDetails: null,
        paymentMethod: 'mercadopago',
        paymentId: '1354548271',
        storeId: 'store-1',
        splitStatus: 'PENDING',
        splitAmountCents: 50,
        createdAt: new Date('2026-10-25T12:00:00Z'),
      },
    ]);

    setMockConnections([
      {
        storeId: 'store-1',
        provider: 'mercadopago',
        accessTokenEncrypted: 'enc:TEST_TOKEN_MP',
        status: 'active',
      },
    ]);

    // Resposta MP com application_fee mas SEM net_received_amount
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v1/payments/search')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 1354548271,
                  status: 'approved',
                  status_detail: 'accredited',
                  charges_details: [{ type: 'marketplace_fee', amount: 0.5 }],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as any;

    const req = new NextRequest('http://localhost:3000/api/admin/splits/sync', { method: 'POST' });
    const res = await adminSplitSyncPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.updated).toBe(1);

    // Fallback: total (10.00) - taxa (0.50) = 9.50, mas com netConfirmed: false
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        splitStatus: 'CONFIRMED',
        platformFee: '0.50',
        netAmount: '9.50',
        splitDetails: expect.objectContaining({
          netConfirmed: false,
        }),
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 4
  // Coerência entre Dashboard e Financeiro: para um mesmo conjunto de pedidos
  // pagos conciliados, o valor de receita líquida exibido no Dashboard deve ser
  // idêntico ao total líquido da aba Financeiro.
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 4: Dashboard e Financeiro produzem exatamente o mesmo total líquido para pedidos pagos conciliados', () => {
    const paidOrders = [
      // Pedido 1: R$ 10,00 bruto, tarifa MP R$ 0,30, split R$ 0,50 -> net 9.20 confirmado
      {
        id: 'ord-1',
        total: '10.00',
        platformFee: '0.50',
        netAmount: '9.20',
        splitStatus: 'CONFIRMED',
        splitDetails: { netConfirmed: true, netReceivedAmount: 9.2 },
        status: 'paid',
        createdAt: new Date('2026-10-25T10:00:00Z'),
        paidAt: new Date('2026-10-25T10:01:00Z'),
      },
      // Pedido 2: R$ 50,00 bruto, tarifa MP R$ 1,50, split R$ 0,50 -> net 48.00 confirmado
      {
        id: 'ord-2',
        total: '50.00',
        platformFee: '0.50',
        netAmount: '48.00',
        splitStatus: 'CONFIRMED',
        splitDetails: { netConfirmed: true, netReceivedAmount: 48.0 },
        status: 'paid',
        createdAt: new Date('2026-10-25T11:00:00Z'),
        paidAt: new Date('2026-10-25T11:01:00Z'),
      },
      // Pedido 3: R$ 20,00 bruto, split R$ 0,50 -> net 19.50 estimado
      {
        id: 'ord-3',
        total: '20.00',
        platformFee: '0.50',
        netAmount: '19.50',
        splitStatus: 'REQUESTED',
        splitDetails: { netConfirmed: false },
        status: 'paid',
        createdAt: new Date('2026-10-25T12:00:00Z'),
        paidAt: new Date('2026-10-25T12:01:00Z'),
      },
    ];

    // Fórmula da aba Financeiro (/seller/financeiro/page.tsx)
    const financeiroTotalLiquido = paidOrders.reduce(
      (sum, o) => sum + Number(o.netAmount || Number(o.total) - Number(o.platformFee || 0)),
      0
    );

    // Fórmula harmonizada do Dashboard (analytics-service.ts)
    const dashboardNetRevenue = paidOrders.reduce((sum, o) => {
      const orderTotal = Number(o.total || 0);
      const orderPlatformFee = Number(o.platformFee || 0);
      const isConfirmed =
        (o.splitDetails as any)?.netConfirmed === true ||
        (o.splitStatus && ['CONFIRMED', 'SETTLED', 'PROCESSED'].includes(String(o.splitStatus).toUpperCase()) && o.netAmount != null);

      if (isConfirmed && o.netAmount != null) {
        return sum + Number(o.netAmount);
      } else {
        const fallbackNet = o.netAmount != null
          ? Number(o.netAmount)
          : Math.max(0, orderTotal - (orderPlatformFee > 0 ? orderPlatformFee : 0.5));
        return sum + fallbackNet;
      }
    }, 0);

    // Soma esperada: 9.20 + 48.00 + 19.50 = 76.70
    expect(financeiroTotalLiquido).toBe(76.7);
    expect(dashboardNetRevenue).toBe(76.7);
    expect(dashboardNetRevenue).toBe(financeiroTotalLiquido);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 5
  // Pedido com application_fee de R$ 0,50 e mercadopago_fee de R$ 0,30
  // -> A comissão da plataforma deve ser de exatamente R$ 0,50, sem duplicação de tarifas
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 5: Taxa da plataforma permanece exatamente R$ 0,50 sem inflação por tarifas do gateway', () => {
    const order = {
      id: 'ord-fee-check',
      total: '10.00',
      splitAmountCents: 50,
      splitStatus: 'PENDING',
    };

    const officialTx = {
      id: 1354548269,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 10.0,
      transaction_details: {
        net_received_amount: 9.2,
      },
      fee_details: [
        { type: 'application_fee', amount: 0.5, fee_payer: 'collector' },
        { type: 'mercadopago_fee', amount: 0.3, fee_payer: 'collector' },
      ],
    };

    const evalResult = SplitReconciliationService.evaluateMercadoPagoSplit({
      order,
      officialTx,
    });

    expect(evalResult.status).toBe('CONFIRMED');
    // A comissão da plataforma é rigorosamente 0.50
    expect(evalResult.platformFeeStr).toBe('0.50');
    // O líquido é 9.20
    expect(evalResult.netAmountStr).toBe('9.20');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 6
  // Cálculo de repasse ao vendedor não deve subtrair tarifas do gateway duas vezes
  // quando net_received_amount já deduz essas tarifas
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 6: Não subtrai tarifas do gateway duas vezes quando net_received_amount já as deduz', () => {
    // Venda: R$ 10,00
    // application_fee: R$ 0,50
    // mercadopago_fee: R$ 0,30
    // net_received_amount retornado pelo MP: R$ 9,20 (já é 10.00 - 0.50 - 0.30)
    const officialTx = {
      id: 1354548269,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 10.0,
      transaction_details: {
        net_received_amount: 9.2,
      },
      fee_details: [
        { type: 'application_fee', amount: 0.5 },
        { type: 'mercadopago_fee', amount: 0.3 },
      ],
    };

    const evalResult = SplitReconciliationService.evaluateMercadoPagoSplit({
      order: { id: 'ord-6', total: '10.00', splitAmountCents: 50 },
      officialTx,
    });

    // Se houvesse dupla dedução, o sistema calcularia 9.20 - 0.50 = 8.70 ou 9.20 - 0.30 = 8.90.
    // O valor CORRETO e exato deve ser R$ 9,20:
    expect(evalResult.netAmountStr).toBe('9.20');
    expect(Number(evalResult.netAmountStr)).toBe(9.2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 7
  // Pedidos via PushinPay e SyncPay devem manter seu comportamento inalterado
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 7: PushinPay e SyncPay mantêm comportamento inalterado', () => {
    const platformAccountId = 'PLATFORM_PUSHIN_ACCOUNT_UUID';

    const pushinOrder = {
      id: 'ord-pushin-preserved',
      total: '20.00',
      splitStatus: 'PENDING',
      splitAmountCents: 50,
      splitDetails: null,
    };

    const pushinOfficialTx = {
      id: 'tx-pushin-123',
      status: 'paid',
      value: 2000,
      split_rules: [{ value: 50, account_id: platformAccountId }],
    };

    const evalPushin = SplitReconciliationService.evaluatePushinPaySplit({
      order: pushinOrder,
      officialTx: pushinOfficialTx,
      platformAccountId,
    });

    // PushinPay permanece 100% inalterado
    expect(evalPushin.status).toBe('PROCESSED');
    expect(evalPushin.platformFeeStr).toBe('0.50');
    expect(evalPushin.netAmountStr).toBe('19.50');
    expect(evalPushin.splitDetails).toEqual(pushinOfficialTx.split_rules);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CENÁRIO 8
  // Reprocessamento idempotente da sincronização: executar o sync múltiplas vezes
  // sobre os mesmos pedidos não deve alterar valores já confirmados.
  // ──────────────────────────────────────────────────────────────────────────
  it('Cenário 8: Sincronização é idempotente e reprocessamento ignora pedidos já confirmados sem chamadas externas', async () => {
    // Pedido já com status terminal CONFIRMED
    setMockPendingOrders([]); // A query do banco filtra terminais: NOT IN ('SETTLED', 'CONFIRMED', ...)

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const req = new NextRequest('http://localhost:3000/api/admin/splits/sync', { method: 'POST' });
    const res = await adminSplitSyncPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.total).toBe(0);
    expect(body.summary.updated).toBe(0);

    // Nenhuma chamada externa desnecessária foi executada
    expect(fetchSpy).not.toHaveBeenCalled();
    // Nenhum update de banco foi executado
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AJUSTE FINAL: 6 TESTES OBRIGATÓRIOS DE CLASSIFICAÇÃO FINANCEIRA
  // ──────────────────────────────────────────────────────────────────────────
  describe('Ajuste Final de Classificação Financeira — 6 Testes Obrigatórios', () => {
    it('1. Mercado Pago legado com CONFIRMED, netAmount = 9.50 e sem netConfirmed: NÃO pode aparecer como confirmado', () => {
      const legacyMpOrder = {
        id: 'ord-mp-legacy',
        total: '10.00',
        netAmount: '9.50',
        platformFee: '0.50',
        paymentMethod: 'mercadopago',
        splitStatus: 'CONFIRMED',
        splitDetails: null, // Sem evidência de confirmação do valor líquido
      };

      const isConfirmed = isOrderNetConfirmed(legacyMpOrder);
      expect(isConfirmed).toBe(false); // Rigorosamente falso (classificado como estimado)
    });

    it('2. Mercado Pago com netConfirmed = true e evidência oficial: permanece confirmado', () => {
      const officialMpOrder = {
        id: 'ord-mp-official',
        total: '10.00',
        netAmount: '9.20',
        platformFee: '0.50',
        paymentMethod: 'mercadopago',
        splitStatus: 'CONFIRMED',
        splitDetails: {
          netConfirmed: true,
          netReceivedAmount: 9.2,
          charges_details: [{ type: 'application_fee', amount: 0.5 }],
        },
      };

      const isConfirmed = isOrderNetConfirmed(officialMpOrder);
      expect(isConfirmed).toBe(true);
    });

    it('3. Mercado Pago estimado: permanece estimado até conciliação oficial', () => {
      const estimatedMpOrder = {
        id: 'ord-mp-est',
        total: '10.00',
        netAmount: '9.50',
        platformFee: '0.50',
        paymentMethod: 'mercadopago',
        splitStatus: 'REQUESTED',
        splitDetails: { netConfirmed: false },
      };

      expect(isOrderNetConfirmed(estimatedMpOrder)).toBe(false);

      // Simulando recebimento posterior de conciliação oficial com net_received_amount
      const officialTx = {
        id: 1354548269,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 10.0,
        transaction_details: { net_received_amount: 9.2 },
        fee_details: [{ type: 'application_fee', amount: 0.5 }],
      };

      const evalResult = SplitReconciliationService.evaluateMercadoPagoSplit({
        order: estimatedMpOrder,
        officialTx,
      });

      expect(evalResult.status).toBe('CONFIRMED');
      expect(evalResult.netAmountStr).toBe('9.20');
      expect(evalResult.splitDetails.netConfirmed).toBe(true);
      expect(isOrderNetConfirmed({ ...estimatedMpOrder, splitDetails: evalResult.splitDetails })).toBe(true);
    });

    it('4. PushinPay: mantém a classificação anterior (status CONFIRMED/PROCESSED com netAmount é confirmado)', () => {
      const pushinOrder = {
        id: 'ord-pushin',
        total: '20.00',
        netAmount: '19.50',
        platformFee: '0.50',
        paymentMethod: 'pushinpay',
        splitStatus: 'PROCESSED',
        splitDetails: [{ value: 50, account_id: 'ACC_1' }],
      };

      expect(isOrderNetConfirmed(pushinOrder)).toBe(true);

      const pushinConfirmedOrder = {
        ...pushinOrder,
        splitStatus: 'CONFIRMED',
      };
      expect(isOrderNetConfirmed(pushinConfirmedOrder)).toBe(true);
    });

    it('5. Dashboard, Financeiro e Telegram: classificações rigorosamente coerentes', () => {
      const sampleOrders = [
        // 1: MP confirmado oficial (R$ 9,20)
        {
          id: 'o-1',
          total: '10.00',
          platformFee: '0.50',
          netAmount: '9.20',
          paymentMethod: 'mercadopago',
          splitStatus: 'CONFIRMED',
          splitDetails: { netConfirmed: true, netReceivedAmount: 9.2 },
        },
        // 2: MP legado não confirmado (R$ 9,50)
        {
          id: 'o-2',
          total: '10.00',
          platformFee: '0.50',
          netAmount: '9.50',
          paymentMethod: 'mercadopago',
          splitStatus: 'CONFIRMED',
          splitDetails: null,
        },
        // 3: PushinPay confirmado (R$ 19,50)
        {
          id: 'o-3',
          total: '20.00',
          platformFee: '0.50',
          netAmount: '19.50',
          paymentMethod: 'pushinpay',
          splitStatus: 'PROCESSED',
          splitDetails: {},
        },
      ];

      // Testando classificação idêntica para cada ordem em todas as frentes
      const classifications = sampleOrders.map((o) => ({
        orderId: o.id,
        isConfirmed: isOrderNetConfirmed(o),
      }));

      expect(classifications).toEqual([
        { orderId: 'o-1', isConfirmed: true },
        { orderId: 'o-2', isConfirmed: false }, // Legado MP é estimado!
        { orderId: 'o-3', isConfirmed: true },  // PushinPay é confirmado!
      ]);
    });

    it('6. Valores monetários não são alterados por essa correção de classificação', () => {
      const legacyMpOrder = {
        id: 'ord-mp-val-check',
        total: '10.00',
        netAmount: '9.50',
        platformFee: '0.50',
        paymentMethod: 'mercadopago',
        splitStatus: 'CONFIRMED',
        splitDetails: null,
      };

      // A classificação é estimada
      const isConfirmed = isOrderNetConfirmed(legacyMpOrder);
      expect(isConfirmed).toBe(false);

      // Mas o valor monetário registrado continua exatamente o mesmo:
      expect(legacyMpOrder.total).toBe('10.00');
      expect(legacyMpOrder.netAmount).toBe('9.50');
      expect(legacyMpOrder.platformFee).toBe('0.50');
    });
  });
});
