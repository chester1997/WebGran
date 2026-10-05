import { db } from "@/db";
import {
  videoTriggers,
  productVideos,
  stores,
  telegramBots,
  accesses,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export type TriggerType = "PURCHASE" | "PUBLIC";

export interface CreateTriggerOptions {
  storeId: string;
  videoId: string;
  productId?: string | null;
  type?: TriggerType;
  expiresAt?: string | Date | null;
}

export function generateOpaqueTriggerToken(): string {
  // Generates an opaque random token starting with 'v_'
  const randomBytes = crypto.randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  return `v_${randomBytes.slice(0, 10)}`;
}

export class VideoTriggerService {
  /**
   * Resolves the Telegram bot username for a given store.
   */
  static async getStoreBotUsername(storeId: string): Promise<string> {
    const bot = await db.query.telegramBots.findFirst({
      where: and(eq(telegramBots.storeId, storeId), eq(telegramBots.status, "active")),
    });
    if (bot?.username) {
      return bot.username.replace(/^@/, "");
    }

    return (process.env.TELEGRAM_BOT_USERNAME || "WebGranBot").replace(/^@/, "");
  }

  /**
   * Generates a new Video Trigger (PUBLIC or PURCHASE).
   * Validates multi-tenant ownership, video status (READY only).
   */
  static async createTrigger(options: CreateTriggerOptions) {
    const { storeId, videoId, productId, type = "PUBLIC", expiresAt } = options;

    // 1. Multi-tenant Video Ownership Check
    const video = await db.query.productVideos.findFirst({
      where: and(eq(productVideos.id, videoId), eq(productVideos.storeId, storeId)),
    });

    if (!video) {
      throw new Error("Vídeo não encontrado ou não pertence a esta loja.");
    }

    // 2. Video Status Check: Only READY videos can generate triggers
    if (video.status !== "READY") {
      throw new Error("Somente vídeos no status PRONTO (READY) podem gerar Deep Links.");
    }

    // 3. Generate Opaque Random Token
    let token = generateOpaqueTriggerToken();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await db.query.videoTriggers.findFirst({
        where: eq(videoTriggers.token, token),
      });
      if (!existing) break;
      token = generateOpaqueTriggerToken();
      attempts++;
    }

    const botUsername = await this.getStoreBotUsername(storeId);

    // 4. Insert Video Trigger
    const [trigger] = await db
      .insert(videoTriggers)
      .values({
        token,
        storeId,
        productId: productId || video.productId || null,
        videoId,
        type,
        accessId: null,
        active: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    return {
      trigger,
      deepLink,
      botUsername,
    };
  }

  /**
   * Lists all triggers for a specific video in a store.
   */
  static async listTriggersForVideo(storeId: string, videoId: string) {
    const botUsername = await this.getStoreBotUsername(storeId);
    const triggers = await db.query.videoTriggers.findMany({
      where: and(eq(videoTriggers.storeId, storeId), eq(videoTriggers.videoId, videoId)),
      orderBy: [desc(videoTriggers.createdAt)],
    });

    return triggers.map((t) => ({
      ...t,
      deepLink: `https://t.me/${botUsername}?start=${t.token}`,
    }));
  }

  /**
   * Deactivates a trigger by ID (sets active = false).
   */
  static async deactivateTrigger(storeId: string, videoId: string, triggerId: string) {
    const trigger = await db.query.videoTriggers.findFirst({
      where: and(
        eq(videoTriggers.id, triggerId),
        eq(videoTriggers.videoId, videoId),
        eq(videoTriggers.storeId, storeId)
      ),
    });

    if (!trigger) {
      throw new Error("Deep Link de vídeo não encontrado ou sem permissão.");
    }

    const [updated] = await db
      .update(videoTriggers)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(videoTriggers.id, triggerId))
      .returning();

    return updated;
  }

  /**
   * Resolves and validates a trigger token for playback authorization.
   */
  static async resolveTriggerToken(token: string) {
    if (!token || typeof token !== "string" || !token.trim()) {
      throw new Error("Token de Deep Link inválido.");
    }

    const trigger = await db.query.videoTriggers.findFirst({
      where: eq(videoTriggers.token, token.trim()),
      with: {
        video: true,
        store: true,
        product: true,
      },
    });

    if (!trigger) {
      throw new Error("Link de vídeo não encontrado.");
    }

    if (!trigger.active) {
      throw new Error("Este link foi desativado pelo vendedor.");
    }

    if (trigger.expiresAt && new Date() > new Date(trigger.expiresAt)) {
      throw new Error("Este link expirou.");
    }

    if (!trigger.video || !trigger.video.active) {
      throw new Error("O vídeo associado a este link está indisponível.");
    }

    if (trigger.video.status !== "READY") {
      throw new Error("Este vídeo ainda está sendo processado.");
    }

    return {
      trigger,
      video: trigger.video,
      store: trigger.store,
      product: trigger.product,
      requiresAccess: trigger.type === "PURCHASE",
    };
  }
}
