import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

vi.mock("../seller/actions", () => ({ getDashboardAnalyticsAction: vi.fn() }));
vi.mock("@/components/analytics/SellerMetricsOverview", () => ({ SellerMetricsOverview: () => null }));
vi.mock("@/components/analytics/SellerActivityAndChannels", () => ({ SellerActivityAndChannels: () => null }));
// O cabeçalho real vai por portal; aqui renderiza no lugar para inspecionar o conteúdo.
vi.mock("@/components/layout/SellerPageHeader", () => ({
  default: (p: { children?: ReactNode; title?: ReactNode; actions?: ReactNode }) => (
    <header data-mode={p.children ? "custom" : "legacy"}>
      {p.children ?? (
        <>
          {p.title}
          {p.actions}
        </>
      )}
    </header>
  ),
}));

import { DashboardClient } from "../seller/DashboardClient";
import MobileTopBarV2 from "../MobileTopBarV2";

const data = { userName: "STUDIO ADM", storeName: "Loja", period: "30D", channels: [] } as never;
const bots = [{ id: "b1", username: "aguia", displayName: "AGUIA MARKETING" }];

describe("cabeçalho do painel", () => {
  it("conta proprietária: filtros viram botões de ícone ao lado da saudação", () => {
    const html = renderToStaticMarkup(<DashboardClient initialData={data} bots={bots} isOwner />);
    expect(html).toContain('data-mode="custom"');
    expect(html).toContain('aria-label="Filtrar por bot: Todos os bots"');
    expect(html).toContain("linear-gradient(135deg, #1d4ed8 0%, #3b82f6 55%, #60a5fa 100%)");
    expect(html).toContain('aria-label="Período: Últimos 30 dias"');
    expect(html).toContain(">30D</span>");
    expect(html).not.toContain("<select");
  });

  it("demais vendedores: continuam com o seletor e o botão de período antigos", () => {
    const html = renderToStaticMarkup(<DashboardClient initialData={data} bots={bots} />);
    expect(html).toContain('data-mode="legacy"');
    expect(html).toContain("<select");
    expect(html).toContain("Todos os bots");
  });
});

describe("MobileTopBarV2", () => {
  it("mostra menu, logo e avatar com anel azul", () => {
    const html = renderToStaticMarkup(
      <MobileTopBarV2 hidden={false} drawerOpen={false} onToggleDrawer={() => {}} initialLetter="S" />,
    );
    expect(html).toContain('aria-label="Abrir menu"');
    expect(html).toContain("Painel do Vendedor");
    expect(html).toContain('href="/seller/settings"');
    expect(html).toContain(">S<");
  });
});
