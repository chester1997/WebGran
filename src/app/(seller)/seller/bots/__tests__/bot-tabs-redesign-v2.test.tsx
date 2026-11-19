import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BotTabsNavV2, { buildBotTabGroupsV2 } from "../components/BotTabsNavV2";
import { isOwnerUser, OWNER_EMAIL, OWNER_USER_ID } from "@/lib/bots/owner-guard";
import { isCouponEffectivelyActive } from "../../coupons/coupon-status";
import { getVideoAssignedCount } from "../../videos/video-assignment";

describe("Redesign V2 das abas do bot", () => {
  describe("Navegação agrupada", () => {
    it("agrupa as abas em Bot, Catálogo, Vitrine do Mini App e Mídia com os mesmos ids da navegação clássica", () => {
      const groups = buildBotTabGroupsV2({ isAdmin: true, mode: "MINI_APP" });
      expect(groups.map((g) => g.label)).toEqual(["Bot", "Catálogo", "Vitrine do Mini App", "Mídia"]);
      const ids = groups.flatMap((g) => g.tabs.map((t) => t.id));
      expect(ids).toEqual([
        "visao-geral", "configuracao", "boas-vindas",
        "produtos", "categorias", "combos", "cupons",
        "banners", "carrosseis", "notificacoes",
        "videos", "clips",
      ]);
    });

    it("esconde Categorias para quem não é admin, como a navegação clássica", () => {
      const ids = buildBotTabGroupsV2({ isAdmin: false }).flatMap((g) => g.tabs.map((t) => t.id));
      expect(ids).not.toContain("categorias");
    });

    it("no modo PADRAO mostra só o grupo Bot", () => {
      const groups = buildBotTabGroupsV2({ isAdmin: true, mode: "PADRAO" });
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe("Bot");
    });

    it("marca a aba ativa e mostra ícone + nome, sem títulos de grupo na barra", () => {
      const html = renderToStaticMarkup(
        <BotTabsNavV2 activeTab="cupons" onSelectTab={() => {}} isAdmin={true} />
      );
      expect(html).toMatch(/aria-current="page"[^>]*>.*?<svg[\s\S]*?<span>Cupons<\/span>/);
      expect(html).not.toContain("Vitrine do Mini App");
      expect(html).not.toContain(">Catálogo<");
      expect(html).not.toContain(">Mídia<");
    });
  });

  describe("Isolamento: só a conta proprietária vê o V2", () => {
    it("libera para o ID ou o e-mail do proprietário", () => {
      expect(isOwnerUser({ id: OWNER_USER_ID, email: null })).toBe(true);
      expect(isOwnerUser({ id: "outro-id", email: ` ${OWNER_EMAIL.toUpperCase()} ` })).toBe(true);
    });

    it("bloqueia lojistas, outros admins e usuário vazio", () => {
      expect(isOwnerUser({ id: "seller-1", email: "lojista@exemplo.com" })).toBe(false);
      expect(isOwnerUser({ id: "admin-2", email: "admin@exemplo.com" })).toBe(false);
      expect(isOwnerUser(null)).toBe(false);
      expect(isOwnerUser({ id: "", email: OWNER_EMAIL })).toBe(false);
    });
  });

  describe("Cupons: contagem de ativos usa a mesma regra da tabela", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    it("cupom ligado, válido e com usos é ativo", () => {
      expect(isCouponEffectivelyActive({ status: "active", expiresAt: "2026-12-01", maxUses: 10, usedCount: 2 }, now)).toBe(true);
    });
    it("cupom vencido não conta como ativo", () => {
      expect(isCouponEffectivelyActive({ status: "active", expiresAt: "2026-09-29", maxUses: null, usedCount: 0 } as any, now)).toBe(false);
    });
    it("cupom com limite de usos atingido não conta como ativo", () => {
      expect(isCouponEffectivelyActive({ status: "active", expiresAt: null, maxUses: 2, usedCount: 2 }, now)).toBe(false);
    });
    it("cupom pausado não conta como ativo", () => {
      expect(isCouponEffectivelyActive({ status: "inactive", expiresAt: null, maxUses: null, usedCount: 0 } as any, now)).toBe(false);
    });
  });

  describe("Biblioteca: vídeos sem produto", () => {
    it("lê a contagem de vínculos nos formatos que o loader devolve", () => {
      expect(getVideoAssignedCount({ assignedProductsCount: 2 })).toBe(2);
      expect(getVideoAssignedCount({ assignmentCount: 1 })).toBe(1);
      expect(getVideoAssignedCount({ assignments: [{ id: "a", productId: "p" }] })).toBe(1);
      expect(getVideoAssignedCount({})).toBe(0);
    });
  });
});
