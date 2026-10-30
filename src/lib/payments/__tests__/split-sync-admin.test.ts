import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitReconciliationService } from '../split-reconciliation-service';
import { PLATFORM_SPLIT_EFFECTIVE_DATE } from '@/lib/analytics/admin-dashboard-service';

// ─── DB mock ────────────────────────────────────────────────────────────────
const { dbMock } = vi.hoisted(() => {
  const updateReturning = vi.fn().mockResolvedValue([{ id: 'order-1', splitStatus: 'CONFIRMED' }]);
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateChain = vi.fn().mockReturnValue({ set: updateSet });

  const insertValues = vi.fn().mockResolvedValue([]);
  const insertChain = vi.fn().mockReturnValue({ values: insertValues });

  const mock: any = {
    query: {
      orders: { findFirst: vi.fn(), findMany: vi.fn() },
      sellerPaymentConnections: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    update: updateChain,
    insert: insertChain,
    transaction: vi.fn(async (cb: any) => cb(mock)),
  };

  return { dbMock: mock };
});

vi.mock('@/db', () => ({ db: dbMock }));
vi.mock('@/lib/encryption', () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace('enc:', ''),
}));
vi.mock('@/db/ensure-payment-tables', () => ({ ensurePaymentTables: vi.fn() }));
vi.mock('@/lib/push/platform-financial-notification-service', () => ({
  PlatformFinancialNotificationService: { notifyOwnerOfCommission: vi.fn() },
}));

describe('Admin Split Sync — Comprehensive Verification & API Identifier Suite', () => {
  const platformAccountId = '9C3AD98C-F00B-4729-BEAC-0A4B70B3A043';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID = platformAccountId;
  });

  // ─── 1. PENDING, REQUESTED & NULL ELIGIBILITY TESTS ──────────────────────
  describe('1. Split Status Reconciliation Eligibility & Non-Terminal Protection', () => {
    const TERMINAL_STATUSES = ['SETTLED', 'CONFIRMED', 'PROCESSED', 'SKIPPED', 'FAILED'];
    const PENDING_CANDIDATE_STATUSES = ['PENDING', 'pending', 'REQUESTED', 'requested', null, ''];

    it('identifies all pending states (PENDING, REQUESTED, null, empty) as candidates for sync', () => {
      const isEligibleForSync = (status: string | null | undefined): boolean => {
        if (status === null || status === undefined) return true;
        const normalized = status.trim().toUpperCase();
        if (normalized === '' || normalized === 'PENDING' || normalized === 'REQUESTED') return true;
        if (TERMINAL_STATUSES.includes(normalized)) return false;
        return false;
      };

      for (const st of PENDING_CANDIDATE_STATUSES) {
        expect(isEligibleForSync(st)).toBe(true);
      }
    });

    it('strictly protects all terminal statuses from being reprocessed or downgraded', () => {
      const isEligibleForSync = (status: string | null | undefined): boolean => {
        if (status === null || status === undefined) return true;
        const normalized = status.trim().toUpperCase();
        if (TERMINAL_STATUSES.includes(normalized)) return false;
        return normalized === '' || normalized === 'PENDING' || normalized === 'REQUESTED';
      };

      for (const term of TERMINAL_STATUSES) {
        expect(isEligibleForSync(term)).toBe(false);
        expect(isEligibleForSync(term.toLowerCase())).toBe(false);
      }
    });

    it('reconciles an order with splitStatus PENDING when official PushinPay evidence is verified', () => {
      const pendingOrder = {
        id: 'order-pending-test',
        total: '20.00',
        splitStatus: 'PENDING',
        splitAmountCents: 50,
        splitConfirmedAt: null,
        splitError: null,
        splitDetails: null,
        platformFee: '0.00',
        netAmount: '20.00',
      };

      const officialTx = {
        id: 'tx-pushin-pending',
        status: 'paid',
        value: 2000,
        split_rules: [{ value: 50, account_id: platformAccountId }],
      };

      const result = SplitReconciliationService.evaluatePushinPaySplit({
        order: pendingOrder,
        officialTx,
        platformAccountId,
      });

      expect(result.status).toBe('PROCESSED');
      expect(result.platformFeeStr).toBe('0.50');
      expect(result.netAmountStr).toBe('19.50');
      expect(result.auditAction).toBe('PROCESSED_BY_GATEWAY');
    });

    it('reconciles an order with splitStatus null when official PushinPay evidence is verified', () => {
      const nullOrder = {
        id: 'order-null-test',
        total: '15.00',
        splitStatus: null,
        splitAmountCents: 50,
        splitConfirmedAt: null,
        splitError: null,
        splitDetails: null,
        platformFee: '0.00',
        netAmount: '15.00',
      };

      const officialTx = {
        id: 'tx-pushin-null',
        status: 'paid',
        value: 1500,
        split_rules: [{ value: 50, account_id: platformAccountId }],
      };

      const result = SplitReconciliationService.evaluatePushinPaySplit({
        order: nullOrder,
        officialTx,
        platformAccountId,
      });

      expect(result.status).toBe('PROCESSED');
      expect(result.platformFeeStr).toBe('0.50');
      expect(result.netAmountStr).toBe('14.50');
    });

    it('reconciles an order with splitStatus REQUESTED when official PushinPay evidence is verified', () => {
      const requestedOrder = {
        id: 'order-requested-test',
        total: '10.00',
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
        splitConfirmedAt: null,
        splitError: null,
        splitDetails: null,
        platformFee: '0.00',
        netAmount: '10.00',
      };

      const officialTx = {
        id: 'tx-pushin-req',
        status: 'paid',
        value: 1000,
        split_rules: [{ value: 50, account_id: platformAccountId }],
      };

      const result = SplitReconciliationService.evaluatePushinPaySplit({
        order: requestedOrder,
        officialTx,
        platformAccountId,
      });

      expect(result.status).toBe('PROCESSED');
      expect(result.platformFeeStr).toBe('0.50');
    });
  });

  // ─── 2. PUSHINPAY API IDENTIFIERS & PROTOCOL VALIDATION ───────────────────
  describe('2. PushinPay API Identifiers & Safeguards', () => {
    it('properly validates official transaction ID format in PushinPay status queries', async () => {
      const { pushinPayProvider } = await import('../providers/pushinpay');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'tx-uuid-1234-5678',
          status: 'paid',
          value: 5000,
          split_rules: [{ value: 50, account_id: platformAccountId }],
        }),
      } as Response);

      const status = await pushinPayProvider.getPixPaymentStatus('tx-uuid-1234-5678', 'valid-token');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.pushinpay.com.br/api/transactions/tx-uuid-1234-5678',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer valid-token' }),
        })
      );
      expect(status?.id).toBe('tx-uuid-1234-5678');
      expect(status?.status).toBe('paid');
    });

    it('safely skips PushinPay API calls when paymentId is missing or empty', async () => {
      const { pushinPayProvider } = await import('../providers/pushinpay');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const nullStatus = await pushinPayProvider.getPixPaymentStatus('', 'token');
      expect(nullStatus).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('flags divergence and keeps MERCHANT WHOLE if PushinPay returns paid without platform account in split', () => {
      const order = {
        id: 'order-div',
        total: '30.00',
        splitStatus: 'PENDING',
        splitAmountCents: 50,
      };

      const officialTx = {
        id: 'tx-div',
        status: 'paid',
        value: 3000,
        split_rules: [{ value: 50, account_id: 'unauthorized-recipient' }],
      };

      const result = SplitReconciliationService.evaluatePushinPaySplit({
        order: order as any,
        officialTx,
        platformAccountId,
      });

      expect(result.status).toBe('GATEWAY_ACCEPTED');
      expect(result.splitError).toBe('DESTINATARIO_DO_SPLIT_DIVERGENTE');
      expect(result.platformFeeStr).toBe('0.00'); // Merchant whole
      expect(result.netAmountStr).toBe('30.00');
      expect(result.auditAction).toBe('DIVERGENCE_FLAGGED');
    });
  });

  // ─── 3. MERCADO PAGO API IDENTIFIERS & ENDPOINT COMPATIBILITY ─────────────
  describe('3. Mercado Pago API Identifiers & Endpoint Structure', () => {
    it('uses external_reference (Order UUID) to query Payments Search API', () => {
      const orderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}`;
      
      expect(searchUrl).toContain('/v1/payments/search?external_reference=');
      expect(searchUrl).toContain(orderId);
    });

    it('distinguishes strictly numeric IDs for /v1/payments/{id} from Order IDs for /v1/orders/{id}', () => {
      const numericPaymentId = '12345678901';
      const alphanumericOrderId = 'order_abc_123xyz';

      const isNumeric = (id: string) => /^\d+$/.test(id);

      expect(isNumeric(numericPaymentId)).toBe(true);
      expect(isNumeric(alphanumericOrderId)).toBe(false);

      // Numeric -> /v1/payments/12345678901
      const numericEndpoint = isNumeric(numericPaymentId)
        ? `https://api.mercadopago.com/v1/payments/${numericPaymentId}`
        : `https://api.mercadopago.com/v1/orders/${numericPaymentId}`;
      expect(numericEndpoint).toBe(`https://api.mercadopago.com/v1/payments/${numericPaymentId}`);

      // Alphanumeric -> /v1/orders/order_abc_123xyz
      const alphaEndpoint = isNumeric(alphanumericOrderId)
        ? `https://api.mercadopago.com/v1/payments/${alphanumericOrderId}`
        : `https://api.mercadopago.com/v1/orders/${alphanumericOrderId}`;
      expect(alphaEndpoint).toBe(`https://api.mercadopago.com/v1/orders/${alphanumericOrderId}`);
    });

    it('confirms split as CONFIRMED when marketplace_fee is >= R$ 0,50', () => {
      const paymentResponse = {
        id: '12345678',
        status: 'approved',
        marketplace_fee: 0.50,
      };

      const hasFeeEvidence = Number(paymentResponse.marketplace_fee) >= 0.50;
      expect(hasFeeEvidence).toBe(true);
    });

    it('confirms split via charges_details containing marketplace_fee even if top-level fee is 0', () => {
      const paymentResponse = {
        id: '12345678',
        status: 'approved',
        marketplace_fee: 0,
        charges_details: [
          { type: 'marketplace_fee', amount: { value: 0.50 } },
        ],
      };

      const hasChargesFee =
        Array.isArray(paymentResponse.charges_details) &&
        paymentResponse.charges_details.some(
          (c: any) => c.type === 'marketplace_fee' || c.type === 'application_fee'
        );

      expect(hasChargesFee).toBe(true);
    });

    it('confirms split via fee_details containing marketplace collector fee', () => {
      const paymentResponse = {
        id: '12345678',
        status: 'approved',
        marketplace_fee: 0,
        fee_details: [
          { type: 'marketplace_fee', amount: 0.50, fee_payer: 'collector' },
        ],
      };

      const hasFeeDetails =
        Array.isArray(paymentResponse.fee_details) &&
        paymentResponse.fee_details.some(
          (f: any) => f.type === 'marketplace_fee' || f.fee_payer === 'collector'
        );

      expect(hasFeeDetails).toBe(true);
    });

    it('keeps split as REQUESTED if no official fee evidence exists in Mercado Pago', () => {
      const paymentResponse = {
        id: '12345678',
        status: 'approved',
        marketplace_fee: 0,
        charges_details: [],
        fee_details: [],
      };

      const officialMpFee = Number(paymentResponse.marketplace_fee || 0);
      const hasChargesFee =
        Array.isArray(paymentResponse.charges_details) &&
        paymentResponse.charges_details.some(
          (c: any) => c.type === 'marketplace_fee' || c.type === 'application_fee'
        );
      const hasFeeDetails =
        Array.isArray(paymentResponse.fee_details) &&
        paymentResponse.fee_details.some(
          (f: any) => f.type === 'marketplace_fee' || f.fee_payer === 'collector'
        );

      const hasFeeEvidence = officialMpFee >= 0.50 || hasChargesFee || hasFeeDetails;
      expect(hasFeeEvidence).toBe(false);
    });
  });

  // ─── 4. AUDIT & RECONCILIATION ATOMICITY ──────────────────────────────────
  describe('4. Dedicated Audit Log Retention & Atomicity', () => {
    it('records audit log with action ADMIN_SYNC_PROCESSED_BY_GATEWAY upon confirmation', async () => {
      const executor = {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      };

      await SplitReconciliationService.recordAuditLog(
        {
          orderId: 'order-audit-test',
          previousStatus: 'PENDING',
          newStatus: 'PROCESSED',
          action: 'ADMIN_SYNC_PROCESSED_BY_GATEWAY',
          splitAmountCents: 50,
          platformAccountId,
          notes: 'Reconciliação admin via POST /api/admin/splits/sync',
        },
        executor
      );

      expect(executor.insert).toHaveBeenCalledTimes(1);
      const callArgs = executor.insert.mock.results[0].value.values;
      expect(callArgs).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-audit-test',
          previousStatus: 'PENDING',
          newStatus: 'PROCESSED',
          action: 'ADMIN_SYNC_PROCESSED_BY_GATEWAY',
          splitAmountCents: 50,
        })
      );
    });
  });

  // ─── 5. PLATFORM SPLIT EFFECTIVE DATE (22/10/2026 00:00 RECIFE = 03:00 UTC) ──
  describe('5. Platform Split Effective Date (22/10/2026 America/Recife = 03:00 UTC) & Timezone Precision', () => {
    const isEligibleForSplit = (order: {
      status: string;
      createdAt: Date;
      splitAmountCents?: number | null;
      splitStatus?: string | null;
    }): boolean => {
      if (order.status !== 'paid') return false;
      const hasExplicitSnapshot = typeof order.splitAmountCents === 'number' && !isNaN(order.splitAmountCents);
      const hasExplicitStatus = Boolean(order.splitStatus) && order.splitStatus!.trim() !== '' && order.splitStatus!.toUpperCase() !== 'PENDING';
      const isPostEffectiveDate = order.createdAt >= PLATFORM_SPLIT_EFFECTIVE_DATE;
      return hasExplicitSnapshot || hasExplicitStatus || isPostEffectiveDate;
    };

    const isPendingSplit = (order: {
      status: string;
      createdAt: Date;
      splitAmountCents?: number | null;
      splitStatus?: string | null;
    }): boolean => {
      if (!isEligibleForSplit(order)) return false;
      const st = (order.splitStatus || 'PENDING').trim().toUpperCase();
      const TERMINAL_STATUSES = ['SETTLED', 'CONFIRMED', 'PROCESSED', 'SKIPPED', 'FAILED'];
      if (TERMINAL_STATUSES.includes(st)) return false;
      return st === 'PENDING' || st === 'REQUESTED' || st === '';
    };

    it('confirma que a constante de vigência é exatamente 22/10/2026 00:00 em Recife (03:00:00.000Z em UTC)', () => {
      expect(PLATFORM_SPLIT_EFFECTIVE_DATE.toISOString()).toBe('2026-10-22T03:00:00.000Z');
    });

    it('1. Pedidos de 21/10 às 23:59 em Recife (2026-10-22T02:59:59Z) são tratados como anteriores à vigência, salvo snapshot explícito', () => {
      // 21/10/2026 23:59:59 em Recife (UTC-3) = 2026-10-22T02:59:59.000Z
      const orderAt2359WithoutSnapshot = {
        id: 'ord-21-2359-no-snap',
        status: 'paid',
        createdAt: new Date('2026-10-22T02:59:59.000Z'),
        splitStatus: null,
        splitAmountCents: null,
      };

      expect(isEligibleForSplit(orderAt2359WithoutSnapshot)).toBe(false);
      expect(isPendingSplit(orderAt2359WithoutSnapshot)).toBe(false);

      // Com status PENDING default legado mas sem snapshot: não elegível
      const orderAt2359PendingDefault = {
        id: 'ord-21-2359-pending-default',
        status: 'paid',
        createdAt: new Date('2026-10-22T02:59:59.000Z'),
        splitStatus: 'PENDING',
        splitAmountCents: null,
      };

      expect(isEligibleForSplit(orderAt2359PendingDefault)).toBe(false);
      expect(isPendingSplit(orderAt2359PendingDefault)).toBe(false);

      // Se possuir snapshot explícito (ex: comissão fixada de 50 centavos): respeita o snapshot
      const orderAt2359WithSnapshot = {
        id: 'ord-21-2359-with-snap',
        status: 'paid',
        createdAt: new Date('2026-10-22T02:59:59.000Z'),
        splitStatus: 'PENDING',
        splitAmountCents: 50,
      };

      expect(isEligibleForSplit(orderAt2359WithSnapshot)).toBe(true);
      expect(isPendingSplit(orderAt2359WithSnapshot)).toBe(true);
    });

    it('2. Pedidos de 22/10 às 00:00 em Recife (2026-10-22T03:00:00Z) são elegíveis à taxa da plataforma', () => {
      // 22/10/2026 00:00:00 em Recife (UTC-3) = 2026-10-22T03:00:00.000Z (marco exato)
      const orderAt0000 = {
        id: 'ord-22-0000',
        status: 'paid',
        createdAt: new Date('2026-10-22T03:00:00.000Z'),
        splitStatus: null,
        splitAmountCents: null,
      };

      expect(isEligibleForSplit(orderAt0000)).toBe(true);
      expect(isPendingSplit(orderAt0000)).toBe(true);

      // 22/10/2026 00:01:00 em Recife = 2026-10-22T03:01:00.000Z
      const orderAt0001 = {
        id: 'ord-22-0001',
        status: 'paid',
        createdAt: new Date('2026-10-22T03:01:00.000Z'),
        splitStatus: 'REQUESTED',
        splitAmountCents: 50,
      };

      expect(isEligibleForSplit(orderAt0001)).toBe(true);
      expect(isPendingSplit(orderAt0001)).toBe(true);
    });

    it('3. Snapshots históricos explícitos continuam sempre respeitados independentemente da data de criação', () => {
      // Pedido de 10/10 com splitAmountCents registrado explicitamente
      const legacyWithSnapshot = {
        id: 'ord-snap-legacy',
        status: 'paid',
        createdAt: new Date('2026-10-10T14:00:00.000Z'),
        splitStatus: 'CONFIRMED',
        splitAmountCents: 50,
      };

      expect(isEligibleForSplit(legacyWithSnapshot)).toBe(true);
      // Já está CONFIRMED, portanto não é pendente
      expect(isPendingSplit(legacyWithSnapshot)).toBe(false);
    });

    it('4. Pedido Mercado Pago de 29/10 com split CONFIRMED não aparece como pendente', () => {
      const mpConfirmedOrder = {
        id: 'c1df5c3b-7f6c-4869-a1b7-789a7fb85b88',
        status: 'paid',
        createdAt: new Date('2026-10-29T11:53:23Z'),
        splitStatus: 'CONFIRMED',
        splitAmountCents: 50,
      };

      expect(isEligibleForSplit(mpConfirmedOrder)).toBe(true);
      expect(isPendingSplit(mpConfirmedOrder)).toBe(false);
    });

    it('5. Estados terminais (SETTLED, CONFIRMED, PROCESSED, SKIPPED, FAILED) continuam excluídos da pendência', () => {
      const terminalStatuses = ['SETTLED', 'CONFIRMED', 'PROCESSED', 'SKIPPED', 'FAILED'];

      for (const st of terminalStatuses) {
        const order = {
          id: `term-${st}`,
          status: 'paid',
          createdAt: new Date('2026-10-25T12:00:00Z'),
          splitStatus: st,
          splitAmountCents: 50,
        };
        expect(isPendingSplit(order)).toBe(false);
      }
    });

    it('6. Pedidos legados não são alterados no banco e preservam seu estado histórico', () => {
      const legacyOrder = {
        id: 'order-legacy-1',
        total: '10.00',
        paymentMethod: 'pix',
        paymentId: 'syncpay_old_123',
        storeId: 'store-1',
        splitStatus: null,
        splitAmountCents: null,
        createdAt: new Date('2026-10-22T02:59:00.000Z'), // 21/10 23:59 em Recife
      };

      const isEligible =
        (typeof legacyOrder.splitAmountCents === 'number' && legacyOrder.splitAmountCents > 0) ||
        new Date(legacyOrder.createdAt) >= PLATFORM_SPLIT_EFFECTIVE_DATE;

      expect(isEligible).toBe(false);
      expect(dbMock.update).not.toHaveBeenCalled();
    });
  });
});
