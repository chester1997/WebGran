import { db } from '@/db';
import { orders, platformSplitAuditLogs } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export type SplitStatus =
  | 'REQUESTED'
  | 'GATEWAY_ACCEPTED'
  | 'PROCESSED'
  | 'SETTLED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CONFIRMED';

export interface SplitEvaluationInput {
  order: {
    id: string;
    total: string;
    platformFee?: string | null;
    netAmount?: string | null;
    splitStatus?: string | null;
    splitAmountCents?: number | null;
    splitConfirmedAt?: Date | null;
    splitError?: string | null;
    splitDetails?: any;
  };
  officialTx: any;
  platformAccountId?: string | null;
}

export interface SplitEvaluationResult {
  status: SplitStatus;
  platformFeeStr: string | null;
  netAmountStr: string | null;
  splitConfirmedAt: Date | null;
  splitError: string | null;
  splitDetails: any;
  auditAction: 'PROCESSED_BY_GATEWAY' | 'DIVERGENCE_FLAGGED' | 'SKIPPED' | 'FAILED' | 'NONE';
  divergenceReason?: string;
}

export class SplitReconciliationService {
  /**
   * Strictly evaluates the official Pushin Pay transaction response against order split expectations.
   *
   * To achieve PROCESSED:
   * 1. officialTx.status MUST be 'paid'
   * 2. An official split rule array MUST be present
   * 3. A rule MUST specifically match the expected platformAccountId
   * 4. The rule value in cents MUST exactly match order.splitAmountCents
   *
   * If any of these verifications fail, does NOT grant PROCESSED and does NOT recognize platform revenue,
   * keeping the merchant whole (netAmount = order.total) and flagging a divergence for manual audit.
   */
  static evaluatePushinPaySplit(input: SplitEvaluationInput): SplitEvaluationResult {
    const { order, officialTx, platformAccountId } = input;

    // 1. Preservar estados terminais, liquidados, dispensados ou confirmações legadas sem inventar ou recalcular valores históricos
    if (order.splitStatus === 'SETTLED') {
      return {
        status: 'SETTLED',
        platformFeeStr: order.platformFee ?? null,
        netAmountStr: order.netAmount ?? null,
        splitConfirmedAt: order.splitConfirmedAt ?? null,
        splitError: order.splitError ?? null,
        splitDetails: order.splitDetails ?? officialTx?.split_rules ?? null,
        auditAction: 'NONE',
      };
    }

    if (order.splitStatus === 'CONFIRMED') {
      return {
        status: 'CONFIRMED',
        platformFeeStr: order.platformFee ?? null,
        netAmountStr: order.netAmount ?? null,
        splitConfirmedAt: order.splitConfirmedAt ?? null,
        splitError: order.splitError ?? null,
        splitDetails: order.splitDetails ?? officialTx?.split_rules ?? null,
        auditAction: 'NONE',
      };
    }

    if (order.splitStatus === 'SKIPPED') {
      return {
        status: 'SKIPPED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'COMISSAO_ZERO_OU_VALOR_INSUFICIENTE',
        splitDetails: officialTx?.split_rules || null,
        auditAction: 'SKIPPED',
      };
    }

    if (order.splitStatus === 'FAILED') {
      return {
        status: 'FAILED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'SPLIT_PREVIAMENTE_FALHO',
        splitDetails: officialTx?.split_rules || null,
        auditAction: 'FAILED',
      };
    }

    // 2. Verificar se a transação do gateway está efetivamente paga
    const isPaid = String(officialTx?.status || '').toLowerCase().trim() === 'paid';
    if (!isPaid) {
      return {
        status: (order.splitStatus as SplitStatus) || 'REQUESTED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'TRANSACAO_NAO_PAGA',
        splitDetails: officialTx?.split_rules || null,
        auditAction: 'NONE',
      };
    }

    // 3. Extrair regras oficiais da resposta
    const rules: any[] = Array.isArray(officialTx?.split_rules)
      ? officialTx.split_rules
      : Array.isArray(officialTx?.splits)
      ? officialTx.splits
      : [];

    const orderSplitCents = typeof order.splitAmountCents === 'number' && !isNaN(order.splitAmountCents)
      ? order.splitAmountCents
      : 50;
    const orderSplitReais = (orderSplitCents / 100).toFixed(2);
    const normalizedExpectedAccount = (platformAccountId || '').trim().toLowerCase();

    // 4. Sem regras de split retornadas pela API oficial paga
    if (rules.length === 0) {
      return {
        status: 'GATEWAY_ACCEPTED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'SEM_REGRAS_DE_SPLIT_NA_RESPOSTA_OFICIAL',
        splitDetails: null,
        auditAction: 'DIVERGENCE_FLAGGED',
        divergenceReason: 'A transação foi quitada pelo cliente, mas a API oficial da Pushin Pay não retornou a regra de divisão.',
      };
    }

    // 5. Validação rigorosa de destinatário (account_id da plataforma)
    const matchingRule = rules.find((r: any) => {
      const ruleAcc = String(r.account_id || r.recipient_id || '').trim().toLowerCase();
      return normalizedExpectedAccount ? ruleAcc === normalizedExpectedAccount : Boolean(ruleAcc);
    });

    if (!matchingRule) {
      return {
        status: 'GATEWAY_ACCEPTED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'DESTINATARIO_DO_SPLIT_DIVERGENTE',
        splitDetails: rules,
        auditAction: 'DIVERGENCE_FLAGGED',
        divergenceReason: `A regra retornada pela API (${JSON.stringify(rules)}) não corresponde à conta oficial da plataforma (${platformAccountId}).`,
      };
    }

    // 6. Validação rigorosa de valor em centavos
    const ruleValueCents = Math.round(Number(matchingRule.value));
    if (isNaN(ruleValueCents) || ruleValueCents !== orderSplitCents) {
      return {
        status: 'GATEWAY_ACCEPTED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'VALOR_DO_SPLIT_DIVERGENTE',
        splitDetails: rules,
        auditAction: 'DIVERGENCE_FLAGGED',
        divergenceReason: `O valor do split retornado (${ruleValueCents} centavos) diverge da comissão esperada (${orderSplitCents} centavos).`,
      };
    }

    // 7. Todos os requisitos validados: transiciona para PROCESSED
    // O valor platform_fee representa a retenção oficial processada pelo motor do gateway
    return {
      status: 'PROCESSED',
      platformFeeStr: orderSplitReais,
      netAmountStr: Math.max(0, Number(order.total) - Number(orderSplitReais)).toFixed(2),
      splitConfirmedAt: new Date(),
      splitError: null,
      splitDetails: rules,
      auditAction: 'PROCESSED_BY_GATEWAY',
    };
  }

  /**
   * Registers a dedicated audit log entry in platform_split_audit_logs.
   * Can be executed within a Drizzle transaction to guarantee atomicity.
   */
  static async recordAuditLog(
    params: {
      orderId: string;
      previousStatus: string | null;
      newStatus: SplitStatus;
      action: string;
      splitAmountCents: number;
      platformAccountId?: string | null;
      evidenceDetails?: any;
      reconciledBy?: { id: string; name?: string | null } | null;
      notes?: string | null;
    },
    executor: any = db
  ): Promise<void> {
    if (!executor?.insert) return;
    try {
      await executor.insert(platformSplitAuditLogs).values({
        orderId: params.orderId,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus,
        action: params.action,
        splitAmountCents: params.splitAmountCents,
        platformAccountId: params.platformAccountId || null,
        evidenceDetails: params.evidenceDetails || null,
        reconciledById: params.reconciledBy?.id || null,
        reconciledByName: params.reconciledBy?.name || 'SISTEMA_WEBHOOK',
        notes: params.notes || null,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('[SplitReconciliationService] Failed to record split audit log:', err);
      // Re-throw if running inside a transaction or if requested to guarantee rollback
      throw err;
    }
  }

  /**
   * Manually reconciles an order split with verified financial evidence, allowing transition to SETTLED.
   * Enforces optimistic concurrency control and atomicity inside a single database transaction.
   */
  static async reconcileOrderSplit(params: {
    orderId: string;
    targetStatus: 'SETTLED' | 'PROCESSED' | 'FAILED';
    reconciledBy: { id: string; name?: string | null };
    financialEvidence: {
      bankStatementReference?: string;
      settlementId?: string;
      notes?: string;
      evidencePayload?: any;
    };
    expectedPreviousStatus?: SplitStatus;
  }): Promise<{ success: boolean; orderId: string; newStatus: SplitStatus }> {
    const runInTransaction = async (tx: any) => {
      const orderFinder = tx?.query?.orders?.findFirst ? tx.query.orders.findFirst : db.query.orders.findFirst;
      const order = await orderFinder({
        where: eq(orders.id, params.orderId),
      });

      if (!order) {
        throw new Error(`Pedido ${params.orderId} não encontrado.`);
      }

      // Validação de estados incompatíveis: apenas pedidos pagos podem ter split processado ou liquidado
      if ((params.targetStatus === 'SETTLED' || params.targetStatus === 'PROCESSED') && order.status !== 'paid') {
        throw new Error(`Não é possível definir split como ${params.targetStatus} para um pedido com status "${order.status}". O pedido precisa estar pago.`);
      }

      const previousStatus = order.splitStatus as SplitStatus | null;
      const expectedStatus = params.expectedPreviousStatus ?? previousStatus;

      // Se o chamador especificou explicitamente o status anterior esperado e há divergência imediata
      if (params.expectedPreviousStatus && previousStatus !== params.expectedPreviousStatus) {
        throw new Error(`Conflito de concorrência: o status atual do split é "${previousStatus}", mas o esperado era "${params.expectedPreviousStatus}". Reconciliação abortada.`);
      }

      const splitAmountCents = typeof order.splitAmountCents === 'number' ? order.splitAmountCents : 50;
      const splitFeeReais = (splitAmountCents / 100).toFixed(2);

      let platformFeeStr = order.platformFee || '0.00';
      let netAmountStr = order.netAmount || order.total;

      if (params.targetStatus === 'SETTLED' || params.targetStatus === 'PROCESSED') {
        platformFeeStr = splitFeeReais;
        netAmountStr = Math.max(0, Number(order.total) - Number(splitFeeReais)).toFixed(2);
      } else if (params.targetStatus === 'FAILED') {
        platformFeeStr = '0.00';
        netAmountStr = order.total;
      }

      // Monta a cláusula WHERE para validação atômica do estado anterior esperado
      const whereConditions = [eq(orders.id, params.orderId)];
      if (expectedStatus) {
        whereConditions.push(eq(orders.splitStatus, expectedStatus));
      } else {
        whereConditions.push(isNull(orders.splitStatus));
      }

      // Executa o update atômico com validação concorrente na cláusula WHERE
      const updatedRows = await tx.update(orders)
        .set({
          splitStatus: params.targetStatus,
          platformFee: platformFeeStr,
          netAmount: netAmountStr,
          splitDetails: {
            ...(typeof order.splitDetails === 'object' && order.splitDetails ? order.splitDetails : {}),
            manualReconciliation: params.financialEvidence,
          },
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .returning({ id: orders.id, splitStatus: orders.splitStatus });

      // Se nenhuma linha foi atualizada, aborta sem gravar auditoria
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(`Conflito de concorrência: o status do pedido ${params.orderId} foi alterado por outro processo. Reconciliação abortada sem gravar auditoria.`);
      }

      // Grava auditoria na mesma transação atômica
      await this.recordAuditLog({
        orderId: params.orderId,
        previousStatus,
        newStatus: params.targetStatus,
        action: 'MANUAL_RECONCILIATION',
        splitAmountCents,
        evidenceDetails: params.financialEvidence,
        reconciledBy: params.reconciledBy,
        notes: params.financialEvidence.notes || `Reconciliação manual para status ${params.targetStatus}`,
      }, tx);

      return {
        success: true,
        orderId: params.orderId,
        newStatus: params.targetStatus,
      };
    };

    return await (db as any).transaction(runInTransaction);
  }
}
