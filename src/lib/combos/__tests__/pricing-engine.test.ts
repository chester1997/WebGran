import { describe, it, expect } from "vitest";
import {
  ProgressivePricingEngine,
  ProgressiveTier,
  PricingItemInput,
} from "../pricing-engine";

describe("ProgressivePricingEngine — Domain Unit Tests", () => {
  // Faixas do exemplo obrigatório
  // 3 por R$ 12,00 (1.200 centavos)
  // 4 por R$ 15,00 (1.500 centavos)
  // 10 por R$ 35,00 (3.500 centavos)
  const standardTiers: ProgressiveTier[] = [
    { id: "tier-3", minQuantity: 3, priceCents: 1200 },
    { id: "tier-4", minQuantity: 4, priceCents: 1500 },
    { id: "tier-10", minQuantity: 10, priceCents: 3500 },
  ];

  // Helper para gerar itens com preço uniforme
  const makeUniformItems = (count: number, unitPriceCents = 1000): PricingItemInput[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `item-${i + 1}`,
      priceCents: unitPriceCents,
      title: `Produto ${i + 1}`,
    }));

  describe("1. Quantidades Obrigatórias com Preços Homogêneos (R$ 10,00 cada)", () => {
    it("Q=1: Nenhuma faixa atingida, cobra preço cheio", () => {
      const items = makeUniformItems(1, 1000); // R$ 10,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(1);
      expect(res.coveredUnits).toBe(0);
      expect(res.regularUnits).toBe(1);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(1000);
      expect(res.finalPriceCents).toBe(1000);
      expect(res.savingsCents).toBe(0);
      expect(res.savingsPercentage).toBe(0);
      expect(res.appliedTiers).toHaveLength(0);
      expect(res.regularItems).toHaveLength(1);
      expect(res.tierCoveredItems).toHaveLength(0);
      expect(res.nextTierProgress?.targetQuantity).toBe(3);
      expect(res.nextTierProgress?.unitsRemaining).toBe(2);
    });

    it("Q=2: Nenhuma faixa atingida, cobra 2 unidades a preço cheio", () => {
      const items = makeUniformItems(2, 1000); // R$ 20,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(2);
      expect(res.coveredUnits).toBe(0);
      expect(res.regularUnits).toBe(2);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(2000);
      expect(res.finalPriceCents).toBe(2000);
      expect(res.savingsCents).toBe(0);
      expect(res.appliedTiers).toHaveLength(0);
      expect(res.nextTierProgress?.targetQuantity).toBe(3);
      expect(res.nextTierProgress?.unitsRemaining).toBe(1);
    });

    it("Q=3: Desbloqueia exatamente a Faixa de 3 por R$ 12,00", () => {
      const items = makeUniformItems(3, 1000); // Subtotal: R$ 30,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(3);
      expect(res.coveredUnits).toBe(3);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(3000);
      expect(res.finalPriceCents).toBe(1200);
      expect(res.savingsCents).toBe(1800); // R$ 18,00 de economia
      expect(res.savingsPercentage).toBe(60);
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-3",
          minQuantity: 3,
          priceCents: 1200,
          count: 1,
          totalCoveredUnits: 3,
          totalPriceCents: 1200,
        },
      ]);
      expect(res.tierCoveredItems).toHaveLength(3);
      expect(res.regularItems).toHaveLength(0);
      expect(res.nextTierProgress?.targetQuantity).toBe(4);
      expect(res.nextTierProgress?.unitsRemaining).toBe(1);
    });

    it("Q=4: Desbloqueia exatamente a Faixa de 4 por R$ 15,00", () => {
      const items = makeUniformItems(4, 1000); // Subtotal: R$ 40,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(4);
      expect(res.coveredUnits).toBe(4);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(4000);
      expect(res.finalPriceCents).toBe(1500);
      expect(res.savingsCents).toBe(2500); // R$ 25,00 de economia
      expect(res.savingsPercentage).toBe(63); // 2500/4000 = 62.5% -> 63%
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-4",
          minQuantity: 4,
          priceCents: 1500,
          count: 1,
          totalCoveredUnits: 4,
          totalPriceCents: 1500,
        },
      ]);
      expect(res.tierCoveredItems).toHaveLength(4);
      expect(res.regularItems).toHaveLength(0);
    });

    it("Q=5: Aplica Faixa de 4 un (R$ 15,00) + 1 unidade a preço cheio (R$ 10,00) = R$ 25,00", () => {
      const items = makeUniformItems(5, 1000); // Subtotal: R$ 50,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(5);
      expect(res.coveredUnits).toBe(4);
      expect(res.regularUnits).toBe(1);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(5000);
      expect(res.finalPriceCents).toBe(2500); // 1500 + 1000 = 2500
      expect(res.savingsCents).toBe(2500);
      expect(res.savingsPercentage).toBe(50);
      expect(res.appliedTiers).toHaveLength(1);
      expect(res.appliedTiers[0].minQuantity).toBe(4);
      expect(res.appliedTiers[0].count).toBe(1);
      expect(res.tierCoveredItems).toHaveLength(4);
      expect(res.regularItems).toHaveLength(1);
    });

    it("Q=9: Aplica 3x Faixa de 3 un (3x R$ 12,00 = R$ 36,00)", () => {
      const items = makeUniformItems(9, 1000); // Subtotal: R$ 90,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(9);
      expect(res.coveredUnits).toBe(9);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(9000);
      expect(res.finalPriceCents).toBe(3600); // 3 x 1200
      expect(res.savingsCents).toBe(5400); // R$ 54,00 de economia
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-3",
          minQuantity: 3,
          priceCents: 1200,
          count: 3,
          totalCoveredUnits: 9,
          totalPriceCents: 3600,
        },
      ]);
    });

    it("Q=10: Desbloqueia exatamente a Faixa de 10 por R$ 35,00", () => {
      const items = makeUniformItems(10, 1000); // Subtotal: R$ 100,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(10);
      expect(res.coveredUnits).toBe(10);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(10000);
      expect(res.finalPriceCents).toBe(3500);
      expect(res.savingsCents).toBe(6500); // R$ 65,00 de economia
      expect(res.savingsPercentage).toBe(65);
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-10",
          minQuantity: 10,
          priceCents: 3500,
          count: 1,
          totalCoveredUnits: 10,
          totalPriceCents: 3500,
        },
      ]);
    });

    it("Q=11: Particiona otimamente em 2x Faixa 4 + 1x Faixa 3 (4+4+3=11 un por R$ 42,00)", () => {
      const items = makeUniformItems(11, 1000); // Subtotal: R$ 110,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(11);
      expect(res.coveredUnits).toBe(11);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.regularSubtotalCents).toBe(11000);
      // Comparação de opções para 11 un:
      // Opção A: 2x 4un (R$ 30) + 1x 3un (R$ 12) = R$ 42,00 (11 cobertas)
      // Opção B: 1x 10un (R$ 35) + 1 un cheia (R$ 10) = R$ 45,00
      // Opção C: 2x 4un (R$ 30) + 3 un cheias (R$ 30) = R$ 60,00
      // O motor escolhe a Opção A: R$ 42,00!
      expect(res.finalPriceCents).toBe(4200);
      expect(res.savingsCents).toBe(6800); // R$ 68,00 de economia
      expect(res.appliedTiers).toHaveLength(2);

      const tier4 = res.appliedTiers.find((t) => t.minQuantity === 4);
      const tier3 = res.appliedTiers.find((t) => t.minQuantity === 3);
      expect(tier4?.count).toBe(2);
      expect(tier3?.count).toBe(1);
    });

    it("Q=12: Particiona otimamente em 3x Faixa 4 (3x R$ 15,00 = R$ 45,00)", () => {
      const items = makeUniformItems(12, 1000); // Subtotal: R$ 120,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(12);
      expect(res.coveredUnits).toBe(12);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      // 3x 4un = R$ 45,00
      // 4x 3un = R$ 48,00
      // 1x 10un + 2 un cheias = R$ 35 + R$ 20 = R$ 55,00
      expect(res.finalPriceCents).toBe(4500);
      expect(res.savingsCents).toBe(7500); // R$ 75,00 de economia
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-4",
          minQuantity: 4,
          priceCents: 1500,
          count: 3,
          totalCoveredUnits: 12,
          totalPriceCents: 4500,
        },
      ]);
    });

    it("Q=13: Combina 1x Faixa 10 (R$ 35,00) + 1x Faixa 3 (R$ 12,00) = R$ 47,00", () => {
      const items = makeUniformItems(13, 1000); // Subtotal: R$ 130,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(13);
      expect(res.coveredUnits).toBe(13);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.finalPriceCents).toBe(4700); // 3500 + 1200 = 4700
      expect(res.savingsCents).toBe(8300); // R$ 83,00 de economia
      expect(res.appliedTiers).toHaveLength(2);
      expect(res.appliedTiers.find((t) => t.minQuantity === 10)?.count).toBe(1);
      expect(res.appliedTiers.find((t) => t.minQuantity === 3)?.count).toBe(1);
    });

    it("Q=14: Combina 1x Faixa 10 (R$ 35,00) + 1x Faixa 4 (R$ 15,00) = R$ 50,00", () => {
      const items = makeUniformItems(14, 1000); // Subtotal: R$ 140,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(14);
      expect(res.coveredUnits).toBe(14);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.finalPriceCents).toBe(5000); // 3500 + 1500 = 5000
      expect(res.savingsCents).toBe(9000); // R$ 90,00 de economia
      expect(res.appliedTiers).toHaveLength(2);
      expect(res.appliedTiers.find((t) => t.minQuantity === 10)?.count).toBe(1);
      expect(res.appliedTiers.find((t) => t.minQuantity === 4)?.count).toBe(1);
    });

    it("Q=20: Aplica 2x Faixa 10 (2x R$ 35,00 = R$ 70,00)", () => {
      const items = makeUniformItems(20, 1000); // Subtotal: R$ 200,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(20);
      expect(res.coveredUnits).toBe(20);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      expect(res.finalPriceCents).toBe(7000);
      expect(res.savingsCents).toBe(13000); // R$ 130,00 de economia
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-10",
          minQuantity: 10,
          priceCents: 3500,
          count: 2,
          totalCoveredUnits: 20,
          totalPriceCents: 7000,
        },
      ]);
    });

    it("Q=21: Combina 1x Faixa 10 + 2x Faixa 4 + 1x Faixa 3 (10+4+4+3=21 un por R$ 77,00)", () => {
      const items = makeUniformItems(21, 1000); // Subtotal: R$ 210,00
      const res = ProgressivePricingEngine.calculate(items, standardTiers);

      expect(res.totalUnits).toBe(21);
      expect(res.coveredUnits).toBe(21);
      expect(res.regularUnits).toBe(0);
      expect(res.coveredUnits + res.regularUnits).toBe(res.totalUnits);
      // 1x 10 (R$ 35) + 2x 4 (R$ 30) + 1x 3 (R$ 12) = R$ 77,00
      expect(res.finalPriceCents).toBe(7700);
      expect(res.savingsCents).toBe(13300); // R$ 133,00 de economia
      expect(res.appliedTiers).toHaveLength(3);
      expect(res.appliedTiers.find((t) => t.minQuantity === 10)?.count).toBe(1);
      expect(res.appliedTiers.find((t) => t.minQuantity === 4)?.count).toBe(2);
      expect(res.appliedTiers.find((t) => t.minQuantity === 3)?.count).toBe(1);
    });
  });

  describe("2. Alocação Otimizada com Preços Individuais Heterogêneos (Requisito 5)", () => {
    it("aloca os produtos mais caros nas faixas promocionais e deixa os mais baratos a preço cheio", () => {
      // 5 itens com preços diferentes:
      // Item A: R$ 50,00 (5000 cents)
      // Item B: R$ 40,00 (4000 cents)
      // Item C: R$ 30,00 (3000 cents)
      // Item D: R$ 20,00 (2000 cents)
      // Item E: R$ 5,00  (500 cents)
      // Soma regular = R$ 145,00 (14500 cents)
      const items: PricingItemInput[] = [
        { id: "item-E", priceCents: 500, title: "Item Barato" },
        { id: "item-C", priceCents: 3000, title: "Item Médio" },
        { id: "item-A", priceCents: 5000, title: "Item Mais Caro" },
        { id: "item-D", priceCents: 2000, title: "Item Acessível" },
        { id: "item-B", priceCents: 4000, title: "Item Alto" },
      ];

      // Faixa única de 4 unidades por R$ 15,00 (1500 cents)
      const tiers: ProgressiveTier[] = [
        { id: "t4", minQuantity: 4, priceCents: 1500 },
      ];

      const res = ProgressivePricingEngine.calculate(items, tiers);

      expect(res.totalUnits).toBe(5);
      expect(res.coveredUnits).toBe(4);
      expect(res.regularUnits).toBe(1);

      // Itens cobertos DEVEM ser A, B, C, D (os 4 mais caros, soma = 14000 cents)
      const coveredIds = res.tierCoveredItems.map((i) => i.id);
      expect(coveredIds).toContain("item-A");
      expect(coveredIds).toContain("item-B");
      expect(coveredIds).toContain("item-C");
      expect(coveredIds).toContain("item-D");

      // Item restante a preço cheio DEVE ser o mais barato (item-E, R$ 5,00)
      expect(res.regularItems).toHaveLength(1);
      expect(res.regularItems[0].id).toBe("item-E");
      expect(res.regularItems[0].priceCents).toBe(500);

      // Preço final: Faixa de 4 (R$ 15,00) + Item E (R$ 5,00) = R$ 20,00 (2000 cents)
      expect(res.finalPriceCents).toBe(2000);
      expect(res.savingsCents).toBe(14500 - 2000); // R$ 125,00 de economia
    });
  });

  describe("3. Proteção do Consumidor e Economia Zero (Requisito 8)", () => {
    it("não aplica faixa promocional se ela for mais cara que os preços individuais cheios", () => {
      // 3 itens muito baratos de R$ 2,00 cada (Soma = R$ 6,00 / 600 cents)
      const items = makeUniformItems(3, 200);

      // Faixa de 3 por R$ 12,00 (1200 cents)
      const tiers: ProgressiveTier[] = [
        { id: "t3", minQuantity: 3, priceCents: 1200 },
      ];

      const res = ProgressivePricingEngine.calculate(items, tiers);

      // O motor DEVE recusar cobrar R$ 12,00 quando o preço individual é R$ 6,00!
      expect(res.finalPriceCents).toBe(600); // R$ 6,00
      expect(res.savingsCents).toBe(0);
      expect(res.savingsPercentage).toBe(0);
      expect(res.coveredUnits).toBe(0);
      expect(res.regularUnits).toBe(3);
      expect(res.appliedTiers).toHaveLength(0);
    });

    it("situação em que combinar faixas menores é mais barato que usar uma faixa maior", () => {
      // Configuração hipotética onde 2x Faixa 3 (2x R$ 8 = R$ 16) é mais barata que 1x Faixa 6 (R$ 20)
      const tiers: ProgressiveTier[] = [
        { id: "t3", minQuantity: 3, priceCents: 800 },
        { id: "t6", minQuantity: 6, priceCents: 2000 },
      ];

      const items = makeUniformItems(6, 1000); // 6 un a R$ 10 = R$ 60
      const res = ProgressivePricingEngine.calculate(items, tiers);

      // Deve escolher 2x Faixa 3 (R$ 16,00) em vez de 1x Faixa 6 (R$ 20,00)
      expect(res.finalPriceCents).toBe(1600);
      expect(res.savingsCents).toBe(4400); // R$ 60 - R$ 16 = R$ 44
      expect(res.appliedTiers).toEqual([
        {
          tierId: "t3",
          minQuantity: 3,
          priceCents: 800,
          count: 2,
          totalCoveredUnits: 6,
          totalPriceCents: 1600,
        },
      ]);
    });
  });

  describe("4. Validação Rigorosa de Entradas Inválidas e Erros", () => {
    it("rejeita faixas com minQuantity menor que 2", () => {
      expect(() => {
        ProgressivePricingEngine.validateTiers([
          { minQuantity: 1, priceCents: 500 },
        ]);
      }).toThrow(/maior ou igual a 2/);
    });

    it("rejeita faixas com minQuantity fracionária", () => {
      expect(() => {
        ProgressivePricingEngine.validateTiers([
          { minQuantity: 3.5 as any, priceCents: 500 },
        ]);
      }).toThrow(/número inteiro/);
    });

    it("rejeita faixas com preço zero ou negativo", () => {
      expect(() => {
        ProgressivePricingEngine.validateTiers([
          { minQuantity: 3, priceCents: 0 },
        ]);
      }).toThrow(/positivo em centavos/);

      expect(() => {
        ProgressivePricingEngine.validateTiers([
          { minQuantity: 3, priceCents: -500 },
        ]);
      }).toThrow(/positivo em centavos/);
    });

    it("rejeita faixas com quantidades duplicadas", () => {
      expect(() => {
        ProgressivePricingEngine.validateTiers([
          { minQuantity: 3, priceCents: 1200 },
          { minQuantity: 3, priceCents: 1000 },
        ]);
      }).toThrow(/Quantidade duplicada/);
    });

    it("rejeita itens com preço negativo", () => {
      expect(() => {
        ProgressivePricingEngine.validateItems([
          { id: "item-1", priceCents: -100 },
        ]);
      }).toThrow(/não-negativo em centavos/);
    });

    it("rejeita itens com preço fracionário não inteiro", () => {
      expect(() => {
        ProgressivePricingEngine.validateItems([
          { id: "item-1", priceCents: 10.5 as any },
        ]);
      }).toThrow(/número inteiro/);
    });
  });

  describe("5. Desempates Determinísticos e Casos Limite", () => {
    it("trata lista de itens vazia sem erros", () => {
      const res = ProgressivePricingEngine.calculate([], standardTiers);
      expect(res.totalUnits).toBe(0);
      expect(res.finalPriceCents).toBe(0);
      expect(res.savingsCents).toBe(0);
      expect(res.appliedTiers).toHaveLength(0);
      expect(res.nextTierProgress?.targetQuantity).toBe(3);
      expect(res.nextTierProgress?.unitsRemaining).toBe(3);
    });

    it("trata lista de faixas vazia cobrando todos os itens a preço regular", () => {
      const items = makeUniformItems(5, 1000);
      const res = ProgressivePricingEngine.calculate(items, []);
      expect(res.totalUnits).toBe(5);
      expect(res.finalPriceCents).toBe(5000);
      expect(res.savingsCents).toBe(0);
      expect(res.appliedTiers).toHaveLength(0);
      expect(res.regularUnits).toBe(5);
      expect(res.nextTierProgress).toBeNull();
    });

    it("desempate determinístico quando duas opções têm o mesmo custo", () => {
      // Faixa A: 3 por R$ 12,00 (R$ 4/un)
      // Faixa B: 6 por R$ 24,00 (R$ 4/un)
      // Para 6 unidades, 2x Faixa A = R$ 24,00; 1x Faixa B = R$ 24,00.
      // O motor determinístico prefere o menor número de pacotes (1x Faixa B).
      const tiers: ProgressiveTier[] = [
        { id: "faixa-3", minQuantity: 3, priceCents: 1200 },
        { id: "faixa-6", minQuantity: 6, priceCents: 2400 },
      ];

      const items = makeUniformItems(6, 1000);
      const res = ProgressivePricingEngine.calculate(items, tiers);

      expect(res.finalPriceCents).toBe(2400);
      expect(res.appliedTiers).toEqual([
        {
          tierId: "faixa-6",
          minQuantity: 6,
          priceCents: 2400,
          count: 1,
          totalCoveredUnits: 6,
          totalPriceCents: 2400,
        },
      ]);
    });

    it("performance com 100 itens executa em menos de 100ms", () => {
      const items = makeUniformItems(100, 1500);
      // Aquecimento de JIT
      ProgressivePricingEngine.calculate(items.slice(0, 5), standardTiers);

      const start = performance.now();
      const res = ProgressivePricingEngine.calculate(items, standardTiers);
      const duration = performance.now() - start;

      expect(res.totalUnits).toBe(100);
      // 100 itens = 10x Faixa 10 (10x R$ 35,00 = R$ 350,00)
      expect(res.finalPriceCents).toBe(35000);
      expect(res.savingsCents).toBe(150000 - 35000); // Economia de R$ 1.150,00
      expect(duration).toBeLessThan(100);
    });
  });
});
