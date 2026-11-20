/**
 * Checkout dos planos do Fluxo Básico. Sem produto: gera o pedido (tabela "orders",
 * para Pix, split e Financeiro continuarem iguais) e a compra do plano em "flow_purchases",
 * com o valor, o tempo e o destino da entrega (grupo/canal ou link).
 *
 * Fica separado do CheckoutService do Mini App para não mexer no fluxo dos lojistas atuais.
 */
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { flowPurchases, orders, stores } from "@/db/schema";
import { paymentService } from "@/lib/payments/payment-service";
import { SellerGatewayControlService } from "@/lib/payments/seller-gateway-control-service";
import type { FlowPlan } from "./basic-config";

export interface PlanCheckoutInput {
  storeId: string;
  customerId: string;
  botDbId: string;
  flowId: string;
  plan: FlowPlan;
  delivery: { type: "group" | "link"; value: string };
}

export interface PlanCheckoutResult {
  success: boolean;
  error?: string;
  orderId?: string;
  total?: number;
  pix?: { qrCode: string; qrCodeBase64: string; expiresAt: string };
}

/** Postgres 42P01: a tabela flow_purchases ainda não existe (migration 0025 não rodou). */
function isMissingTable(err: unknown) {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code;
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`;
  return code === "42P01" || /relation .*flow_purchases.* does not exist/i.test(msg);
}

export async function createPlanCheckout(input: PlanCheckoutInput): Promise<PlanCheckoutResult> {
  const { storeId, customerId, botDbId, flowId, plan, delivery } = input;
  try {
    if (!storeId || !customerId) return { success: false, error: "Cliente não identificado." };
    const total = Math.round(Number(plan.price) * 100) / 100;
    if (!plan.name.trim() || !(total >= 1)) return { success: false, error: "Esse plano não está disponível." };
    if (!delivery.value) return { success: false, error: "Esse plano ainda não tem entrega configurada." };

    const { CustomerBlockService, BLOCKED_CUSTOMER_MESSAGE } = await import("@/lib/customers/customer-block-service");
    if (await CustomerBlockService.isCustomerIdBlocked(storeId, customerId)) return { success: false, error: BLOCKED_CUSTOMER_MESSAGE };

    const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
    if (!store?.ownerId) return { success: false, error: "Loja não encontrada." };
    const sellerId = store.ownerId;

    // Reaproveita um Pix ainda válido do mesmo plano (cliente tocou duas vezes).
    const reuse = await db
      .select({ id: orders.id, total: orders.total, qr: orders.pixQrCode, qr64: orders.pixQrCodeBase64, exp: orders.pixExpiresAt })
      .from(flowPurchases)
      .innerJoin(orders, eq(orders.id, flowPurchases.orderId))
      .where(
        and(
          eq(flowPurchases.storeId, storeId),
          eq(flowPurchases.customerId, customerId),
          eq(flowPurchases.flowId, flowId),
          eq(flowPurchases.planId, plan.id),
          eq(orders.status, "pending"),
          eq(orders.total, total.toFixed(2)),
          gt(orders.pixExpiresAt, new Date())
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);
    if (reuse[0]?.qr) {
      const r = reuse[0];
      return { success: true, orderId: r.id, total, pix: { qrCode: r.qr || "", qrCodeBase64: r.qr64 || "", expiresAt: (r.exp || new Date()).toISOString() } };
    }

    // Comissão da plataforma congelada no pedido (igual ao checkout do Mini App).
    const { SellerCommissionService } = await import("@/lib/commission/seller-commission-service");
    const fee = await SellerCommissionService.resolveEffectiveFee(sellerId, new Date());
    const splitAmountCents = fee.effectiveFeeCents;
    let splitStatus = "PENDING";
    let splitError: string | null = null;
    if (fee.isExempt) {
      splitStatus = "SKIPPED";
      splitError = "ISENCAO_TEMPORARIA";
    } else if (splitAmountCents === 0) {
      splitStatus = "SKIPPED";
      splitError = "COMISSAO_ZERO";
    }

    // Gateway: mesma prioridade do checkout (PushinPay, depois Mercado Pago).
    const pushinConn = await paymentService["pushinPayProvider"].getPushinPayConnection(sellerId, storeId);
    const mpConn = await paymentService.getSellerConnection(sellerId);
    const pushinAllowed = await SellerGatewayControlService.isPaymentAllowed("pushinpay");
    const mpAllowed = await SellerGatewayControlService.isPaymentAllowed("mercadopago");
    const gateway = pushinConn && pushinAllowed ? "pushinpay" : mpConn && mpAllowed ? "mercadopago" : null;
    if (!gateway) {
      return {
        success: false,
        error: (pushinConn && !pushinAllowed) || (mpConn && !mpAllowed)
          ? "O processamento de novos pagamentos está temporariamente suspenso pela administração da plataforma."
          : "Esta loja não possui nenhum meio de pagamento ativo configurado no momento.",
      };
    }

    const [order] = await db
      .insert(orders)
      .values({
        storeId,
        customerId,
        status: "pending",
        subtotal: total.toFixed(2),
        discount: "0",
        total: total.toFixed(2),
        currency: "BRL",
        originBotId: botDbId,
        ownerBotId: botDbId,
        deliveryMode: delivery.type === "group" ? "BOT_PERMISSION" : "LINK",
        splitAmountCents,
        splitStatus,
        splitError,
      })
      .returning({ id: orders.id });

    try {
      await db.insert(flowPurchases).values({
        storeId,
        orderId: order.id,
        customerId,
        flowId,
        botId: botDbId,
        planId: plan.id,
        planName: plan.name.trim().slice(0, 120),
        price: total.toFixed(2),
        periodUnit: plan.unit,
        periodAmount: Math.max(1, Math.round(plan.amount)),
        deliveryType: delivery.type,
        deliveryValue: delivery.value,
      });
    } catch (err) {
      await db.update(orders).set({ status: "failed" }).where(eq(orders.id, order.id));
      if (isMissingTable(err)) return { success: false, error: "As vendas pelo fluxo ainda não foram ativadas nesta loja." };
      throw err;
    }

    const description = `Pedido #${order.id.slice(0, 8)} - ${store.name || "WebGran"}`;
    const customer = { name: "Cliente Telegram", email: "cliente@webgran.app" };
    const pix =
      gateway === "pushinpay"
        ? await paymentService.createPushinPayPix({ sellerId, storeId, orderId: order.id, amount: total, description, customer })
        : await paymentService.createPixPayment({ sellerId, orderId: order.id, amount: total, splitAmountCents, description, customer });

    await db
      .update(orders)
      .set({
        paymentId: pix.paymentId,
        paymentMethod: gateway,
        pixQrCode: pix.qrCode,
        pixQrCodeBase64: pix.qrCodeBase64 || "",
        pixExpiresAt: pix.expiresAt,
      })
      .where(eq(orders.id, order.id));

    return { success: true, orderId: order.id, total, pix: { qrCode: pix.qrCode, qrCodeBase64: pix.qrCodeBase64 || "", expiresAt: pix.expiresAt.toISOString() } };
  } catch (err) {
    if (isMissingTable(err)) return { success: false, error: "As vendas pelo fluxo ainda não foram ativadas nesta loja." };
    console.error("[flow-checkout] Falha ao gerar o Pix do plano:", (err as Error)?.message);
    return { success: false, error: "Não foi possível gerar o Pix agora. Tente de novo em instantes." };
  }
}
