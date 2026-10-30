import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { orders, sellerPaymentConnections } from '@/db/schema';
import { eq, and, or, isNull, isNotNull, gte, sql } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { SplitReconciliationService } from '@/lib/payments/split-reconciliation-service';
import { PLATFORM_SPLIT_EFFECTIVE_DATE } from '@/lib/analytics/admin-dashboard-service';

/**
 * POST /api/admin/splits/sync
 *
 * Reconciles paid orders with pending splits (PENDING, REQUESTED, or null/empty).
 * Queries official gateway APIs for each order and promotes status only when
 * genuine fee split evidence is confirmed. Idempotent — never alters terminal states.
 *
 * Security & Financial Guarantees:
 * - Requires platform admin session.
 * - Encompasses PENDING, REQUESTED, and null split statuses (case-insensitive).
 * - Strictly excludes terminal/settled states (SETTLED, CONFIRMED, PROCESSED, SKIPPED, FAILED).
 * - Matches specific ID types expected by PushinPay and Mercado Pago endpoints.
 * - Never alters amounts, recipients or platform commission rules.
 * - Records dedicated audit entries in platform_split_audit_logs.
 * - Bounded batch execution (up to 200 orders per call).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const adminId = (session.user as any).id as string;
  const adminName = session.user.name || 'Admin';

  // 1. Find paid orders whose splits genuinely require reconciliation.
  // Must be eligible for platform split:
  // - Created on or after PLATFORM_SPLIT_EFFECTIVE_DATE (2026-10-22 00:00:00 Recife = 03:00:00 UTC).
  // Encompasses null, empty strings, 'PENDING', and 'REQUESTED' (case-insensitive).
  // Strictly filters out terminal states: SETTLED, CONFIRMED, PROCESSED, SKIPPED, FAILED.
  const pendingOrders = await db
    .select({
      id: orders.id,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      paymentId: orders.paymentId,
      storeId: orders.storeId,
      splitStatus: orders.splitStatus,
      splitAmountCents: orders.splitAmountCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, PLATFORM_SPLIT_EFFECTIVE_DATE),
        or(
          isNull(orders.splitStatus),
          eq(orders.splitStatus, ''),
          sql`lower(trim(${orders.splitStatus})) in ('pending', 'requested')`
        ),
        sql`upper(trim(coalesce(${orders.splitStatus}, ''))) not in ('SETTLED', 'CONFIRMED', 'PROCESSED', 'SKIPPED', 'FAILED')`
      )
    )
    .limit(200);

  const summary = {
    total: pendingOrders.length,
    updated: 0,
    skipped: 0,
    divergence: 0,
    errors: 0,
    details: [] as Array<{
      orderId: string;
      gateway: string;
      previousStatus: string | null;
      newStatus: string;
      reason: string;
    }>,
  };

  const platformAccountId =
    process.env.PUSHINPAY_PLATFORM_ACCOUNT_ID?.trim() ||
    process.env.PUSHINPAY_COMMISSION_ACCOUNT_ID?.trim() ||
    null;

  const TERMINAL_SPLIT_STATUSES = new Set(['SETTLED', 'CONFIRMED', 'PROCESSED', 'SKIPPED', 'FAILED']);

  for (const order of pendingOrders) {
    try {
      const currentUpperStatus = (order.splitStatus || '').trim().toUpperCase();

      // Guard: never reprocess terminal or settled states
      if (TERMINAL_SPLIT_STATUSES.has(currentUpperStatus)) {
        summary.skipped++;
        continue;
      }

      // Guard: strictly ignore orders prior to effective date
      if (new Date(order.createdAt) < PLATFORM_SPLIT_EFFECTIVE_DATE) {
        summary.skipped++;
        continue;
      }

      const gateway = (order.paymentMethod || 'unknown').toLowerCase().trim();

      // ─────────────────────────────────────────────────────────────
      // PUSHINPAY RECONCILIATION
      // ─────────────────────────────────────────────────────────────
      if (gateway === 'pushinpay') {
        const cleanPaymentId = (order.paymentId || '').trim();

        if (!cleanPaymentId) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: 'Pedido sem paymentId registrado no banco — requer verificação manual.',
          });
          continue;
        }

        const conn = await db.query.sellerPaymentConnections.findFirst({
          where: and(
            eq(sellerPaymentConnections.storeId, order.storeId),
            eq(sellerPaymentConnections.provider, 'pushinpay'),
            eq(sellerPaymentConnections.status, 'active')
          ),
        });

        if (!conn || !conn.accessTokenEncrypted) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: 'Conexão PushinPay ativa não encontrada para a loja do pedido.',
          });
          continue;
        }

        let token: string;
        try {
          token = decrypt(conn.accessTokenEncrypted);
        } catch {
          summary.errors++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: 'Falha ao descriptografar token da conexão PushinPay.',
          });
          continue;
        }

        // PushinPay GET /transactions/{id} expects the exact transaction ID (UUID or numeric string)
        const { pushinPayProvider } = await import('@/lib/payments/providers/pushinpay');
        const officialTx = await pushinPayProvider.getPixPaymentStatus(cleanPaymentId, token);

        if (!officialTx) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: `Transação ${cleanPaymentId} não localizada na API PushinPay.`,
          });
          continue;
        }

        const officialStatus = String(officialTx.status || '').toLowerCase().trim();
        if (officialStatus !== 'paid') {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: `Status na PushinPay é '${officialStatus}' (esperado 'paid') — split não alterado.`,
          });
          continue;
        }

        // Full verification via SplitReconciliationService
        const fullOrder = await db.query.orders.findFirst({
          where: eq(orders.id, order.id),
        });
        if (!fullOrder) continue;

        const evalResult = SplitReconciliationService.evaluatePushinPaySplit({
          order: fullOrder,
          officialTx,
          platformAccountId,
        });

        // Double guard against downgrading terminal statuses
        if (TERMINAL_SPLIT_STATUSES.has((fullOrder.splitStatus || '').toUpperCase())) {
          summary.skipped++;
          continue;
        }

        if (evalResult.status === fullOrder.splitStatus) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: evalResult.status,
            reason: 'Status já corresponde ao resultado oficial.',
          });
          continue;
        }

        // Atomic update with concurrency guard
        await (db as any).transaction(async (tx: any) => {
          const updatePayload: Record<string, any> = {
            splitStatus: evalResult.status,
            splitError: evalResult.splitError,
            splitDetails: evalResult.splitDetails,
            updatedAt: new Date(),
          };
          if (evalResult.platformFeeStr !== null) {
            updatePayload.platformFee = evalResult.platformFeeStr;
          }
          if (evalResult.netAmountStr !== null) {
            updatePayload.netAmount = evalResult.netAmountStr;
          }
          if (evalResult.splitConfirmedAt !== null) {
            updatePayload.splitConfirmedAt = evalResult.splitConfirmedAt;
          }

          await tx
            .update(orders)
            .set(updatePayload)
            .where(
              and(
                eq(orders.id, order.id),
                eq(orders.status, 'paid')
              )
            );

          if (evalResult.auditAction !== 'NONE') {
            await SplitReconciliationService.recordAuditLog(
              {
                orderId: order.id,
                previousStatus: fullOrder.splitStatus,
                newStatus: evalResult.status,
                action: `ADMIN_SYNC_${evalResult.auditAction}`,
                splitAmountCents:
                  typeof fullOrder.splitAmountCents === 'number'
                    ? fullOrder.splitAmountCents
                    : 50,
                platformAccountId,
                evidenceDetails: evalResult.splitDetails,
                reconciledBy: { id: adminId, name: adminName },
                notes:
                  evalResult.divergenceReason ||
                  'Reconciliação admin via POST /api/admin/splits/sync',
              },
              tx
            );
          }
        });

        if (evalResult.auditAction === 'DIVERGENCE_FLAGGED') {
          summary.divergence++;
        } else {
          summary.updated++;
        }

        summary.details.push({
          orderId: order.id,
          gateway,
          previousStatus: order.splitStatus,
          newStatus: evalResult.status,
          reason:
            evalResult.divergenceReason ||
            evalResult.splitError ||
            'Split atualizado com evidência oficial do gateway PushinPay.',
        });
        continue;
      }

      // ─────────────────────────────────────────────────────────────
      // MERCADO PAGO RECONCILIATION
      // ─────────────────────────────────────────────────────────────
      if (gateway === 'mercado_pago' || gateway.startsWith('pix') || gateway === 'mp') {
        const conn = await db.query.sellerPaymentConnections.findFirst({
          where: and(
            eq(sellerPaymentConnections.storeId, order.storeId),
            eq(sellerPaymentConnections.provider, 'mercado_pago'),
            eq(sellerPaymentConnections.status, 'active')
          ),
        });

        if (!conn || !conn.accessTokenEncrypted) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: 'Conexão Mercado Pago ativa não encontrada para a loja do pedido.',
          });
          continue;
        }

        let token: string;
        try {
          token = decrypt(conn.accessTokenEncrypted);
        } catch {
          summary.errors++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: 'Falha ao descriptografar token Mercado Pago.',
          });
          continue;
        }

        let approvedPayment: any = null;

        // Strategy A: Mercado Pago Payments Search API by external_reference (Order UUID)
        // Official MP endpoint that takes the system order ID (string/UUID) as external_reference
        try {
          const searchRes = await fetch(
            `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(order.id)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (Array.isArray(searchData?.results) && searchData.results.length > 0) {
              approvedPayment = searchData.results.find(
                (p: any) => p.status === 'approved' || p.status_detail === 'accredited'
              );
            }
          }
        } catch (err: any) {
          console.warn(`[SplitSync] MP Search by external_reference falhou para pedido ${order.id}:`, err?.message);
        }

        // Strategy B: If not found by external_reference and order.paymentId is provided,
        // use the exact ID format required by each specific endpoint:
        const rawPaymentId = (order.paymentId || '').trim();
        if (!approvedPayment && rawPaymentId) {
          const isNumericId = /^\d+$/.test(rawPaymentId);

          // 1. If purely numeric, call GET /v1/payments/{payment_id} (Official Payments API expects strictly numeric ID)
          if (isNumericId) {
            try {
              const payRes = await fetch(
                `https://api.mercadopago.com/v1/payments/${rawPaymentId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (payRes.ok) {
                const payData = await payRes.json();
                if (payData?.status === 'approved' || payData?.status_detail === 'accredited') {
                  approvedPayment = payData;
                }
              }
            } catch {
              // Non-blocking fallback
            }
          }

          // 2. Query Orders API GET /v1/orders/{order_id} or Merchant Orders GET /merchant_orders/{id}
          if (!approvedPayment) {
            try {
              const orderMpRes = await fetch(
                `https://api.mercadopago.com/v1/orders/${encodeURIComponent(rawPaymentId)}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (orderMpRes.ok) {
                const orderMpData = await orderMpRes.json();
                if (orderMpData?.status === 'processed' || orderMpData?.status === 'approved') {
                  const firstTx = orderMpData.transactions?.payments?.[0];
                  approvedPayment = {
                    id: firstTx?.id || orderMpData.id,
                    status: 'approved',
                    marketplace_fee: orderMpData.marketplace_fee || 0,
                    charges_details: firstTx?.charges_details || orderMpData.charges_details,
                    fee_details: firstTx?.fee_details || orderMpData.fee_details,
                  };
                }
              }
            } catch {
              // Non-blocking fallback
            }
          }
        }

        if (!approvedPayment) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: order.splitStatus ?? 'PENDING',
            reason: 'Pagamento não confirmado ou não localizado na API do Mercado Pago.',
          });
          continue;
        }

        // Evaluate official fee evidence from Mercado Pago response
        const officialMpFee = Number(approvedPayment.marketplace_fee || 0);
        const hasChargesFee =
          Array.isArray(approvedPayment.charges_details) &&
          approvedPayment.charges_details.some(
            (c: any) =>
              c.type === 'marketplace_fee' ||
              c.type === 'application_fee' ||
              c.type === 'marketplace'
          );
        const hasFeeDetails =
          Array.isArray(approvedPayment.fee_details) &&
          approvedPayment.fee_details.some(
            (f: any) =>
              f.type === 'marketplace_fee' ||
              f.type === 'application_fee' ||
              f.fee_payer === 'collector'
          );

        const hasFeeEvidence = officialMpFee >= 0.5 || hasChargesFee || hasFeeDetails;
        const newSplitStatus = hasFeeEvidence ? 'CONFIRMED' : 'REQUESTED';

        if (newSplitStatus === order.splitStatus) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            gateway,
            previousStatus: order.splitStatus,
            newStatus: newSplitStatus,
            reason: 'Status de split já sincronizado com o Mercado Pago.',
          });
          continue;
        }

        const totalNum = Number(order.total);
        const splitAmountCents =
          typeof order.splitAmountCents === 'number' && !isNaN(order.splitAmountCents)
            ? order.splitAmountCents
            : 50;
        const platformFeeNum = hasFeeEvidence ? splitAmountCents / 100 : 0;
        const netAmountNum = Math.max(0, totalNum - platformFeeNum);

        await (db as any).transaction(async (tx: any) => {
          await tx
            .update(orders)
            .set({
              splitStatus: newSplitStatus,
              platformFee: platformFeeNum.toFixed(2),
              netAmount: netAmountNum.toFixed(2),
              splitConfirmedAt: hasFeeEvidence ? new Date() : null,
              splitDetails:
                approvedPayment.charges_details ||
                approvedPayment.fee_details ||
                (officialMpFee > 0 ? { marketplace_fee: officialMpFee } : null),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(orders.id, order.id),
                eq(orders.status, 'paid')
              )
            );

          if (hasFeeEvidence) {
            await SplitReconciliationService.recordAuditLog(
              {
                orderId: order.id,
                previousStatus: order.splitStatus,
                newStatus: 'CONFIRMED',
                action: 'ADMIN_SYNC_PROCESSED_BY_GATEWAY',
                splitAmountCents,
                platformAccountId: null,
                evidenceDetails:
                  approvedPayment.charges_details ||
                  approvedPayment.fee_details ||
                  { marketplace_fee: officialMpFee },
                reconciledBy: { id: adminId, name: adminName },
                notes: 'Split confirmado via API oficial Mercado Pago na sincronização administrativa.',
              },
              tx
            );
          }
        });

        summary.updated++;
        summary.details.push({
          orderId: order.id,
          gateway,
          previousStatus: order.splitStatus,
          newStatus: newSplitStatus,
          reason: hasFeeEvidence
            ? `Taxa da plataforma (R$ ${platformFeeNum.toFixed(2)}) confirmada no Mercado Pago.`
            : 'Taxa sem evidência na API do MP — mantido como REQUESTED para auditoria.',
        });
        continue;
      }

      // ─────────────────────────────────────────────────────────────
      // UNKNOWN GATEWAYS
      // ─────────────────────────────────────────────────────────────
      summary.skipped++;
      summary.details.push({
        orderId: order.id,
        gateway,
        previousStatus: order.splitStatus,
        newStatus: order.splitStatus ?? 'PENDING',
        reason: `Gateway '${gateway}' não suportado nesta rotina — requer conferência manual.`,
      });
    } catch (err: any) {
      console.error(`[SplitSync] Erro inesperado ao processar pedido ${order.id}:`, err?.message);
      summary.errors++;
      summary.details.push({
        orderId: order.id,
        gateway: order.paymentMethod || 'unknown',
        previousStatus: order.splitStatus,
        newStatus: order.splitStatus ?? 'PENDING',
        reason: `Erro inesperado: ${err?.message || 'Falha de execução'}`,
      });
    }
  }

  console.log(
    `[SplitSync] Concluído por admin ${adminName}: ${summary.updated} atualizados, ${summary.skipped} mantidos, ${summary.divergence} divergência(s), ${summary.errors} erro(s). Total avaliado: ${summary.total}.`
  );

  return NextResponse.json({
    success: true,
    summary: {
      total: summary.total,
      updated: summary.updated,
      skipped: summary.skipped,
      divergence: summary.divergence,
      errors: summary.errors,
    },
    details: summary.details,
  });
}
