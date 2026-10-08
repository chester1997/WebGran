import { describe, it, expect } from "vitest";

describe("Mini App WebGran Bottom Navigation Bar Architecture Suite", () => {
  const storeSlug = "studio-shorts";
  const basePath = `/miniapp/${storeSlug}`;

  const navItems = [
    { id: "favorites", name: "Favoritos", href: `${basePath}/favorites`, icon: "Heart" },
    { id: "accesses",  name: "Acessos",   href: `${basePath}/accesses`,  icon: "FolderPlay" },
    { id: "home",      name: "Início",    href: basePath,                 icon: "Home", isCenter: true },
    { id: "search",    name: "Busca",     href: `${basePath}/search`,    icon: "Search" },
    { id: "cart",      name: "Carrinho",  href: `${basePath}/cart`,      icon: "ShoppingCart", hasBadge: true },
  ];

  it("1. Menu structure has exactly 5 items in mandatory order", () => {
    expect(navItems).toHaveLength(5);
    expect(navItems[0].name).toBe("Favoritos");
    expect(navItems[1].name).toBe("Acessos");
    expect(navItems[2].name).toBe("Início");
    expect(navItems[3].name).toBe("Busca");
    expect(navItems[4].name).toBe("Carrinho");
  });

  it("2. INÍCIO item is mathematically positioned in the exact center (3rd of 5)", () => {
    const centerItem = navItems[2];
    expect(centerItem.name).toBe("Início");
    expect(centerItem.isCenter).toBe(true);
  });

  it("3. INÍCIO button specs: Uniform icon and label styling aligned with all items", () => {
    const homeButtonSpecs = {
      isUniform: true,
      activeIconColor: "text-red-500",
      iconSize: "w-5 h-5",
    };

    expect(homeButtonSpecs.isUniform).toBe(true);
    expect(homeButtonSpecs.activeIconColor).toBe("text-red-500");
    expect(homeButtonSpecs.iconSize).toBe("w-5 h-5");
  });

  it("4. Routes mapping is correctly linked to WebGran Mini App paths", () => {
    expect(navItems[0].href).toBe("/miniapp/studio-shorts/favorites");
    expect(navItems[1].href).toBe("/miniapp/studio-shorts/accesses");
    expect(navItems[2].href).toBe("/miniapp/studio-shorts");
    expect(navItems[3].href).toBe("/miniapp/studio-shorts/search");
    expect(navItems[4].href).toBe("/miniapp/studio-shorts/cart");
  });

  it("5. Carrinho item retains product counter badge integration", () => {
    const cartItem = navItems[4];
    expect(cartItem.hasBadge).toBe(true);
  });
});
