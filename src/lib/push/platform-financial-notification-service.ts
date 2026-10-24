import { db } from "@/db";
import { orders, stores, users, platformFinancialNotificationEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SellerPushService, PushSendResult } from "./seller-push-service";
import { getPlatformStoreId } from "../payments/providers/pushinpay";
import { buildPlatformCommissionPayload } from "./notification-payload-builder";

export type FinancialEventType =
  | "COMMISSION_CALCULATED"
  | "SPLIT_REQUESTED"
  | "SPLIT_PROCESSED"
  | "COMMISSION_CONFIRMED"
  | "COMMISSION_SETTLED";

export interface CommissionNotificationParams {
  orderId: string;
  eventType: FinancialEventType;
  platformFeeReais?: string | null;
  splitAmountCents?: number | null;
  metadata?: Record<string, any>;
}

export interface CommissionNotificationResult {
  success: boolean;
  skipped?: boolean;
  alreadySent?: boolean;
  reason?: string;
  ownerId?: string | null;
  pushResult?: PushSendResult;
}

// In-memory fast-path idempotency cache to prevent duplicate dispatches within runtime
const inMemoryDispatchedEvents = new Set<string>();
const inMemoryPendingDispatches = new Set<string>();

export class PlatformFinancialNotificationService {
  /**
   * Identifica o proprietário da plataforma de forma segura e confiável no backend.
   * Não confia em IDs fornecidos pelo cliente nem amplia permissões indiscriminadamente.
   *
   * Ordem de resolução:
   * 1. Variável explícita de ambiente PLATFORM_OWNER_USER_ID
   * 2. Variável explícita de ambiente PLATFORM_OWNER_EMAIL vinculada a users
   * 3. Proprietário da loja oficial configurada (PUSHINPAY_PLATFORM_STORE_ID / PLATFORM_STORE_ID)
   * 4. Fallback estrito: Se não houver env var, verifica se existe um único usuário com role='admin'
   */
  static async getPlatformOwnerId(): Promise<string | null> {
    // 1. ID explícito configurado
    const explicitUserId =
      process.env.PLATFORM_OWNER_USER_ID?.trim() ||
      process.env.WEBGRAN_OWNER_USER_ID?.trim() ||
      null;

    if (explicitUserId) {
      return explicitUserId;
    }

    // 2. E-mail explícito do proprietário
    const explicitEmail =
      process.env.PLATFORM_OWNER_EMAIL?.trim() ||
      process.env.WEBGRAN_OWNER_EMAIL?.trim() ||
      null;

    if (explicitEmail) {
      try {
        const ownerUser = await db.query.users.findFirst({
          where: eq(users.email, explicitEmail.toLowerCase()),
        });
        if (ownerUser?.id) {
          return ownerUser.id;
        }
      } catch (err) {
        console.warn("[PlatformFinancialNotification] Falha ao consultar proprietário por e-mail:", err);
      }
    }

    // 3. Proprietário da loja oficial da plataforma
    const officialStoreId = getPlatformStoreId();
    if (officialStoreId) {
      try {
        const officialStore = await db.query.stores.findFirst({
          where: eq(stores.id, officialStoreId),
        });
        if (officialStore?.ownerId) {
          return officialStore.ownerId;
        }
      } catch (err) {
        console.warn("[PlatformFinancialNotification] Falha ao consultar loja oficial da plataforma:", err);
      }
    }

    // 4. Fallback estrito: único administrador registrado no sistema
    try {
      if (typeof (db?.query?.users as any)?.findMany === "function") {
        const admins = await db.query.users.findMany({
          where: eq(users.role, "admin"),
          columns: { id: true },
        });
        if (admins.length === 1 && admins[0]?.id) {
          const singleAdminId = admins[0].id;
          console.info(
            `[PlatformFinancialNotification] Proprietário resolvido via administrador único da plataforma (${singleAdminId.slice(0, 8)}...). Recomenda-se configurar PLATFORM_OWNER_USER_ID na Vercel.`
          );
          return singleAdminId;
        }
      }
    } catch (adminErr) {
      console.warn("[PlatformFinancialNotification] Falha ao consultar administradores para fallback:", adminErr);
    }

    return null;
  }

  /**
   * Notifica exclusivamente o proprietário da plataforma sobre comissões comprovadas.
   * Distingue estritamente comissões previstas/solicitadas de comissões processadas/confirmadas/liquidadas.
   */
  static async notifyOwnerOfCommission(
    params: CommissionNotificationParams
  ): Promise<CommissionNotificationResult> {
    const { orderId, eventType, platformFeeReais, splitAmountCents } = params;

    // 1. Guarda de Estado: Comissão prevista ou split apenas solicitado NÃO gera notificação de recebimento
    if (eventType === "COMMISSION_CALCULATED" || eventType === "SPLIT_REQUESTED") {
      return {
        success: false,
        skipped: true,
        reason: "PREDICTED_OR_REQUESTED_COMMISSION_NOT_ELIGIBLE: Notificação restrita a eventos financeiros efetivamente comprovados.",
      };
    }

    // Apenas eventos comprovados são elegíveis
    if (
      eventType !== "SPLIT_PROCESSED" &&
      eventType !== "COMMISSION_CONFIRMED" &&
      eventType !== "COMMISSION_SETTLED"
    ) {
      return {
        success: false,
        skipped: true,
        reason: `UNSUPPORTED_FINANCIAL_EVENT: ${eventType}`,
      };
    }

    // 2. Guarda de Idempotência em Memória (Rápida)
    const idempotencyKey = `${orderId}:${eventType}`;
    if (inMemoryDispatchedEvents.has(idempotencyKey)) {
      return {
        success: true,
        skipped: true,
        alreadySent: true,
        reason: "IDEMPOTENT_ALREADY_SENT_IN_MEMORY",
      };
    }

    if (inMemoryPendingDispatches.has(idempotencyKey)) {
      return {
        success: true,
        skipped: true,
        reason: "DISPATCH_ALREADY_IN_PROGRESS",
      };
    }

    inMemoryPendingDispatches.add(idempotencyKey);

    try {
      // 3. Resolução confiável do proprietário da plataforma
      const ownerId = await this.getPlatformOwnerId();
      if (!ownerId) {
        console.warn(
          `[PlatformFinancialNotification] Notificação cancelada para pedido ${orderId}: Proprietário da plataforma não identificado. Configure PLATFORM_OWNER_USER_ID, PLATFORM_OWNER_EMAIL ou PUSHINPAY_PLATFORM_STORE_ID.`
        );
        return {
          success: false,
          skipped: true,
          ownerId: null,
          reason: "PLATFORM_OWNER_NOT_IDENTIFIED",
        };
      }

      // 4. Formatação precisa do valor da comissão (Backend como fonte única)
      let resolvedFeeCents = splitAmountCents ?? 50;
      if (platformFeeReais) {
        const parsedFee = parseFloat(platformFeeReais);
        if (!isNaN(parsedFee) && parsedFee >= 0) {
          resolvedFeeCents = Math.round(parsedFee * 100);
        }
      }

      // 5. Definição do payload padronizado e compatível com as evidências reais
      const pushPayload = buildPlatformCommissionPayload({
        orderId,
        feeReais: resolvedFeeCents / 100,
        eventType,
      });

      // 6. Guarda de Idempotência Prévia no Banco de Dados (Verifica se já foi entregue anteriormente)
      try {
        const existing = await db.query.platformFinancialNotificationEvents.findFirst({
          where: and(
            eq(platformFinancialNotificationEvents.orderId, orderId),
            eq(platformFinancialNotificationEvents.eventType, eventType)
          ),
        });

        if (existing) {
          inMemoryDispatchedEvents.add(idempotencyKey);
          return {
            success: true,
            skipped: true,
            alreadySent: true,
            ownerId,
            reason: "IDEMPOTENT_ALREADY_SENT_DATABASE",
          };
        }
      } catch (dbErr: any) {
        if (!dbErr?.message?.includes("platform_financial_notification_events") && dbErr?.code !== "42P01") {
          console.warn("[PlatformFinancialNotification] Aviso ao verificar idempotência no banco:", dbErr?.message);
        }
      }

      // 7. Envio do Web Push exclusivo ao proprietário da plataforma ANTES da marcação definitiva no banco
      const pushResult = await SellerPushService.sendToSeller(ownerId, pushPayload);

      // Diagnóstico detalhado por estado de envio
      if (pushResult.skipped) {
        console.warn(
          `[PlatformFinancialNotification] Notificação não enviada ao proprietário (${ownerId.slice(0, 8)}...): ${pushResult.reason || "Sem inscrições push ativas"}. Pedido: ${orderId}.`
        );
      } else if (pushResult.sentCount > 0) {
        console.info(
          `[PlatformFinancialNotification] Push aceito pelo gateway (${pushResult.sentCount} dispositivo(s)) para proprietário (${ownerId.slice(0, 8)}...). Pedido: ${orderId}.`
        );

        // 8. Persistência idempotente no banco SOMENTE após envio aceito com sucesso
        try {
          await db.insert(platformFinancialNotificationEvents).values({
            orderId,
            eventType,
            recipientUserId: ownerId,
            platformFee: (resolvedFeeCents / 100).toFixed(2),
            splitAmountCents: resolvedFeeCents,
            title: pushPayload.title,
            body: pushPayload.body,
            url: "/admin/commission",
          });
          inMemoryDispatchedEvents.add(idempotencyKey);
        } catch (insertErr: any) {
          if (insertErr?.code === "23505" || insertErr?.message?.includes("unique")) {
            inMemoryDispatchedEvents.add(idempotencyKey);
          } else if (!insertErr?.message?.includes("platform_financial_notification_events") && insertErr?.code !== "42P01") {
            console.warn("[PlatformFinancialNotification] Aviso de persistência idempotente pós-envio:", insertErr?.message);
          }
        }
      } else {
        console.error(
          `[PlatformFinancialNotification] Falha de entrega Push (${pushResult.failedCount} erro(s)). Notificação mantida elegível para retry no pedido ${orderId}.`
        );
      }

      return {
        success: pushResult.success,
        skipped: pushResult.skipped,
        ownerId,
        pushResult,
      };
    } catch (err: any) {
      console.error("[PlatformFinancialNotification] Erro não bloqueante ao despachar notificação:", err?.message);
      return {
        success: false,
        skipped: true,
        reason: err?.message || "Internal error",
      };
    } finally {
      inMemoryPendingDispatches.delete(idempotencyKey);
    }
  }
}
