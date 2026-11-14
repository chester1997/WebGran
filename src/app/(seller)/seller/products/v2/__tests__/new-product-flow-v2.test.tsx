import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliveryTypeStep } from "../DeliveryTypeStep";
import { ProductDetailsStep } from "../ProductDetailsStep";
import { NewProductFlowV2 } from "../NewProductFlowV2";
import { INITIAL_FORM_STATE, NewProductFormStateV2 } from "../types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock createProductAction
vi.mock("../../actions", () => ({
  createProductAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("WEBGRAN — Novo Fluxo 'Novo Produto' (Admin / Proprietário)", () => {
  const mockCategories = [
    { id: "cat-1", name: "Cursos" },
    { id: "cat-2", name: "VIP" },
  ];

  const mockBots = [
    { id: "bot-1", username: "meubot_vip", displayName: "Meu Bot VIP" },
  ];

  const mockCarousels = [
    { id: "car-1", name: "Destaques da Semana" },
  ];


  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. PASSO 1: ESCOLHA DA FORMA DE ENTREGA (DeliveryTypeStep)
  // =========================================================================
  describe("1. Passo 1: Escolha da Forma de Entrega (DeliveryTypeStep)", () => {
    it("1.1 Renderiza os 3 cards de entrega com títulos, badges e textos corretos", () => {
      const html = renderToStaticMarkup(
        <DeliveryTypeStep
          selectedType="telegram"
          onSelectType={vi.fn()}
          onContinue={vi.fn()}
          onClose={vi.fn()}
        />
      );

      // Título principal
      expect(html).toContain("Como deseja entregar?");
      expect(html).toContain("NOVO PRODUTO · PASSO 1 DE 2");

      // Card 1: Grupo ou canal
      expect(html).toContain("Grupo ou canal");
      expect(html).toContain("COMUNIDADE FECHADA");
      expect(html).toContain("Convite automático");

      // Card 2: Link externo
      expect(html).toContain("Link externo");
      expect(html).toContain("ACESSO POR LINK");
      expect(html).toContain("Link pelo bot");

      // Card 3: Vídeo do produto
      expect(html).toContain("Vídeo do produto");
      expect(html).toContain("STREAMING NO MINI APP");
      expect(html).toContain("Liberado no mini app");

      // Botão Continuar
      expect(html).toContain("Continuar");
    });

    it("1.2 Aplica estilo ativo no tipo selecionado (Telegram: #38bdf8)", () => {
      const html = renderToStaticMarkup(
        <DeliveryTypeStep
          selectedType="telegram"
          onSelectType={vi.fn()}
          onContinue={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain("border-color:#38bdf8");
    });

    it("1.3 Aplica estilo ativo no tipo selecionado (Link Externo: #a3e635)", () => {
      const html = renderToStaticMarkup(
        <DeliveryTypeStep
          selectedType="external"
          onSelectType={vi.fn()}
          onContinue={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain("border-color:#a3e635");
    });

    it("1.4 Aplica estilo ativo no tipo selecionado (Vídeo: #c084fc)", () => {
      const html = renderToStaticMarkup(
        <DeliveryTypeStep
          selectedType="product_video"
          onSelectType={vi.fn()}
          onContinue={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain("border-color:#c084fc");
    });
  });

  // =========================================================================
  // 2. PASSO 2: DETALHES DO PRODUTO (ProductDetailsStep)
  // =========================================================================
  describe("2. Passo 2: Detalhes do Produto Adaptativo (ProductDetailsStep)", () => {
    it("2.1 Seção 1 adapta para Telegram: exibe campo de ID de Canal/Grupo", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        deliveryType: "telegram",
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={mockCategories}
          bots={mockBots}
          carousels={mockCarousels}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      expect(html).toContain("ID do grupo ou canal");
      expect(html).toContain("-1001234567890");
      expect(html).toContain("Trocar tipo");
      expect(html).toContain("Testar conexão");
    });

    it("2.2 Seção 1 adapta para Link Externo: exibe campo de URL de destino", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        deliveryType: "external",
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={mockCategories}
          bots={mockBots}
          carousels={mockCarousels}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      expect(html).toContain("Link de entrega");
      expect(html).toContain("https://meudrive.com/arquivo");
      expect(html).toContain("Trocar tipo");
    });

    it("2.3 Seção 1 adapta para Vídeo do Produto: exibe botão para escolher vídeos da biblioteca", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        deliveryType: "product_video",
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={mockCategories}
          bots={mockBots}
          carousels={mockCarousels}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      expect(html).toContain("Selecione os vídeos da sua biblioteca");
      expect(html).toContain("Selecionar da biblioteca");
      expect(html).toContain("Trocar tipo");
    });

    it("2.4 Renderiza todas as 4 seções do formulário", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        deliveryType: "telegram",
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={mockCategories}
          bots={mockBots}
          carousels={mockCarousels}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      // Seção 1: Entrega
      expect(html).toContain("ENTREGA · Grupo ou canal");
      // Seção 2: Detalhes
      expect(html).toContain("PRODUTO");
      // Seção 3: Onde Aparece
      expect(html).toContain("ONDE APARECE");
      // Seção 4: Mini App Showcase
      expect(html).toContain("Vitrine do mini app");
    });

    it("2.5 Garante a estrutura correta de layout e rolagem (header fixo, corpo com min-h-0 e rodapé fixo)", () => {
      const state: NewProductFormStateV2 = {
        ...INITIAL_FORM_STATE,
        deliveryType: "telegram",
      };

      const html = renderToStaticMarkup(
        <ProductDetailsStep
          state={state}
          setState={vi.fn()}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
          categories={mockCategories}
          bots={mockBots}
          carousels={mockCarousels}
          saving={false}
          saveSuccess={false}
          serverError={null}
        />
      );

      // Cabeçalho deve ser shrink-0
      expect(html).toContain("shrink-0 p-5");

      // Corpo rolável deve ter min-h-0 e overflow-y-auto para permitir scroll flex
      expect(html).toContain("min-h-0 overflow-y-auto");
      expect(html).toContain("overscroll-behavior:contain");

      // Rodapés devem ser shrink-0
      expect(html).toContain("hidden sm:flex shrink-0");
      expect(html).toContain("flex sm:hidden shrink-0");
      expect(html).toContain("safe-area-inset-bottom");
    });
  });



  // =========================================================================
  // 3. ISOLAMENTO DO COMPONENTE NewProductFlowV2
  // =========================================================================
  describe("3. Comportamento do componente NewProductFlowV2", () => {
    it("3.1 Retorna null quando isOpen=false", () => {
      const html = renderToStaticMarkup(
        <NewProductFlowV2
          isOpen={false}
          onClose={vi.fn()}
          categories={mockCategories}
          bots={mockBots}
          carousels={mockCarousels}
        />
      );

      expect(html).toBe("");
    });
  });
});
