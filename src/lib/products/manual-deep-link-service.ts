export class ProductManualDeepLinkService {
  /**
   * Validates if the user role is authorized to generate manual deep links.
   * EXCLUSIVELY SUPER_ADMIN is authorized.
   */
  static isAuthorized(role?: string | null): boolean {
    if (!role) return false;
    return role.trim().toUpperCase() === "SUPER_ADMIN";
  }

  /**
   * Generates a manual product deep link if authorized.
   * Returns error response if unauthorized or parameters missing.
   */
  static generateDeepLink(params: {
    productId: string;
    botUsername?: string | null;
    shortName?: string | null;
    userRole?: string | null;
  }): { success: boolean; url?: string; error?: string } {
    if (!this.isAuthorized(params.userRole)) {
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
