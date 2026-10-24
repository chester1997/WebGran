import webpush from "web-push";
import { db } from "@/db";
import { sellerPushSubscriptions, orders, stores } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  standardizePushPayload,
  buildSaleNotificationPayload,
  buildAccessDeliveredPayload,
  buildPaymentPendingPayload,
  StandardPushPayload,
} from "./notification-payload-builder";

export type PushNotificationPayload = Partial<StandardPushPayload> & {
  title: string;
  body: string;
};

export interface PushSendResult {
  success: boolean;
  totalSubscriptions: number;
  sentCount: number;
  failedCount: number;
  deactivatedCount: number;
  skipped?: boolean;
  reason?: string;
}

let vapidConfigured = false;

function ensureVapidConfig(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@webgran.online";

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn("[SellerPushService] Erro ao configurar VAPID details:", err);
    return false;
  }
}

export class SellerPushService {
  /**
   * Retorna a chave pública VAPID configurada no ambiente.
   */
  static getPublicKey(): string | null {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
  }

  /**
   * Salva ou reativa a assinatura Push para o vendedor autenticado.
   * Evita duplicidade por endpoint e garante isolamento estrito por userId.
   */
  static async registerSubscription(params: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { userId, endpoint, p256dh, auth, userAgent } = params;

    if (!endpoint || !p256dh || !auth) {
      return { success: false, error: "Parâmetros de assinatura inválidos." };
    }

    try {
      // Upsert atômico por endpoint
      await db
        .insert(sellerPushSubscriptions)
        .values({
          userId,
          endpoint,
          p256dh,
          auth,
          userAgent: userAgent || null,
          isActive: true,
          failureCount: 0,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: sellerPushSubscriptions.endpoint,
          set: {
            userId, // Garante posse do endpoint para o usuário atual
            p256dh,
            auth,
            userAgent: userAgent || null,
            isActive: true,
            failureCount: 0,
            updatedAt: new Date(),
          },
        });

      return { success: true };
    } catch (err: any) {
      console.error("[SellerPushService] Erro ao salvar assinatura push:", err);
      // Se tabela não existir ainda no banco Neon (em fase pré-migração), trata com elegância
      if (err?.message?.includes("seller_push_subscriptions") || err?.code === "42P01") {
        return {
          success: false,
          error: "Tabela de assinaturas push ainda não migrada no banco de dados.",
        };
      }
      return { success: false, error: err?.message || "Falha ao registrar assinatura push." };
    }
  }

  /**
   * Desativa a assinatura Push do vendedor autenticado por endpoint.
   * Isolamento estrito: só pode desativar o endpoint se pertencer ao próprio userId.
   */
  static async unsubscribe(params: {
    userId: string;
    endpoint: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { userId, endpoint } = params;

    if (!endpoint) {
      return { success: false, error: "Endpoint não informado." };
    }

    try {
      await db
        .update(sellerPushSubscriptions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sellerPushSubscriptions.endpoint, endpoint),
            eq(sellerPushSubscriptions.userId, userId)
          )
        );

      return { success: true };
    } catch (err: any) {
      console.error("[SellerPushService] Erro ao desativar assinatura push:", err);
      return { success: false, error: err?.message || "Falha ao desativar assinatura push." };
    }
  }

  /**
   * Verifica se o vendedor possui pelo menos uma assinatura push ativa.
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const activeSub = await db.query.sellerPushSubscriptions.findFirst({
        where: and(
          eq(sellerPushSubscriptions.userId, userId),
          eq(sellerPushSubscriptions.isActive, true)
        ),
      });
      return !!activeSub;
    } catch (err) {
      // Falha defensiva em caso de tabela ausente
      return false;
    }
  }

  /**
   * Envia uma notificação push para todos os dispositivos ativos do vendedor.
   * Trata assinaturas expiradas (410/404) desativando-as automaticamente.
   */
  static async sendToSeller(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<PushSendResult> {
    if (!ensureVapidConfig()) {
      return {
        success: false,
        skipped: true,
        reason: "VAPID keys not configured in environment.",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      };
    }

    let subscriptions: any[] = [];
    try {
      subscriptions = await db.query.sellerPushSubscriptions.findMany({
        where: and(
          eq(sellerPushSubscriptions.userId, userId),
          eq(sellerPushSubscriptions.isActive, true)
        ),
      });
    } catch (err: any) {
      console.warn("[SellerPushService] Erro ao consultar assinaturas:", err?.message);
      return {
        success: false,
        skipped: true,
        reason: "Subscriptions table not accessible.",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: "Seller has no active push subscriptions.",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      };
    }

    const standardized = standardizePushPayload(payload);
    const payloadString = JSON.stringify(standardized);

    let sentCount = 0;
    let failedCount = 0;
    let deactivatedCount = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payloadString);
          sentCount++;

          // Atualiza status de sucesso
          await db
            .update(sellerPushSubscriptions)
            .set({
              lastSuccessAt: new Date(),
              failureCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(sellerPushSubscriptions.id, sub.id))
            .catch(() => {});
        } catch (err: any) {
          failedCount++;
          const statusCode = err?.statusCode;

          // Se a assinatura expirou ou foi cancelada no navegador (410 Gone ou 404 Not Found)
          if (statusCode === 410 || statusCode === 404) {
            deactivatedCount++;
            await db
              .update(sellerPushSubscriptions)
              .set({
                isActive: false,
                lastFailureAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(sellerPushSubscriptions.id, sub.id))
              .catch(() => {});
          } else {
            // Outro erro transitório
            await db
              .update(sellerPushSubscriptions)
              .set({
                failureCount: sql`${sellerPushSubscriptions.failureCount} + 1`,
                lastFailureAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(sellerPushSubscriptions.id, sub.id))
              .catch(() => {});
          }
        }
      })
    );

    return {
      success: sentCount > 0,
      totalSubscriptions: subscriptions.length,
      sentCount,
      failedCount,
      deactivatedCount,
    };
  }

  // Cache em memória para idempotência de disparos de venda por pedido
  private static dispatchedSaleOrders = new Set<string>();

  /**
   * Limpa o cache de idempotência de vendas (apenas para testes automatizados).
   */
  static _clearDispatchedSaleOrdersForTest(): void {
    this.dispatchedSaleOrders.clear();
  }

  /**
   * Integração com evento de venda confirmada:
   * Localiza a loja, o vendedor (proprietário) e envia push seguro
   * com o valor real da venda no padrão Sharkbot: "Você recebeu R$ XX,XX".
   */
  static async notifySellerOfSale(orderId: string): Promise<PushSendResult> {
    try {
      // 1. Guarda de Idempotência em memória contra disparos duplicados
      if (this.dispatchedSaleOrders.has(orderId)) {
        return {
          success: true,
          skipped: true,
          reason: `Push notification already sent for order ${orderId}`,
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
          items: true,
        },
      });

      if (!order || order.status !== "paid") {
        return {
          success: false,
          skipped: true,
          reason: "Order not found or not paid.",
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const store = await db.query.stores.findFirst({
        where: eq(stores.id, order.storeId),
      });

      if (!store || !store.ownerId) {
        return {
          success: false,
          skipped: true,
          reason: "Store or store owner not found.",
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const items = order.items || [];
      let itemTitle = "Produto";
      if (items.length > 0 && items[0].productId) {
        const { products } = await import("@/db/schema");
        const prod = await db.query.products.findFirst({
          where: eq(products.id, items[0].productId),
        });
        if (prod?.title) {
          itemTitle = prod.title;
        }
      }

      // Valor real do pedido
      const rawNum = typeof order.total === "string" ? parseFloat(order.total) : Number(order.total || 0);

      // Dispara a notificação padronizada para o vendedor dono da loja
      const payload = buildSaleNotificationPayload({
        orderId: order.id,
        amount: rawNum,
        itemTitle,
        storeId: store.id,
      });

      const result = await this.sendToSeller(store.ownerId, payload);

      if (result.success) {
        this.dispatchedSaleOrders.add(orderId);
      }

      return result;
    } catch (err: any) {
      console.error("[SellerPushService] Erro ao enviar notificação de venda:", err);
      return {
        success: false,
        skipped: true,
        reason: err?.message || "Internal error",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      };
    }
  }

  /**
   * Notificação de Liberação de Acesso / Entrega para o vendedor.
   * Isolamento estrito por loja e proprietário.
   */
  static async notifySellerOfAccessDelivery(params: {
    orderId: string;
    itemTitle?: string;
  }): Promise<PushSendResult> {
    const { orderId, itemTitle = "Produto" } = params;

    try {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });

      if (!order) {
        return {
          success: false,
          skipped: true,
          reason: "Order not found.",
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const store = await db.query.stores.findFirst({
        where: eq(stores.id, order.storeId),
      });

      if (!store || !store.ownerId) {
        return {
          success: false,
          skipped: true,
          reason: "Store or store owner not found.",
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const payload = buildAccessDeliveredPayload({
        orderId,
        itemTitle,
        storeId: store.id,
      });

      return await this.sendToSeller(store.ownerId, payload);
    } catch (err: any) {
      console.error("[SellerPushService] Erro ao enviar notificação de entrega:", err);
      return {
        success: false,
        skipped: true,
        reason: err?.message || "Internal error",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      };
    }
  }

  /**
   * Notificação de Pix Gerado / Pagamento Pendente para o vendedor.
   * Isolamento estrito por loja e proprietário.
   */
  static async notifySellerOfPendingPayment(params: {
    orderId: string;
    amount: number | string;
  }): Promise<PushSendResult> {
    const { orderId, amount } = params;

    try {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });

      if (!order) {
        return {
          success: false,
          skipped: true,
          reason: "Order not found.",
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const store = await db.query.stores.findFirst({
        where: eq(stores.id, order.storeId),
      });

      if (!store || !store.ownerId) {
        return {
          success: false,
          skipped: true,
          reason: "Store or store owner not found.",
          totalSubscriptions: 0,
          sentCount: 0,
          failedCount: 0,
          deactivatedCount: 0,
        };
      }

      const payload = buildPaymentPendingPayload({
        orderId,
        amount,
        storeId: store.id,
      });

      return await this.sendToSeller(store.ownerId, payload);
    } catch (err: any) {
      console.error("[SellerPushService] Erro ao enviar notificação de pagamento pendente:", err);
      return {
        success: false,
        skipped: true,
        reason: err?.message || "Internal error",
        totalSubscriptions: 0,
        sentCount: 0,
        failedCount: 0,
        deactivatedCount: 0,
      };
    }
  }
}

