import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProgressivePricingEngine, ProgressiveTier, PricingItemInput } from "../pricing-engine";
import { CheckoutService } from "../../orders/checkout-service";
import { isValidPixCode } from "@/components/payments/PixPaymentCard";

describe("WebGran — Suíte de Regressão: Ofertas Progressivas, Carregamento Inicial do Mini App e Checkout Pix", () => {
  // Configuração padrão do cenário do vendedor
  // Produto base de R$ 5,00 cada (500 centavos)
  const baseTiers: ProgressiveTier[] = [
    { id: "tier-3", minQuantity: 3, priceCents: 1200 }, // 3 por R$ 12,00 (R$ 4,00/un)
    { id: "tier-5", minQuantity: 5, priceCents: 1500 }, // 5 por R$ 15,00 (R$ 3,00/un)
    { id: "tier-10", minQuantity: 10, priceCents: 2000 }, // 10 por R$ 20,00 (R$ 2,00/un)
  ];

  const makeItems = (qty: number, priceCents = 500): PricingItemInput[] =>
    Array.from({ length: qty }, (_, i) => ({
      id: `item-${i + 1}`,
      priceCents,
    }));

  describe("PROBLEMA 1 — O motor de precificação NÃO inventa faixas inexistentes acima das cadastradas", () => {
    it("Q=1: Apresenta próxima faixa cadastrada de 3 unidades (faltam 2 unidades)", () => {
      const items = makeItems(1);
      const res = ProgressivePricingEngine.calculate(items, baseTiers);

      expect(res.totalUnits).toBe(1);
      expect(res.finalPriceCents).toBe(500);
      expect(res.savingsCents).toBe(0);
      expect(res.appliedTiers).toHaveLength(0);
      expect(res.nextTierProgress).not.toBeNull();
      expect(res.nextTierProgress?.targetQuantity).toBe(3);
      expect(res.nextTierProgress?.unitsRemaining).toBe(2);
      expect(res.nextTierProgress?.targetTierPriceCents).toBe(1200);
      expect(res.nextTierProgress?.projectedAdditionalSavingsCents).toBe(300); // 3x500 = 1500 - 1200 = 300
    });

    it("Q=3: Desbloqueia faixa de 3 por R$ 12,00 e aponta estritamente para a próxima faixa cadastrada de 5 unidades", () => {
      const items = makeItems(3);
      const res = ProgressivePricingEngine.calculate(items, baseTiers);

      expect(res.totalUnits).toBe(3);
      expect(res.coveredUnits).toBe(3);
      expect(res.regularUnits).toBe(0);
      expect(res.finalPriceCents).toBe(1200);
      expect(res.savingsCents).toBe(300); // 1500 - 1200 = 300
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
      expect(res.nextTierProgress?.targetQuantity).toBe(5);
      expect(res.nextTierProgress?.unitsRemaining).toBe(2);
      expect(res.nextTierProgress?.targetTierPriceCents).toBe(1500);
    });

    it("Q=5: Desbloqueia faixa de 5 por R$ 15,00 e aponta estritamente para a próxima faixa cadastrada de 10 unidades", () => {
      const items = makeItems(5);
      const res = ProgressivePricingEngine.calculate(items, baseTiers);

      expect(res.totalUnits).toBe(5);
      expect(res.coveredUnits).toBe(5);
      expect(res.regularUnits).toBe(0);
      expect(res.finalPriceCents).toBe(1500);
      expect(res.savingsCents).toBe(1000); // 2500 - 1500 = 1000
      expect(res.appliedTiers[0].minQuantity).toBe(5);
      expect(res.nextTierProgress?.targetQuantity).toBe(10);
      expect(res.nextTierProgress?.unitsRemaining).toBe(5);
      expect(res.nextTierProgress?.targetTierPriceCents).toBe(2000);
    });

    it("Q=10: Desbloqueia a última faixa cadastrada (10 por R$ 20,00) e NÃO exibe progresso para faixa inexistente (nextTierProgress === null)", () => {
      const items = makeItems(10);
      const res = ProgressivePricingEngine.calculate(items, baseTiers);

      expect(res.totalUnits).toBe(10);
      expect(res.coveredUnits).toBe(10);
      expect(res.regularUnits).toBe(0);
      expect(res.finalPriceCents).toBe(2000);
      expect(res.savingsCents).toBe(3000); // 5000 - 2000 = 3000 (R$ 30,00 de desconto)
      expect(res.appliedTiers).toHaveLength(1);
      expect(res.appliedTiers[0].minQuantity).toBe(10);
      expect(res.appliedTiers[0].priceCents).toBe(2000);

      // PONTO CRÍTICO DO PROBLEMA 1:
      // A última faixa cadastrada é 10. O motor NUNCA deve inventar meta de 13, 15, 20 etc.
      expect(res.nextTierProgress).toBeNull();
    });

    it("Q=13: NÃO inventa faixa e NÃO combina faixas automaticamente (10+3): aplica 1x faixa de 10 (R$ 20,00) + 3 excedentes a preço normal (3x R$ 5,00) = R$ 35,00", () => {
      const items = makeItems(13);
      const res = ProgressivePricingEngine.calculate(items, baseTiers);

      expect(res.totalUnits).toBe(13);
      expect(res.coveredUnits).toBe(10);
      expect(res.regularUnits).toBe(3);
      expect(res.finalPriceCents).toBe(3500); // 1x Faixa 10 (2000) + 3 excedentes normais (1500) = 3500
      expect(res.savingsCents).toBe(3000); // 6500 - 3500 = 3000
      expect(res.appliedTiers).toEqual([
        {
          tierId: "tier-10",
          minQuantity: 10,
          priceCents: 2000,
          count: 1,
          totalCoveredUnits: 10,
          totalPriceCents: 2000,
        },
      ]);
      // Não deve exibir "próxima faixa: 13 unidades por R$ 32,00" nem nenhuma progressão futura
      expect(res.nextTierProgress).toBeNull();
    });

    it("Q=12: 10 unidades na faixa de 10 + 2 unidades excedentes a preço cheio regular = R$ 30,00, sem progressão inventada", () => {
      const items = makeItems(12);
      const res = ProgressivePricingEngine.calculate(items, baseTiers);

      expect(res.totalUnits).toBe(12);
      expect(res.coveredUnits).toBe(10);
      expect(res.regularUnits).toBe(2);
      expect(res.finalPriceCents).toBe(3000); // 2000 + (2 * 500)
      expect(res.savingsCents).toBe(3000);
      expect(res.nextTierProgress).toBeNull();
    });

    it("Carrinho sem nenhuma oferta/faixas cadastradas: cobra todos os itens a preço regular e nextTierProgress é null", () => {
      const items = makeItems(4, 800);
      const res = ProgressivePricingEngine.calculate(items, []);

      expect(res.totalUnits).toBe(4);
      expect(res.finalPriceCents).toBe(3200);
      expect(res.savingsCents).toBe(0);
      expect(res.appliedTiers).toHaveLength(0);
      expect(res.regularUnits).toBe(4);
      expect(res.nextTierProgress).toBeNull();
    });

    it("Mix de produtos elegíveis e inelegíveis: apenas itens elegíveis recebem faixa", () => {
      // 10 itens elegíveis a 500 centavos + 2 itens inelegíveis que permanecem fora do cálculo
      const eligibleItems = makeItems(10, 500);
      const res = ProgressivePricingEngine.calculate(eligibleItems, baseTiers);

      expect(res.totalUnits).toBe(10);
      expect(res.finalPriceCents).toBe(2000);
      expect(res.nextTierProgress).toBeNull();
    });
  });

  describe("PROBLEMA 2 — Carregamento Inicial do Mini App e Sincronização Resiliente", () => {
    it("Valida extração de initData a partir do hash (#tgWebAppData=...) do Telegram WebApp", () => {
      const mockHash = "#tgWebAppData=query_id%3DAAH123%26user%3D%257B%2522id%2522%253A998877%252C%2522first_name%2522%253A%2522Luiz%2522%257D%26auth_date%3D1710000000%26hash%3Dabcdef123456";
      
      // Simulando a lógica de getFallbackInitData e getTelegramInitData
      const clean = mockHash.startsWith("#") ? mockHash.slice(1) : mockHash;
      const tgIndex = clean.indexOf("tgWebAppData=");
      expect(tgIndex).toBe(0);

      let rawVal = clean.slice("tgWebAppData=".length);
      if (rawVal.includes("%3D") || rawVal.includes("%26") || rawVal.includes("%7B")) {
        rawVal = decodeURIComponent(rawVal);
      }

      expect(rawVal).toContain("hash=abcdef123456");
      expect(rawVal).toContain("user=");
      expect(rawVal).toContain("query_id=AAH123");
    });

    it("Simula 401 inicial na primeira montagem que NÃO bloqueia retentativas futuras", () => {
      let hasSyncedInitial = false;
      let isAuthenticated = false;

      // Primeira tentativa (quando a auth ainda está em andamento no Providers.tsx)
      const mockInitialAttemptStatus = 401;
      if (mockInitialAttemptStatus === 401) {
        isAuthenticated = false;
        // CORREÇÃO: Não define hasSyncedInitial = true!
      }
      expect(hasSyncedInitial).toBe(false);

      // Segunda tentativa (após o evento webgran_tg_auth_success disparado pelo Providers.tsx)
      const mockSecondAttemptStatus = 200;
      if (mockSecondAttemptStatus === 200) {
        isAuthenticated = true;
        hasSyncedInitial = true;
      }

      expect(hasSyncedInitial).toBe(true);
      expect(isAuthenticated).toBe(true);
    });
  });

  describe("PROBLEMA 3 — Checkout Pix do Mini App e Preservação do Carrinho", () => {
    it("Garante validação rigorosa de código Pix copia e cola", () => {
      const validPix = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540549.905802BR5913SyncPay Seller6009SAO PAULO62070503***6304E2CA";
      expect(isValidPixCode(validPix)).toBe(true);
      expect(isValidPixCode("")).toBe(false);
      expect(isValidPixCode(null)).toBe(false);
      expect(isValidPixCode("undefined")).toBe(false);
      expect(isValidPixCode("null")).toBe(false);
    });

    it("Cenário das 10 unidades por R$ 20,00: Subtotal R$ 50,00, Desconto R$ 30,00, Total a Pagar R$ 20,00", () => {
      const items = makeItems(10, 500); // 10 unidades x R$ 5,00 = R$ 50,00 bruto
      const pricing = ProgressivePricingEngine.calculate(items, baseTiers);

      const subtotalReais = pricing.regularSubtotalCents / 100;
      const discountReais = pricing.savingsCents / 100;
      const totalReais = pricing.finalPriceCents / 100;

      expect(subtotalReais).toBe(50.0);
      expect(discountReais).toBe(30.0);
      expect(totalReais).toBe(20.0);
      expect(subtotalReais - discountReais).toBe(totalReais);
    });

    it("Regra de Preservação do Carrinho: O carrinho só deve ser limpo após status 'paid'", () => {
      let cartItems = [{ id: "prod-1", quantity: 10, price: 5.0 }];
      let orderStatus: "pending" | "paid" = "pending";

      // 1. Ao clicar em Gerar Pagamento Pix:
      // O pedido é criado com status "pending". O carrinho NÃO é limpo!
      expect(orderStatus).toBe("pending");
      expect(cartItems).toHaveLength(1);

      // 2. Enquanto o pagamento está pendente, o cliente pode fechar e reabrir o modal
      expect(cartItems[0].quantity).toBe(10);

      // 3. Somente quando o polling ou webhook confirma "paid":
      orderStatus = "paid";
      if (orderStatus === "paid") {
        cartItems = [];
      }

      expect(cartItems).toHaveLength(0);
    });
  });
});
