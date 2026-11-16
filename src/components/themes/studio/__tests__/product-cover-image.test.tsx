import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductCoverImage } from "../components/ProductCoverImage";
import fs from "fs";
import path from "path";

describe("ProductCoverImage — Mini App Resilient Image Delivery Suite", () => {
  it("1. Renderiza o placeholder cinematográfico quando coverUrl é nulo ou vazio", () => {
    const html = renderToStaticMarkup(
      <ProductCoverImage src={null} alt="Dorama Sem Capa" />
    );

    // Não deve conter a tag <img>
    expect(html).not.toContain("<img");

    // Deve conter container com aspect-[2/3] e aria-label
    expect(html).toContain('aria-label="Dorama Sem Capa"');
    expect(html).toContain("aspect-[2/3]");
    expect(html).toContain("Série");
  });

  it("2. Renderiza tag <img> com loading lazy e classes corretas quando src é fornecido", () => {
    const html = renderToStaticMarkup(
      <ProductCoverImage
        src="https://webgran-images.b-cdn.net/stores/store-1/products/capa.jpg"
        alt="O CEO Alfa Dominador"
      />
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="https://webgran-images.b-cdn.net/stores/store-1/products/capa.jpg"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    // alt deve ser vazio e aria-hidden para não sobrepor o título textual do card em caso de renderização nativa
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("aspect-[2/3]");
  });

  it("3. Renderiza container com aspect-[2/3] consistente e skeleton de carregamento", () => {
    const html = renderToStaticMarkup(
      <ProductCoverImage
        src="https://webgran-images.b-cdn.net/stores/store-1/products/capa.jpg"
        alt="Série Teste"
      />
    );

    expect(html).toContain("aspect-[2/3]");
    expect(html).toContain("animate-pulse");
  });

  it("4. Garante que ProductCard.tsx utiliza ProductCoverImage preservando aspect-[2/3]", () => {
    const cardPath = path.join(process.cwd(), "src/components/themes/studio/components/ProductCard.tsx");
    const content = fs.readFileSync(cardPath, "utf-8");

    expect(content).toContain("ProductCoverImage");
    expect(content).toContain('aspectRatioClass="aspect-[2/3]"');
    expect(content).not.toContain("Sem capa"); // Removido fallback rudimentar
  });

  it("5. Garante que TopTenCarousel.tsx utiliza ProductCoverImage preservando aspect-[2/3]", () => {
    const topTenPath = path.join(process.cwd(), "src/components/themes/studio/components/TopTenCarousel.tsx");
    const content = fs.readFileSync(topTenPath, "utf-8");

    expect(content).toContain("ProductCoverImage");
    expect(content).toContain('aspectRatioClass="aspect-[2/3]"');
  });

  it("6. Garante que StudioCart e StudioAccessCard integram ProductCoverImage", () => {
    const cartPath = path.join(process.cwd(), "src/components/themes/studio/views/StudioCart.tsx");
    const cartContent = fs.readFileSync(cartPath, "utf-8");
    expect(cartContent).toContain("ProductCoverImage");

    const accessPath = path.join(process.cwd(), "src/components/themes/studio/views/StudioAccessCard.tsx");
    const accessContent = fs.readFileSync(accessPath, "utf-8");
    expect(accessContent).toContain("ProductCoverImage");
  });
});
