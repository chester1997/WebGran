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

/**
 * Avalia de forma rigorosa e conservadora se o valor líquido (netAmount) de um pedido
 * está comprovadamente confirmado por evidência financeira oficial.
 *
 * Regras:
 * - Se `splitDetails.netConfirmed === true`, retorna true.
 * - Se `splitDetails.netConfirmed === false`, retorna false.
 * - Para Mercado Pago: NUNCA inferir confirmação apenas por status CONFIRMED/SETTLED/PROCESSED
 *   sem evidência explícita do valor líquido (`netConfirmed === true`). Pedidos legados são
 *   classificados de forma conservadora como não confirmados (estimados).
 * - Para PushinPay: o split nativo PIX liquida diretamente (total - 0.50) ao lojista, portanto
 *   status CONFIRMED/SETTLED/PROCESSED com netAmount preenchido é considerado confirmado.
 * - Para demais cenários: fallback conservador (retorna false).
 */
export function isOrderNetConfirmed(order: {
  paymentMethod?: string | null;
  splitDetails?: any;
  splitStatus?: string | null;
  netAmount?: string | number | null;
}): boolean {
  const details = order.splitDetails as any;
  if (details?.netConfirmed === true) {
    return true;
  }
  if (details?.netConfirmed === false) {
    return false;
  }

  const gateway = (order.paymentMethod || '').toLowerCase().trim();
  const isMercadoPago =
    gateway === 'mercadopago' ||
    gateway === 'mercado_pago' ||
    gateway === 'mp' ||
    gateway.startsWith('pix');

  // Para Mercado Pago, NUNCA inferir confirmação apenas por status CONFIRMED/SETTLED/PROCESSED sem evidência explícita
  if (isMercadoPago) {
    return false;
  }

  // Para PushinPay, o split nativo PIX liquida diretamente (total - 0.50) ao lojista
  const isPushinPay = gateway === 'pushinpay';
  if (isPushinPay) {
    const statusUpper = String(order.splitStatus || '').toUpperCase();
    return ['CONFIRMED', 'SETTLED', 'PROCESSED'].includes(statusUpper) && order.netAmount != null;
  }

  // Fallback seguro e conservador: se não tiver evidência explícita, considera não confirmado (estimado)
  return false;
}

export class SplitReconciliationService {
  static isNetConfirmed(order: {
    paymentMethod?: string | null;
    splitDetails?: any;
    splitStatus?: string | null;
    netAmount?: string | number | null;
  }): boolean {
    return isOrderNetConfirmed(order);
  }
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
        splitError: order.splitError || 'COMISSAO_ZERO_OU_VALOR_INSUFICIENTE',
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

    // 6. Validação rigorosa de valor em centavos (suporta matchingRule.amount da API oficial e matchingRule.value)
    const rawRuleValue = matchingRule.amount !== undefined && matchingRule.amount !== null
      ? matchingRule.amount
      : matchingRule.value;
    let ruleValueCents = Math.round(Number(rawRuleValue));
    if (ruleValueCents === 0 && Number(rawRuleValue) > 0 && Math.round(Number(rawRuleValue) * 100) === orderSplitCents) {
      ruleValueCents = Math.round(Number(rawRuleValue) * 100);
    }
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
   * Strictly evaluates the official Mercado Pago payment response against order split expectations.
   *
   * To achieve PROCESSED:
   * 1. officialTx.status MUST be 'approved' (or status_detail === 'accredited')
   * 2. Evidence of application_fee, marketplace_fee, or charges_details/fee_details MUST be present
   * 3. The fee value in cents MUST match order.splitAmountCents
   *
   * If refunded or cancelled:
   * Returns FAILED with zero fee and flags the refund event.
   */
  static evaluateMercadoPagoSplit(input: {
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
  }): SplitEvaluationResult {
    const { order, officialTx } = input;

    // 1. Preservar estados terminais ou liquidados
    if (order.splitStatus === 'SETTLED') {
      return {
        status: 'SETTLED',
        platformFeeStr: order.platformFee ?? null,
        netAmountStr: order.netAmount ?? null,
        splitConfirmedAt: order.splitConfirmedAt ?? null,
        splitError: order.splitError ?? null,
        splitDetails: order.splitDetails ?? null,
        auditAction: 'NONE',
      };
    }

    if (order.splitStatus === 'SKIPPED' && (order as any).status === 'paid') {
      return {
        status: 'SKIPPED',
        platformFeeStr: order.platformFee ?? '0.00',
        netAmountStr: order.netAmount ?? order.total,
        splitConfirmedAt: order.splitConfirmedAt ?? null,
        splitError: order.splitError || 'COMISSAO_ZERO_OU_VALOR_INSUFICIENTE',
        splitDetails: order.splitDetails ?? null,
        auditAction: 'NONE',
      };
    }

    const orderSplitCents = typeof order.splitAmountCents === 'number' && !isNaN(order.splitAmountCents)
      ? order.splitAmountCents
      : (order.splitError === 'ISENCAO_TEMPORARIA' || order.splitError === 'COMISSAO_ZERO')
      ? 0
      : 50;
    const orderSplitReais = (orderSplitCents / 100).toFixed(2);

    // 2. Tratar reembolsos e cancelamentos
    const rawStatus = String(officialTx?.status || '').toLowerCase().trim();
    if (rawStatus === 'refunded' || rawStatus === 'charged_back' || rawStatus === 'cancelled') {
      return {
        status: 'FAILED',
        platformFeeStr: '0.00',
        netAmountStr: '0.00',
        splitConfirmedAt: null,
        splitError: rawStatus === 'refunded' ? 'PAGAMENTO_REEMBOLSADO' : 'PAGAMENTO_CANCELADO',
        splitDetails: officialTx?.charges_details || officialTx?.fee_details || null,
        auditAction: 'FAILED',
        divergenceReason: `Transação no Mercado Pago possui status "${rawStatus}".`,
      };
    }

    // 3. Tratar pagamentos rejeitados
    if (rawStatus === 'rejected') {
      return {
        status: 'FAILED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'PAGAMENTO_REJEITADO',
        splitDetails: null,
        auditAction: 'FAILED',
        divergenceReason: 'O pagamento foi rejeitado pelo Mercado Pago.',
      };
    }

    // 4. Verificar se a transação está efetivamente aprovada
    const isApproved = rawStatus === 'approved' || officialTx?.status_detail === 'accredited';
    if (!isApproved) {
      return {
        status: (order.splitStatus as SplitStatus) || 'REQUESTED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'TRANSACAO_NAO_PAGA',
        splitDetails: null,
        auditAction: 'NONE',
      };
    }

    // 5. Verificar valor mínimo da ordem
    if (Number(order.total) < 0.50) {
      return {
        status: 'SKIPPED',
        platformFeeStr: '0.00',
        netAmountStr: order.total,
        splitConfirmedAt: null,
        splitError: 'VALOR_ABAIXO_DA_COMISSAO_MINIMA',
        splitDetails: null,
        auditAction: 'SKIPPED',
      };
    }

    // 6. Extrair evidência da taxa da plataforma (application_fee, marketplace_fee, charges_details ou fee_details)
    let feeFoundReais = 0;
    let feeEvidenceSource: any = null;

    if (typeof officialTx.application_fee === 'number' && officialTx.application_fee > 0) {
      feeFoundReais = officialTx.application_fee;
      feeEvidenceSource = { application_fee: officialTx.application_fee };
    } else if (typeof officialTx.marketplace_fee === 'number' && officialTx.marketplace_fee > 0) {
      feeFoundReais = officialTx.marketplace_fee;
      feeEvidenceSource = { marketplace_fee: officialTx.marketplace_fee };
    }

    if (feeFoundReais === 0 && Array.isArray(officialTx.charges_details)) {
      const splitCharge = officialTx.charges_details.find((c: any) =>
        c.type === 'application_fee' || c.type === 'marketplace_fee'
      );
      if (splitCharge) {
        feeFoundReais = Number(splitCharge.amounts?.original ?? splitCharge.amount ?? 0);
        feeEvidenceSource = splitCharge;
      }
    }

    if (feeFoundReais === 0 && Array.isArray(officialTx.fee_details)) {
      const splitFee = officialTx.fee_details.find((f: any) =>
        f.type === 'application_fee' || f.type === 'marketplace_fee'
      );
      if (splitFee) {
        feeFoundReais = Number(splitFee.amount ?? 0);
        feeEvidenceSource = splitFee;
      }
    }

    const feeFoundCents = Math.round(feeFoundReais * 100);

    // 7. Extrair valor líquido efetivamente recebido pelo vendedor da resposta oficial do gateway, se disponível
    const officialNetReceived = (
      typeof officialTx.transaction_details?.net_received_amount === 'number' &&
      !isNaN(officialTx.transaction_details.net_received_amount) &&
      officialTx.transaction_details.net_received_amount > 0
    ) ? officialTx.transaction_details.net_received_amount
      : (
        typeof officialTx.net_received_amount === 'number' &&
        !isNaN(officialTx.net_received_amount) &&
        officialTx.net_received_amount > 0
      ) ? officialTx.net_received_amount
      : null;

    // Verificar se o pedido já possuía valor líquido conciliado anteriormente
    const wasPreviouslyConfirmed = isOrderNetConfirmed(order as any);
    const existingNetAmount = typeof (order as any).netAmount === 'string' || typeof (order as any).netAmount === 'number'
      ? Number((order as any).netAmount)
      : null;

    let resolvedNetAmountStr: string;
    let isNetConfirmed: boolean;

    if (officialNetReceived !== null) {
      // Prioridade 1: valor oficial retornado pelo gateway
      resolvedNetAmountStr = officialNetReceived.toFixed(2);
      isNetConfirmed = true;
    } else if (wasPreviouslyConfirmed && existingNetAmount !== null && !isNaN(existingNetAmount)) {
      // Prioridade 2: preservar valor anteriormente confirmado se nova resposta não trouxer dado oficial
      resolvedNetAmountStr = existingNetAmount.toFixed(2);
      isNetConfirmed = true;
    } else {
      // Prioridade 3: fallback estimado (total - comissão da plataforma), marcado como não confirmado
      resolvedNetAmountStr = Math.max(0, Number(order.total) - Number(orderSplitReais)).toFixed(2);
      isNetConfirmed = false;
    }

    // 8. Se não houver evidência de taxa na resposta oficial
    if (feeFoundCents === 0) {
      if (orderSplitCents === 0) {
        // Vendedor isento ou comissão zero aprovada: ausência de retenção é o comportamento correto!
        const detailsPayload = (typeof feeEvidenceSource === 'object' && feeEvidenceSource !== null && !Array.isArray(feeEvidenceSource))
          ? { ...feeEvidenceSource, netConfirmed: isNetConfirmed, netReceivedAmount: isNetConfirmed ? Number(resolvedNetAmountStr) : undefined, exemption: true }
          : {
              rawEvidence: feeEvidenceSource || { exemption: true },
              netConfirmed: isNetConfirmed,
              netReceivedAmount: isNetConfirmed ? Number(resolvedNetAmountStr) : undefined,
              exemption: true,
            };

        return {
          status: 'CONFIRMED',
          platformFeeStr: '0.00',
          netAmountStr: resolvedNetAmountStr,
          splitConfirmedAt: new Date(),
          splitError: order.splitError || null,
          splitDetails: detailsPayload,
          auditAction: 'PROCESSED_BY_GATEWAY',
        };
      }

      return {
        status: 'GATEWAY_ACCEPTED',
        platformFeeStr: '0.00',
        netAmountStr: resolvedNetAmountStr,
        splitConfirmedAt: null,
        splitError: 'SEM_EVIDENCIA_DE_SPLIT_NA_RESPOSTA_OFICIAL',
        splitDetails: {
          rawEvidence: feeEvidenceSource,
          netConfirmed: isNetConfirmed,
          netReceivedAmount: isNetConfirmed ? Number(resolvedNetAmountStr) : undefined,
        },
        auditAction: 'DIVERGENCE_FLAGGED',
        divergenceReason: 'A transação foi quitada no Mercado Pago, mas nenhuma taxa de marketplace/application_fee foi encontrada na resposta oficial.',
      };
    }

    // 9. Se o valor retornado divergir do esperado
    if (feeFoundCents !== orderSplitCents) {
      return {
        status: 'GATEWAY_ACCEPTED',
        platformFeeStr: '0.00',
        netAmountStr: resolvedNetAmountStr,
        splitConfirmedAt: null,
        splitError: 'VALOR_DO_SPLIT_DIVERGENTE',
        splitDetails: {
          ...(typeof feeEvidenceSource === 'object' && feeEvidenceSource !== null && !Array.isArray(feeEvidenceSource)
            ? feeEvidenceSource
            : { rawEvidence: feeEvidenceSource }),
          netConfirmed: isNetConfirmed,
          netReceivedAmount: isNetConfirmed ? Number(resolvedNetAmountStr) : undefined,
        },
        auditAction: 'DIVERGENCE_FLAGGED',
        divergenceReason: `O valor do split no Mercado Pago (${feeFoundCents} centavos) diverge da comissão esperada (${orderSplitCents} centavos).`,
      };
    }

    // 10. Split aprovado e confirmado
    const detailsPayload = (typeof feeEvidenceSource === 'object' && feeEvidenceSource !== null && !Array.isArray(feeEvidenceSource))
      ? { ...feeEvidenceSource, netConfirmed: isNetConfirmed, netReceivedAmount: isNetConfirmed ? Number(resolvedNetAmountStr) : undefined }
      : {
          rawEvidence: feeEvidenceSource || { application_fee: feeFoundReais },
          netConfirmed: isNetConfirmed,
          netReceivedAmount: isNetConfirmed ? Number(resolvedNetAmountStr) : undefined,
        };

    return {
      status: 'CONFIRMED',
      platformFeeStr: orderSplitReais,
      netAmountStr: resolvedNetAmountStr,
      splitConfirmedAt: new Date(),
      splitError: null,
      splitDetails: detailsPayload,
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
        netAmountStr = order.netAmount && Number(order.netAmount) > 0
          ? order.netAmount
          : Math.max(0, Number(order.total) - Number(splitFeeReais)).toFixed(2);
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

    const result = await (db as any).transaction(runInTransaction);

    if (result?.success && (params.targetStatus === 'SETTLED' || params.targetStatus === 'PROCESSED')) {
      try {
        const { PlatformFinancialNotificationService } = await import('@/lib/push/platform-financial-notification-service');
        const splitAmountCents = typeof (params as any).splitAmountCents === 'number' ? (params as any).splitAmountCents : 50;
        await PlatformFinancialNotificationService.notifyOwnerOfCommission({
          orderId: params.orderId,
          eventType: params.targetStatus === 'SETTLED' ? 'COMMISSION_SETTLED' : 'COMMISSION_CONFIRMED',
          platformFeeReais: (splitAmountCents / 100).toFixed(2),
          splitAmountCents,
        });
      } catch (notifErr) {
        console.warn('[SplitReconciliationService] Falha não bloqueante ao notificar comissão reconciliada:', notifErr);
      }
    }

    return result;
  }
}
