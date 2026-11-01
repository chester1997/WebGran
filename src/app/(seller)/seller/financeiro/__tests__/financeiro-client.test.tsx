import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FinanceiroClient from "../FinanceiroClient";

// Mock do useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock do SellerPageHeader
vi.mock("@/components/layout/SellerPageHeader", () => ({
  default: ({ title, subtitle, badge, actions }: any) => (
    <header data-testid="mock-seller-page-header">
      <div data-testid="header-title">{title}</div>
      <div data-testid="header-badge">{badge}</div>
      <div data-testid="header-subtitle">{subtitle}</div>
      <div data-testid="header-actions">{actions}</div>
    </header>
  ),
}));

const mockMetrics = {
  totalBruto: 1000.0,
  totalTaxa: 50.0,
  totalLiquido: 950.0,
  paidCount: 10,
  pendingCount: 2,
};

const mockTransactions = [
  {
    id: "tx-10000001",
    paymentId: "pay-1",
    paymentMethod: "mercadopago",
    customerName: "Alice Santos",
    total: 200.0,
    platformFee: 10.0,
    netAmount: 190.0,
    status: "paid",
    createdAt: "2026-11-01T10:00:00Z",
    paidAt: "2026-11-01T10:05:00Z",
  },
  {
    id: "tx-20000002",
    paymentId: "pay-2",
    paymentMethod: "syncpay",
    customerName: "Bruno Lima",
    total: 150.0,
    platformFee: 7.5,
    netAmount: 142.5,
    status: "pending",
    createdAt: "2026-11-01T11:00:00Z",
    paidAt: null,
  },
];

describe("FinanceiroClient Suite (Seller Design & Finance Tokens)", () => {
  it("1. Renderiza SellerPageHeader com título, contagem e ação de atualização", () => {
    const html = renderToStaticMarkup(
      <FinanceiroClient metrics={mockMetrics} transactions={mockTransactions} />
    );

    expect(html).toContain("Financeiro");
    expect(html).toContain("Acompanhe o faturamento líquido, vendas processadas e repasses da sua loja.");
    expect(html).toContain("2 registros");
    expect(html).toContain("Atualizar dados");
  });

  it("2. Exibe os cards de métricas financeiras com formatação em BRL e rótulos claros", () => {
    const html = renderToStaticMarkup(
      <FinanceiroClient metrics={mockMetrics} transactions={mockTransactions} />
    );

    expect(html).toContain("Saldo líquido repassado");
    expect(html).toContain("Vendas brutas processadas");
    expect(html).toContain("Status dos pedidos");
    expect(html).toContain("10");
    expect(html).toContain("pagos");
    expect(html).toContain("2");
    expect(html).toContain("pendentes");

    const cleanHtml = html.replace(/&nbsp;|\u00a0/g, " ");
    expect(cleanHtml).toContain("950,00");
    expect(cleanHtml).toContain("1.000,00");
  });

  it("3. Renderiza tabela com transações, gateways e pílulas de status", () => {
    const html = renderToStaticMarkup(
      <FinanceiroClient metrics={mockMetrics} transactions={mockTransactions} />
    );

    expect(html).toContain("Histórico de transações");
    expect(html).toContain("Alice Santos");
    expect(html).toContain("Bruno Lima");
    expect(html).toContain("Mercado Pago");
    expect(html).toContain("SyncPay");
    expect(html).toContain("Pago");
    expect(html).toContain("Pendente");
  });

  it("4. Exibe empty state quando não há transações", () => {
    const html = renderToStaticMarkup(
      <FinanceiroClient metrics={mockMetrics} transactions={[]} />
    );

    expect(html).toContain("0 registros");
    expect(html).toContain("Nenhuma transação encontrada para os filtros selecionados.");
  });
});
