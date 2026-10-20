import { describe, it, expect } from "vitest";
import { PRODUCT_BADGE_OPTIONS, getProductBadge } from "../product-badge";

describe("Product Badge System", () => {
  describe("PRODUCT_BADGE_OPTIONS", () => {
    it("contains all expected badge options with correct values and labels", () => {
      const values = PRODUCT_BADGE_OPTIONS.map((opt) => opt.value);
      expect(values).toEqual([
        "",
        "novo",
        "dublado",
        "legendado",
        "br",
        "em_alta",
        "lancamento",
        "1_temporada",
      ]);

      const opt1Temporada = PRODUCT_BADGE_OPTIONS.find((opt) => opt.value === "1_temporada");
      expect(opt1Temporada).toBeDefined();
      expect(opt1Temporada?.label).toBe("1 Temporada");
      expect(opt1Temporada?.colorName).toBe("Azul Celeste");
    });

    it("preserves all existing badges unmodified", () => {
      const novo = PRODUCT_BADGE_OPTIONS.find((o) => o.value === "novo");
      const dublado = PRODUCT_BADGE_OPTIONS.find((o) => o.value === "dublado");
      const legendado = PRODUCT_BADGE_OPTIONS.find((o) => o.value === "legendado");
      const br = PRODUCT_BADGE_OPTIONS.find((o) => o.value === "br");
      const emAlta = PRODUCT_BADGE_OPTIONS.find((o) => o.value === "em_alta");
      const lancamento = PRODUCT_BADGE_OPTIONS.find((o) => o.value === "lancamento");

      expect(novo).toEqual({ value: "novo", label: "Novo", colorName: "Verde", colorHex: "#10B981" });
      expect(dublado).toEqual({ value: "dublado", label: "Dublado (DUB)", colorName: "Azul", colorHex: "#2563EB" });
      expect(legendado).toEqual({ value: "legendado", label: "Legendado (LEG)", colorName: "Vermelho", colorHex: "#DC2626" });
      expect(br).toEqual({ value: "br", label: "BR", colorName: "Verde e Amarelo", colorHex: "#10B981" });
      expect(emAlta).toEqual({ value: "em_alta", label: "Em alta", colorName: "Amarelo", colorHex: "#FBBF24" });
      expect(lancamento).toEqual({ value: "lancamento", label: "Lançamento", colorName: "Roxo", colorHex: "#9333EA" });
    });
  });

  describe("getProductBadge", () => {
    it("correctly resolves '1_temporada' badge configuration", () => {
      const badge = getProductBadge("1_temporada");
      expect(badge).not.toBeNull();
      expect(badge?.value).toBe("1_temporada");
      expect(badge?.label).toBe("1 Temporada");
      expect(badge?.className).toContain("bg-sky-600");
      expect(badge?.className).toContain("text-white");
      expect(badge?.className).toContain("uppercase");
      expect(badge?.sellerBadgeClass).toContain("bg-sky-500/20");
      expect(badge?.sellerBadgeClass).toContain("text-sky-400");
    });

    it("supports normalizations such as '1 temporada' and uppercase '1 TEMPORADA'", () => {
      expect(getProductBadge("1 temporada")?.value).toBe("1_temporada");
      expect(getProductBadge("1 TEMPORADA")?.value).toBe("1_temporada");
      expect(getProductBadge("  1_temporada  ")?.value).toBe("1_temporada");
      expect(getProductBadge("1temporada")?.value).toBe("1_temporada");
      expect(getProductBadge("temporada_1")?.value).toBe("1_temporada");
    });

    it("correctly resolves all existing badge types", () => {
      expect(getProductBadge("novo")?.label).toBe("Novo");
      expect(getProductBadge("dublado")?.label).toBe("DUB");
      expect(getProductBadge("legendado")?.label).toBe("LEG");
      expect(getProductBadge("br")?.label).toBe("BR");
      expect(getProductBadge("nacional")?.label).toBe("BR");
      expect(getProductBadge("em_alta")?.label).toBe("Em alta");
      expect(getProductBadge("em alta")?.label).toBe("Em alta");
      expect(getProductBadge("lancamento")?.label).toBe("Lançamento");
    });

    it("returns null for empty, null, undefined, or unrecognized badges", () => {
      expect(getProductBadge(null)).toBeNull();
      expect(getProductBadge(undefined)).toBeNull();
      expect(getProductBadge("")).toBeNull();
      expect(getProductBadge("   ")).toBeNull();
      expect(getProductBadge("badge_inexistente")).toBeNull();
    });
  });

  describe("Persistence and Edit Reload Simulation", () => {
    it("simulates form submission for 1_temporada and saves correctly", () => {
      const formData = new FormData();
      formData.set("badge", "1_temporada");
      const savedBadge = (formData.get("badge") as string) || null;
      expect(savedBadge).toBe("1_temporada");

      const badgeConfig = getProductBadge(savedBadge);
      expect(badgeConfig?.label).toBe("1 Temporada");
    });

    it("simulates empty badge submission and saves as null", () => {
      const formData = new FormData();
      formData.set("badge", "");
      const savedBadge = (formData.get("badge") as string) || null;
      expect(savedBadge).toBeNull();
      expect(getProductBadge(savedBadge)).toBeNull();
    });

    it("simulates reloading a product with 1_temporada in EditProductModal", () => {
      const existingProduct = {
        id: "prod-1",
        title: "Série VIP",
        badge: "1_temporada",
      };

      const selectedValueInModal = existingProduct?.badge
        ? existingProduct.badge.toLowerCase().trim().replace(/\s+/g, '_')
        : "";

      expect(selectedValueInModal).toBe("1_temporada");
    });

    it("simulates reloading a product with spaced '1 temporada' in EditProductModal", () => {
      const existingProduct = {
        id: "prod-2",
        title: "Série VIP 2",
        badge: "1 temporada",
      };

      const selectedValueInModal = existingProduct?.badge
        ? existingProduct.badge.toLowerCase().trim().replace(/\s+/g, '_')
        : "";

      expect(selectedValueInModal).toBe("1_temporada");
    });

    it("simulates reloading existing badges in EditProductModal", () => {
      const badges = ["novo", "dublado", "legendado", "br", "em_alta", "lancamento"];
      for (const b of badges) {
        const prod = { id: "p", title: "T", badge: b };
        const selectedValue = prod.badge ? prod.badge.toLowerCase().trim().replace(/\s+/g, '_') : "";
        expect(selectedValue).toBe(b);
      }
    });
  });
});
