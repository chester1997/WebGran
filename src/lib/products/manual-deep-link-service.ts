import { OWNER_USER_ID } from "@/lib/bots/owner-guard";

export class ProductManualDeepLinkService {
  /**
   * Validates if the user role or immutable ID is authorized.
   * EXCLUSIVELY SUPER_ADMIN or the platform owner account (by immutable OWNER_USER_ID) is authorized.
   * Email correspondence with a different ID is strictly BLOCKED.
   * Boolean flags or client assertions (e.g. isOwner: true) are NEVER accepted as proof of identity.
   */
  static isAuthorized(
    role?: string | null,
    userOrId?: { id?: string; email?: string | null } | string | null
  ): boolean {
    if (role && role.trim().toUpperCase() === "SUPER_ADMIN") {
      return true;
    }
    const id = typeof userOrId === "string" ? userOrId : userOrId?.id;
    if (id && id === OWNER_USER_ID) {
      return true;
    }
    return false;
  }

  /**
   * Generates a manual product deep link if authorized.
   * Authorization requires either role === 'SUPER_ADMIN' or userId === OWNER_USER_ID.
   * Returns error response if unauthorized or parameters missing.
   */
  static generateDeepLink(params: {
    productId: string;
    botUsername?: string | null;
    shortName?: string | null;
    userRole?: string | null;
    userId?: string | null;
  }): { success: boolean; url?: string; error?: string } {
    if (!this.isAuthorized(params.userRole, params.userId)) {
      return {
        success: false,
        error: "Acesso negado. A geração manual de Deep Link é exclusiva para SUPER_ADMIN.",
      };
    }

    if (!params.botUsername) {
      return {
        success: false,
        error: "Conecte um bot do Telegram para gerar o Deep Link.",
      };
    }

    const cleanUsername = params.botUsername.replace(/^@/, "");
    const shortName = params.shortName || "shorts";
    const url = `https://t.me/${cleanUsername}/${shortName}?startapp=product_${params.productId}`;

    return {
      success: true,
      url,
    };
  }
}
