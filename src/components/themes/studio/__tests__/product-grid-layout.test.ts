import { describe, test, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Product Grid and ProductCard 3-Column Layout", () => {
  const rootDir = process.cwd();

  test("ProductCard has 3-row layout (Price line, Metrics space-between line, Button line)", () => {
    const cardPath = path.join(rootDir, "src", "components", "themes", "studio", "components", "ProductCard.tsx");
    const content = fs.readFileSync(cardPath, "utf-8");

    // Must default className to w-full or allow responsive grid width
    expect(content).toContain('className = "w-full"');

    // Row 1: Price
    expect(content).toContain("text-emerald-400 font-bold");

    // Row 2: Metrics line with justify-between
    expect(content).toContain("justify-between w-full min-w-0");
    expect(content).toContain("Eye");
    expect(content).toContain("Flame");

    // Row 3: Action button (+ Detalhes or Ver mais) with full width
    expect(content).toContain("+ Detalhes");
    expect(content).toContain("w-full");
  });

  test("Catalog views use 3-column grid container (grid-cols-3)", () => {
    const categoryPath = path.join(rootDir, "src", "components", "themes", "studio", "views", "StudioCategory.tsx");
    const categoryContent = fs.readFileSync(categoryPath, "utf-8");
    expect(categoryContent).toContain("grid grid-cols-3");

    const searchPath = path.join(rootDir, "src", "components", "themes", "studio", "views", "StudioSearch.tsx");
    const searchContent = fs.readFileSync(searchPath, "utf-8");
    expect(searchContent).toContain("grid grid-cols-3");

    const favoritesPath = path.join(rootDir, "src", "components", "themes", "studio", "views", "StudioFavorites.tsx");
    const favoritesContent = fs.readFileSync(favoritesPath, "utf-8");
    expect(favoritesContent).toContain("grid grid-cols-3");
  });
});
