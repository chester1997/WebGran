import { db } from "@/db";
import { products, productBotVisibility, telegramBots, telegramBotChats, productCarousels, carouselProducts } from "@/db/schema";
import { eq, and, inArray, asc, desc } from "drizzle-orm";

export type CatalogScope = "STORE_GENERAL" | "BOT_GENERAL" | "BOT_SPECIFIC";
export type SharingMode = "EXCLUSIVE" | "ALL_EXISTING" | "CUSTOM";

export interface SyncVisibilityParams {
  storeId: string;
  productId: string;
  botId: string | null;
  catalogScope: CatalogScope;
  sharingMode: SharingMode;
  targetBotIds?: string[];
  deliveryType?: string | null;
  deliveryValue?: string | null;
}

export class ProductVisibilityService {
  /**
   * Avalia deterministicamente a capacidade de entrega de um bot para um produto específico.
   * Regras:
   * 1. Entrega por Link externo ou Vídeo liberado no Mini App: Qualquer bot ativo tem can_deliver = true.
   * 2. Entrega por Canal/Grupo Telegram (chatId numérico):
   *    - Exige que o bot possua registro ativo em telegramBotChats como 'administrator' ou 'creator' com canInviteUsers = true.
   *    - Se não possuir, can_deliver = false e deliveryBlockReason indica a ausência de permissões.
   */
  static async checkBotDeliveryCapability(
    tx: any,
    storeId: string,
    targetBotId: string,
    deliveryType?: string | null,
    deliveryValue?: string | null
  ): Promise<{ canDeliver: boolean; deliveryBlockReason: string | null }> {
    const isDynamicTelegramDelivery =
      (deliveryType === "telegram" || deliveryType === "TELEGRAM_CHAT") &&
      deliveryValue &&
      !String(deliveryValue).trim().startsWith("http://") &&
      !String(deliveryValue).trim().startsWith("https://");

    if (!isDynamicTelegramDelivery) {
      return { canDeliver: true, deliveryBlockReason: null };
    }

    const targetChatId = String(deliveryValue).trim();
    const chatMapping = await tx.query.telegramBotChats.findFirst({
      where: and(
        eq(telegramBotChats.storeId, storeId),
        eq(telegramBotChats.botId, targetBotId),
        eq(telegramBotChats.telegramChatId, targetChatId),
        eq(telegramBotChats.isActive, true)
      ),
    });

    const hasPermission =
      chatMapping &&
      (chatMapping.botStatus === "administrator" || chatMapping.botStatus === "creator") &&
      chatMapping.canInviteUsers === true;

    if (hasPermission) {
      return { canDeliver: true, deliveryBlockReason: null };
    }

    return {
      canDeliver: false,
      deliveryBlockReason: "Bot não possui permissão de administrador para convidar usuários no canal/grupo do Telegram.",
    };
  }

  /**
   * Sincroniza a visibilidade de um produto no banco de dados de acordo com seu escopo e modalidade de compartilhamento.
   * Executa dentro de transação para garantir atomicidade.
   *
   * Regras:
   * 1. STORE_GENERAL: Nenhum vínculo com bot. Limpa product_bot_visibility deste produto.
   * 2. BOT_GENERAL: Compartilhado com todos os bots existentes na loja no momento da ativação (snapshot transacional).
   * 3. BOT_SPECIFIC:
   *    - Bot proprietário recebe is_owner = true se selecionado.
   *    - EXCLUSIVE: Apenas o bot proprietário tem visibilidade.
   *    - ALL_EXISTING: Todos os demais bots da loja existentes no momento recebem is_owner = false.
   *    - CUSTOM: Apenas os bots explicitamente selecionados em targetBotIds recebem is_owner = false.
   *    - can_deliver e delivery_block_reason são avaliados bot a bot com base na modalidade de entrega.
   */
  static async syncProductVisibility(
    tx: any,
    params: SyncVisibilityParams
  ): Promise<void> {
    const { storeId, productId, botId, catalogScope, sharingMode, targetBotIds = [] } = params;

    // 1. Limpar visibilidades anteriores do produto nesta loja
    await tx
      .delete(productBotVisibility)
      .where(
        and(
          eq(productBotVisibility.storeId, storeId),
          eq(productBotVisibility.productId, productId)
        )
      );

    // 2. Se for STORE_GENERAL, não cria visibilidade em bots
    if (catalogScope === "STORE_GENERAL") {
      return;
    }

    // Obter dados de entrega do produto se não fornecidos nos parâmetros
    let dType = params.deliveryType;
    let dValue = params.deliveryValue;
    if ((dType === undefined || dValue === undefined) && tx.query?.products?.findFirst) {
      const prod = await tx.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.storeId, storeId)),
        columns: { deliveryType: true, deliveryValue: true },
      });
      dType = prod?.deliveryType;
      dValue = prod?.deliveryValue;
    }

    // 3. Se for BOT_GENERAL: snapshot de todos os bots ativos existentes no momento
    if (catalogScope === "BOT_GENERAL") {
      const activeBots = await tx.query.telegramBots.findMany({
        where: and(
          eq(telegramBots.storeId, storeId),
          eq(telegramBots.status, "active")
        ),
      });

      if (activeBots.length > 0) {
        const rows = await Promise.all(
          activeBots.map(async (b: any) => {
            const cap = await ProductVisibilityService.checkBotDeliveryCapability(
              tx,
              storeId,
              b.id,
              dType,
              dValue
            );
            return {
              storeId,
              productId,
              botId: b.id,
              isOwner: botId ? b.id === botId : false,
              canDeliver: cap.canDeliver,
              deliveryBlockReason: cap.deliveryBlockReason,
            };
          })
        );
        await tx.insert(productBotVisibility).values(rows);
      }
      return;
    }

    // 4. Se for BOT_SPECIFIC: exige bot proprietário
    if (catalogScope === "BOT_SPECIFIC") {
      if (!botId) {
        throw new Error("Um produto do escopo BOT_SPECIFIC deve obrigatoriamente possuir um bot proprietário.");
      }

      // Validar que o bot proprietário pertence à loja
      const ownerBot = await tx.query.telegramBots.findFirst({
        where: and(
          eq(telegramBots.id, botId),
          eq(telegramBots.storeId, storeId)
        ),
      });

      if (!ownerBot) {
        throw new Error("Violação multi-tenant: O bot proprietário não pertence à loja especificada.");
      }

      const recordsToInsert: Array<{
        storeId: string;
        productId: string;
        botId: string;
        isOwner: boolean;
        canDeliver: boolean;
        deliveryBlockReason: string | null;
      }> = [];

      // O bot proprietário recebe is_owner = true se selecionado (ou se for EXCLUSIVE / ALL_EXISTING)
      const includeOwner = sharingMode !== "CUSTOM" || targetBotIds.includes(botId);
      if (includeOwner) {
        const ownerCap = await ProductVisibilityService.checkBotDeliveryCapability(
          tx,
          storeId,
          botId,
          dType,
          dValue
        );
        recordsToInsert.push({
          storeId,
          productId,
          botId,
          isOwner: true,
          canDeliver: ownerCap.canDeliver,
          deliveryBlockReason: ownerCap.deliveryBlockReason,
        });
      }

      if (sharingMode === "ALL_EXISTING") {
        // Snapshot dos outros bots ativos da loja no momento da ativação
        const otherBots = await tx.query.telegramBots.findMany({
          where: and(
            eq(telegramBots.storeId, storeId),
            eq(telegramBots.status, "active")
          ),
        });

        for (const b of otherBots) {
          if (b.id !== botId) {
            const cap = await ProductVisibilityService.checkBotDeliveryCapability(
              tx,
              storeId,
              b.id,
              dType,
              dValue
            );
            recordsToInsert.push({
              storeId,
              productId,
              botId: b.id,
              isOwner: false,
              canDeliver: cap.canDeliver,
              deliveryBlockReason: cap.deliveryBlockReason,
            });
          }
        }
      } else if (sharingMode === "CUSTOM" && targetBotIds.length > 0) {
        // Validar que todos os targetBotIds pertencem à mesma loja
        const validOtherBots = await tx.query.telegramBots.findMany({
          where: and(
            eq(telegramBots.storeId, storeId),
            eq(telegramBots.status, "active"),
            inArray(telegramBots.id, targetBotIds)
          ),
        });

        for (const b of validOtherBots) {
          if (b.id !== botId) {
            const cap = await ProductVisibilityService.checkBotDeliveryCapability(
              tx,
              storeId,
              b.id,
              dType,
              dValue
            );
            recordsToInsert.push({
              storeId,
              productId,
              botId: b.id,
              isOwner: false,
              canDeliver: cap.canDeliver,
              deliveryBlockReason: cap.deliveryBlockReason,
            });
          }
        }
      }

      if (recordsToInsert.length > 0) {
        await tx.insert(productBotVisibility).values(recordsToInsert);
      }
    }
  }
}

export class CatalogResolverService {
  /**
   * Resolve os IDs dos produtos autorizados para visualização no catálogo:
   * - Se botId for fornecido (Mini App do Telegram): produtos com visibilidade ativa para o bot.
   * - Se botId for nulo (Loja Geral / Web): produtos do escopo STORE_GENERAL.
   */
  static async getVisibleProductIds(
    storeId: string,
    botId?: string | null
  ): Promise<string[]> {
    if (botId) {
      const visibilities = await db.query.productBotVisibility.findMany({
        where: and(
          eq(productBotVisibility.storeId, storeId),
          eq(productBotVisibility.botId, botId)
        ),
        columns: { productId: true },
      });
      return visibilities.map((v) => v.productId);
    }

    // Vitrine Web Geral (sem contexto de bot)
    const storeGeneralProducts = await db.query.products.findMany({
      where: and(
        eq(products.storeId, storeId),
        eq(products.catalogScope, "STORE_GENERAL"),
        eq(products.status, "active")
      ),
      columns: { id: true },
    });
    return storeGeneralProducts.map((p) => p.id);
  }

  /**
   * Verifica de forma otimizada se um produto específico está visível para o contexto informado.
   */
  static async isProductVisible(
    productId: string,
    storeId: string,
    botId?: string | null
  ): Promise<boolean> {
    if (botId) {
      const vis = await db.query.productBotVisibility.findFirst({
        where: and(
          eq(productBotVisibility.storeId, storeId),
          eq(productBotVisibility.productId, productId),
          eq(productBotVisibility.botId, botId)
        ),
      });
      return !!vis;
    }

    // Vitrine Web Geral: somente STORE_GENERAL ativo
    const prod = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.storeId, storeId),
        eq(products.catalogScope, "STORE_GENERAL"),
        eq(products.status, "active")
      ),
    });
    return !!prod;
  }
}

