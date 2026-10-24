import { db } from "@/db";
import { orders, stores, users, platformFinancialNotificationEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SellerPushService, PushSendResult } from "./seller-push-service";
import { getPlatformStoreId } from "../payments/providers/pushinpay";

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

export class PlatformFinancialNotificationService {
  /**
   * Identifica o proprietário da plataforma de forma segura e confiável no backend.
   * Não confia em role=admin genérica nem em IDs fornecidos pelo cliente.
   *
   * Ordem de resolução:
   * 1. Variável explícita de ambiente PLATFORM_OWNER_USER_ID
   * 2. Variável explícita de ambiente PLATFORM_OWNER_EMAIL vinculada a users
   * 3. Proprietário da loja oficial configurada (PUSHINPAY_PLATFORM_STORE_ID / PLATFORM_STORE_ID)
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

      const formattedFee = (resolvedFeeCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      // 5. Definição do texto compatível com as evidências reais
      let title = "Split processado";
      let body = `O WebGran registrou ${formattedFee} de comissão.`;

      if (eventType === "COMMISSION_CONFIRMED") {
        title = "Comissão confirmada!";
        body = `O WebGran registrou ${formattedFee} de comissão.`;
      } else if (eventType === "COMMISSION_SETTLED") {
        title = "Comissão liquidada!";
        body = `Comissão de ${formattedFee} liquidada na conta bancária.`;
      }

      // 6. Guarda de Idempotência Persistente no Banco de Dados
      let isDuplicate = false;
      try {
        const existing = await db.query.platformFinancialNotificationEvents.findFirst({
          where: and(
            eq(platformFinancialNotificationEvents.orderId, orderId),
            eq(platformFinancialNotificationEvents.eventType, eventType)
          ),
        });

        if (existing) {
          isDuplicate = true;
        } else {
          await db.insert(platformFinancialNotificationEvents).values({
            orderId,
            eventType,
            recipientUserId: ownerId,
            platformFee: (resolvedFeeCents / 100).toFixed(2),
            splitAmountCents: resolvedFeeCents,
            title,
            body,
            url: "/admin/commission",
          });
        }
      } catch (dbErr: any) {
        // Se a tabela ainda não tiver sido migrada no Neon, ignora sem quebrar
        if (dbErr?.message?.includes("platform_financial_notification_events") || dbErr?.code === "42P01") {
          // Fallback gracioso mantendo idempotência em memória
        } else if (dbErr?.code === "23505" || dbErr?.message?.includes("unique")) {
          // Violação de constraint de unicidade (concorrência): considera duplicado
          isDuplicate = true;
        } else {
          console.warn("[PlatformFinancialNotification] Aviso de persistência idempotente:", dbErr?.message);
        }
      }

      if (isDuplicate) {
        inMemoryDispatchedEvents.add(idempotencyKey);
        return {
          success: true,
          skipped: true,
          alreadySent: true,
          ownerId,
          reason: "IDEMPOTENT_ALREADY_SENT_DATABASE",
        };
      }

      // Marca em memória após registrar no banco
      inMemoryDispatchedEvents.add(idempotencyKey);

      // 7. Envio do Web Push exclusivo ao proprietário da plataforma
      const pushResult = await SellerPushService.sendToSeller(ownerId, {
        title,
        body,
        url: "/admin/commission",
        tag: `commission-${orderId}-${eventType.toLowerCase()}`,
        data: {
          orderId,
          eventType,
          platformFeeCents: resolvedFeeCents,
          url: "/admin/commission",
        },
      });

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
    }
  }
}
