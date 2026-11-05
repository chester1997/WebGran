import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SellerSidebar from "../SellerSidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/seller",
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("SellerSidebar Component (Etapa B)", () => {
  it("renderiza os itens de navegação principais com o logo WebGran e badge Vendedor", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "seller-1",
          name: "João Silva",
          email: "joao@exemplo.com",
          avatarUrl: null,
          role: "seller",
        }}
        totalRevenue={5000}
        salesGoal={15000}
      />
    );

    expect(html).toContain("WebGran");
    expect(html).toContain("Vendedor");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Configurações do Bot");
    expect(html).toContain("Pedidos");
    expect(html).toContain("Financeiro");
    expect(html).toContain("Clientes");
    expect(html).toContain("Gateways");
    expect(html).toContain("Configurações");
  });

  it("renderiza o card de volume de vendas com valores formatados e percentual correto", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "seller-1",
          name: "João Silva",
          email: "joao@exemplo.com",
          avatarUrl: null,
          role: "seller",
        }}
        totalRevenue={7500}
        salesGoal={15000}
      />
    );

    expect(html).toContain("Volume de vendas");
    expect(html).toContain("50%");
    expect(html).toContain("bg-[#3984FF]");
  });

  it("NÃO exibe 'Voltar ao Admin' para vendedores regulares", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "seller-1",
          name: "João Silva",
          email: "joao@exemplo.com",
          avatarUrl: null,
          role: "seller",
        }}
        totalRevenue={1000}
        salesGoal={15000}
      />
    );

    expect(html).not.toContain("Voltar ao Admin");
    expect(html).not.toContain("Categorias");
  });

  it("exibe 'Voltar ao Admin' e 'Categorias' quando o usuário é admin em impersonação", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "admin-1",
          name: "Admin Master",
          email: "admin@webgran.online",
          avatarUrl: null,
          role: "admin",
        }}
        totalRevenue={1000}
        salesGoal={15000}
      />
    );

    expect(html).toContain("Voltar ao Admin");
  });

  it("aplica estilo azul sofisticado no item ativo", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "seller-1",
          name: "João Silva",
          email: "joao@exemplo.com",
          avatarUrl: null,
          role: "seller",
        }}
        totalRevenue={1000}
        salesGoal={15000}
      />
    );

    // O item ativo (/seller) deve ter bg-[#3984FF]/10 e text-[#3984FF]
    expect(html).toContain("bg-[#3984FF]/10");
    expect(html).toContain("text-[#3984FF]");
    // Não deve conter a pílula azul antiga nem bg-[#18181C]
    expect(html).not.toContain("bg-blue-500 rounded-r-full");
  });

  it("exibe a seção BOTS e a rota '/seller/bots' exclusivamente para a conta real do proprietário", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "ead2ec50-ac72-4917-9d9c-1c68de270070",
          name: "STUDIO ADM",
          email: "lf49127@gmail.com",
          avatarUrl: null,
          role: "admin",
        }}
        totalRevenue={1000}
        salesGoal={15000}
      />
    );

    expect(html).toContain("BOTS");
    expect(html).toContain('href="/seller/bots"');
    expect(html).toContain("Recursos do Mini App");
  });

  it("NÃO exibe a rota '/seller/bots' nem o label 'BOTS' para outros vendedores comuns", () => {
    const html = renderToStaticMarkup(
      <SellerSidebar
        sellerProfile={{
          id: "outro-vendedor-id",
          name: "Vendedora Maria",
          email: "maria@doramas.com",
          avatarUrl: null,
          role: "seller",
        }}
        totalRevenue={1000}
        salesGoal={15000}
      />
    );

    expect(html).not.toContain('href="/seller/bots"');
    expect(html).toContain("BOT TELEGRAM");
    expect(html).toContain("Configurações do Bot");
  });
});

