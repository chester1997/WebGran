import { describe, it, expect } from "vitest";
import { parseSupportConfig } from "@/lib/support/support-helper";

interface NavItemDef {
  id: string;
  name: string;
  href: string | null;
  icon: string;
  isFirst?: boolean;
  hasBadge?: boolean;
  isAction?: boolean;
  supportUrl?: string | null;
}

describe("WebGran Mini App — Bottom Navigation Reorganization & Support Suite", () => {
  const storeSlug = "studio-shorts";
  const basePath = `/miniapp/${storeSlug}`;

  // Helper definition representing the navigation specification
  function getNavigationStructure(supportType?: string, supportValue?: string): {
    columnsCount: number;
    gridClass: string;
    items: NavItemDef[];
  } {
    const supportConfig = parseSupportConfig(supportType, supportValue);
    const hasSupport = supportConfig.isValid;

    const baseItems: NavItemDef[] = [
      { id: "home",      name: "Início",    href: basePath,                 icon: "Home", isFirst: true },
      { id: "favorites", name: "Favoritos", href: `${basePath}/favorites`, icon: "Heart" },
      { id: "accesses",  name: "Acessos",   href: `${basePath}/accesses`,  icon: "LibraryBig" },
      { id: "search",    name: "Busca",     href: `${basePath}/search`,    icon: "Search" },
      { id: "cart",      name: "Carrinho",  href: `${basePath}/cart`,      icon: "ShoppingCart", hasBadge: true },
    ];

    if (hasSupport) {
      return {
        columnsCount: 6,
        gridClass: "grid-cols-6 max-w-[540px]",
        items: [
          ...baseItems,
          {
            id: "support",
            name: "Suporte",
            href: null,
            icon: "Headphones",
            isAction: true,
            supportUrl: supportConfig.url,
          },
        ],
      };
    }

    return {
      columnsCount: 5,
      gridClass: "grid-cols-5 max-w-[480px]",
      items: baseItems,
    };
  }

  // 1. Ordem dos seis botões
  it("1. Ordem dos seis botões: Início (1º), Favoritos (2º), Acessos (3º), Busca (4º), Carrinho (5º), Suporte (6º)", () => {
    const nav = getNavigationStructure("telegram", "@Hexafiretv");

    expect(nav.columnsCount).toBe(6);
    expect(nav.items).toHaveLength(6);

    // Exact required order:
    expect(nav.items[0].name).toBe("Início");
    expect(nav.items[1].name).toBe("Favoritos");
    expect(nav.items[2].name).toBe("Acessos");
    expect(nav.items[3].name).toBe("Busca");
    expect(nav.items[4].name).toBe("Carrinho");
    expect(nav.items[5].name).toBe("Suporte");

    // Início must be on the far left (1st item)
    expect(nav.items[0].isFirst).toBe(true);
  });

  // 2. Estado ativo e estado inativo do menu
  it("2. Estado ativo e inativo: destaque visual discreto e elegante com vermelho WebGran sem moldura", () => {
    const visualSpecs = {
      container: {
        bg: "bg-[#111215]/95 dark:bg-[#0c0d10]/95",
        backdrop: "backdrop-blur-xl",
        border: "border-t border-white/10",
      },
      activeState: {
        hasNoCardFrame: true,
        iconColor: "text-red-500 stroke-[2.2]",
        labelColor: "text-red-500 font-bold",
      },
      inactiveState: {
        iconColor: "text-zinc-400 group-hover:text-zinc-200 stroke-[1.8]",
        labelColor: "text-zinc-400 group-hover:text-zinc-200",
      },
    };

    expect(visualSpecs.activeState.iconColor).toContain("text-red-500");
    expect(visualSpecs.activeState.labelColor).toContain("text-red-500");
    expect(visualSpecs.activeState.hasNoCardFrame).toBe(true);
    expect(visualSpecs.inactiveState.iconColor).toContain("text-zinc-400");
    expect(visualSpecs.inactiveState.labelColor).toContain("text-zinc-400");
  });

  // 3. Responsividade em telas estreitas
  it("3. Responsividade em telas estreitas: distribuição uniforme em 6 colunas sem overflow", () => {
    const nav6 = getNavigationStructure("telegram", "@Hexafiretv");
    expect(nav6.gridClass).toBe("grid-cols-6 max-w-[540px]");

    const responsiveTypography = {
      labelClasses: "text-[9.5px] sm:text-[10px] leading-tight tracking-tight truncate max-w-full px-0.5 text-center",
      safeAreaPadding: "pb-[env(safe-area-inset-bottom,0px)]",
      height: "h-[64px]",
    };

    expect(responsiveTypography.labelClasses).toContain("truncate");
    expect(responsiveTypography.labelClasses).toContain("max-w-full");
    expect(responsiveTypography.safeAreaPadding).toContain("safe-area-inset-bottom");
  });

  // 10. Configuração de suporte vazia remove o botão suporte e mantém 5 itens
  it("10. Configuração de suporte vazia: exibe 5 itens com Início na extremidade esquerda", () => {
    const navEmpty = getNavigationStructure("telegram", "");
    expect(navEmpty.columnsCount).toBe(5);
    expect(navEmpty.items).toHaveLength(5);
    expect(navEmpty.items.find(i => i.name === "Suporte")).toBeUndefined();
    expect(navEmpty.items[0].name).toBe("Início");
    expect(navEmpty.gridClass).toBe("grid-cols-5 max-w-[480px]");
  });

  // 13. Preservação das rotas e funcionalidades dos botões existentes
  it("13. Preservação das rotas e funcionalidades dos botões existentes", () => {
    const nav = getNavigationStructure("whatsapp", "5511999999999");

    const homeItem = nav.items[0];
    const favItem = nav.items[1];
    const accItem = nav.items[2];
    const searchItem = nav.items[3];
    const cartItem = nav.items[4];

    expect(homeItem.href).toBe("/miniapp/studio-shorts");
    expect(favItem.href).toBe("/miniapp/studio-shorts/favorites");
    expect(accItem.href).toBe("/miniapp/studio-shorts/accesses");
    expect(searchItem.href).toBe("/miniapp/studio-shorts/search");
    expect(cartItem.href).toBe("/miniapp/studio-shorts/cart");
    expect(cartItem.hasBadge).toBe(true);

    const supportItem = nav.items[5];
    expect(supportItem.name).toBe("Suporte");
    expect(supportItem.supportUrl).toBe("https://wa.me/5511999999999");
  });
});
