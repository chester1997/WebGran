import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SELLER_MENU_ICONS,
  SolarSellerDashboardIcon,
  SolarSellerBotIcon,
  SolarSellerProductsIcon,
  SolarSellerOrdersIcon,
} from "../seller-icons";

describe("Seller Solar Line Duotone Icons", () => {
  it("contém exatamente os 20 ícones necessários mapeados", () => {
    expect(SELLER_MENU_ICONS.length).toBe(20);
  });

  it("garante que cada ícone possui id line-duotone e componente SVG válido", () => {
    for (const item of SELLER_MENU_ICONS) {
      expect(item.id).toContain("line-duotone");
      expect(item.Component).toBeDefined();
      expect(item.label).toBeDefined();
      expect(item.section).toBeDefined();

      const html = renderToStaticMarkup(React.createElement(item.Component, { size: 18 }));
      expect(html).toContain("<svg");
      expect(html).toContain('width="18"');
      expect(html).toContain('height="18"');
      expect(html).toContain('viewBox="0 0 24 24"');
    }
  });

  it("renderiza ícones específicos com aliases e classes", () => {
    const html1 = renderToStaticMarkup(<SolarSellerDashboardIcon size={20} className="text-emerald-400" />);
    expect(html1).toContain('class="text-emerald-400"');
    expect(html1).toContain('width="20"');

    const html2 = renderToStaticMarkup(<SolarSellerBotIcon size={18} className="text-zinc-400" />);
    expect(html2).toContain('class="text-zinc-400"');
    expect(html2).toContain('width="18"');
  });
});


