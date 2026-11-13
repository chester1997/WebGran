import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

export interface AuthUserIdentity {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export class ProductManualDeepLinkService {
  /**
   * Função única de autorização da conta proprietária e SUPER_ADMIN.
   * Regra Central:
   * 1. SUPER_ADMIN explícito: autorizado (role?.trim().toUpperCase() === "SUPER_ADMIN").
   * 2. ID correspondente exatamente a OWNER_USER_ID: autorizado.
   * 3. Role "admin" E email autenticado correspondente exatamente a OWNER_EMAIL (normalizado): autorizado.
   *
   * Bloqueios Estritos:
   * - Outros administradores (role "admin" com outro e-mail e outro ID): BLOQUEADO.
   * - Vendedores (role "seller" ou qualquer papel não-admin, mesmo se email coincidir): BLOQUEADO.
   * - E-mail isolado sem role "admin": BLOQUEADO.
   * - Booleanos ou valores arbitrários enviados pelo cliente: BLOQUEADO.
   */
  static isAuthorized(
    role?: string | null,
    userOrId?: AuthUserIdentity | string | null
  ): boolean {
    const normalizedRole = (role || "").trim().toLowerCase();
    if (normalizedRole === "super_admin") {
      return true;
    }

    if (typeof userOrId === "string") {
      return userOrId === OWNER_USER_ID;
    }

    if (userOrId && typeof userOrId === "object") {
      // 1. Correspondência exata pelo ID imutável do proprietário
      if (userOrId.id && userOrId.id === OWNER_USER_ID) {
        return true;
      }

      // 2. Perfil "admin" E e-mail autenticado correspondente a OWNER_EMAIL (com trim e lowercase)
      const effectiveRole = (userOrId.role || role || "").trim().toLowerCase();
      const normalizedEmail = (userOrId.email || "").trim().toLowerCase();
      const normalizedOwnerEmail = OWNER_EMAIL.trim().toLowerCase();

      if (effectiveRole === "admin" && normalizedEmail !== "" && normalizedEmail === normalizedOwnerEmail) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generates a manual product deep link if authorized.
   * Authorization requires either role === 'SUPER_ADMIN' or the platform owner account.
   * Validated exclusively via server-side identity.
   */
  static generateDeepLink(params: {
    productId: string;
    botUsername?: string | null;
    shortName?: string | null;
    userRole?: string | null;
    userId?: string | null;
    user?: AuthUserIdentity | null;
  }): { success: boolean; url?: string; error?: string } {
    const userTarget = params.user || params.userId;
    if (!this.isAuthorized(params.userRole, userTarget)) {
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
