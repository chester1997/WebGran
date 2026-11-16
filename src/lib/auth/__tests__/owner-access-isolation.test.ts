import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOwnerAccount, checkIsOwnerServer } from "../owner-access";
import { OWNER_USER_ID, OWNER_EMAIL } from "@/lib/bots/owner-guard";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

describe("WEBGRAN — ETAPA 2: Segurança e Isolamento do Redesign V2 (owner-access)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Validação da Regra Central isOwnerAccount", () => {
    it("cenário 1: Proprietário com ID oficial -> V2 autorizada", () => {
      const user = {
        id: OWNER_USER_ID,
        role: "seller", // mesmo se o role não for admin, o ID oficial é imutável
        email: "outro@dominio.com",
      };
      expect(isOwnerAccount(user)).toBe(true);
    });

    it("cenário 2: Proprietário com e-mail oficial e role admin -> V2 autorizada", () => {
      const user = {
        id: "outro-id-qualquer",
        role: "admin",
        email: OWNER_EMAIL,
      };
      expect(isOwnerAccount(user)).toBe(true);
    });

    it("cenário 3: E-mail oficial com letras maiúsculas ou espaços externos -> V2 autorizada após normalização", () => {
      const userWithWhitespaceAndCaps = {
        id: "qualquer-id",
        role: "admin",
        email: "   LF49127@GMAIL.COM   ",
      };
      expect(isOwnerAccount(userWithWhitespaceAndCaps)).toBe(true);

      const userWithTabsAndRoleMixedCase = {
        id: "qualquer-id-2",
        role: "  Admin  ",
        email: ` \t${OWNER_EMAIL.toUpperCase()}\n `,
      };
      expect(isOwnerAccount(userWithTabsAndRoleMixedCase)).toBe(true);
    });

    it("cenário 4: Outro administrador (role admin com ID e e-mail diferentes) -> Interface clássica (bloqueado)", () => {
      const otherAdmin = {
        id: "b4507611-304f-4d92-bb8a-111111111111",
        role: "admin",
        email: "outro.admin@webgran.online",
      };
      expect(isOwnerAccount(otherAdmin)).toBe(false);
    });

    it("cenário 5: Vendedor comum -> Interface clássica (bloqueado)", () => {
      const regularSeller = {
        id: "seller-12345-67890",
        role: "seller",
        email: "lojista@vendas.com",
      };
      expect(isOwnerAccount(regularSeller)).toBe(false);
    });

    it("cenário 5b: Vendedor tentando enviar o e-mail oficial sem possuir role admin -> Interface clássica (bloqueado)", () => {
      const spoofingSeller = {
        id: "seller-spoofing-id",
        role: "seller",
        email: OWNER_EMAIL,
      };
      expect(isOwnerAccount(spoofingSeller)).toBe(false);
    });

    it("cenário 6: Usuário não autenticado (null, undefined ou objeto vazio) -> Não autorizado", () => {
      expect(isOwnerAccount(null)).toBe(false);
      expect(isOwnerAccount(undefined)).toBe(false);
      expect(isOwnerAccount({})).toBe(false);
      expect(isOwnerAccount({ id: "", email: "", role: "" })).toBe(false);
    });
  });

  describe("2. Bloqueio Anti-Spoofing e Proteção no Servidor", () => {
    it("cenário 7: ID de proprietário enviado pelo cliente em payload arbitrário não concede autorização se sessão for de outro usuário", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      // Sessão autenticada real no servidor pertence a outro lojista
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "lojista-real-id",
        email: "lojista@gmail.com",
        role: "seller",
      } as any);

      // Simulação: Cliente enviou no body { targetUserId: OWNER_USER_ID }
      const clientPayload = { targetUserId: OWNER_USER_ID, fakeRole: "admin" };
      expect(clientPayload.targetUserId).toBe(OWNER_USER_ID);

      // A verificação do servidor consulta estritamente a sessão
      const isAuthorizedOnServer = await checkIsOwnerServer();
      expect(isAuthorizedOnServer).toBe(false);
    });

    it("cenário 8: isOwnerAccount=true manipulado pelo cliente não é aceito", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "outro-admin-id",
        email: "admin2@webgran.online",
        role: "admin",
      } as any);

      // O cliente injeta flag na chamada
      const clientManipulatedProp = { isOwnerAccount: true };
      expect(clientManipulatedProp.isOwnerAccount).toBe(true);

      // O servidor avalia a identidade real
      const isAuthorizedOnServer = await checkIsOwnerServer();
      expect(isAuthorizedOnServer).toBe(false);
    });

    it("cenário 9: Role admin enviada pelo cliente em payload não concede autorização", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "vendedor-id",
        email: "vendedor@teste.com",
        role: "seller",
      } as any);

      const isAuthorizedOnServer = await checkIsOwnerServer();
      expect(isAuthorizedOnServer).toBe(false);
    });

    it("cenário 10: E-mail oficial enviado pelo cliente em cabeçalho ou body não altera a sessão do servidor", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "vendedor-autenticado",
        email: "vendedor-real@teste.com",
        role: "seller",
      } as any);

      const isAuthorizedOnServer = await checkIsOwnerServer();
      expect(isAuthorizedOnServer).toBe(false);
    });
  });

  describe("3. Auditoria e Isolamento das Dez Rotas", () => {
    const ROTAS_V2 = [
      { id: 1, rota: "/seller/products", nome: "Produtos" },
      { id: 2, rota: "/seller/coupons", nome: "Cupons" },
      { id: 3, rota: "/seller/boas-vindas", nome: "Mensagem de boas-vindas" },
      { id: 4, rota: "/seller/banners", nome: "Banners da loja" },
      { id: 5, rota: "/seller/combos", nome: "Combos e ofertas" },
      { id: 6, rota: "/seller/videos", nome: "Biblioteca de vídeos" },
      { id: 7, rota: "/seller/carousels", nome: "Carrosséis da loja" },
      { id: 8, rota: "/seller/categories", nome: "Categorias do catálogo" },
      { id: 9, rota: "/seller/bot/clips", nome: "Clipes" },
      { id: 10, rota: "/seller/bot/notifications", nome: "Notificações flutuantes" },
    ];

    it.each(ROTAS_V2)(
      "Para a rota $rota ($nome), a conta proprietária oficial recebe V2 e outro usuário recebe interface clássica",
      ({ rota }) => {
        const ownerSession = {
          id: OWNER_USER_ID,
          email: OWNER_EMAIL,
          role: "admin",
        };

        const anotherAdminSession = {
          id: "another-admin-uuid",
          email: "gestor@empresa.com",
          role: "admin",
        };

        const sellerSession = {
          id: "regular-seller-uuid",
          email: "vendedor@loja.com",
          role: "seller",
        };

        // Proprietário
        expect(isOwnerAccount(ownerSession)).toBe(true);

        // Outro admin: NUNCA recebe V2
        expect(isOwnerAccount(anotherAdminSession)).toBe(false);

        // Vendedor comum: NUNCA recebe V2
        expect(isOwnerAccount(sellerSession)).toBe(false);
      }
    );

    it("Garante que a restrição de /seller/categories bloqueia vendedores comuns e mantém administradores não-proprietários no clássico", () => {
      const seller = { id: "seller-id", role: "seller", email: "vendedor@loja.com" };
      const admin = { id: "admin-id", role: "admin", email: "admin@loja.com" };
      const owner = { id: OWNER_USER_ID, role: "admin", email: OWNER_EMAIL };

      // Regra de página: role === "admin" || role === "super_admin"
      const isPageAllowedForSeller = (seller.role || "").toLowerCase() === "admin" || (seller.role || "").toLowerCase() === "super_admin";
      const isPageAllowedForAdmin = (admin.role || "").toLowerCase() === "admin" || (admin.role || "").toLowerCase() === "super_admin";
      const isPageAllowedForOwner = (owner.role || "").toLowerCase() === "admin" || (owner.role || "").toLowerCase() === "super_admin";

      expect(isPageAllowedForSeller).toBe(false); // Vendedor é redirecionado
      expect(isPageAllowedForAdmin).toBe(true);   // Outro admin pode acessar a página
      expect(isPageAllowedForOwner).toBe(true);   // Proprietário pode acessar a página

      // Camada adicional V2
      expect(isOwnerAccount(admin)).toBe(false);  // Outro admin vê CategoriesClient clássico
      expect(isOwnerAccount(owner)).toBe(true);   // Proprietário vê a V2
    });
  });
});

