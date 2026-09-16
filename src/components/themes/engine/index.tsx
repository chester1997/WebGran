import React, { ReactNode } from "react";
import { StudioLayout } from "../studio/StudioLayout";
import { StudioHome } from "../studio/views/StudioHome";
import { StudioSearch } from "../studio/views/StudioSearch";
import { StudioCart } from "../studio/views/StudioCart";
import { StudioAccesses } from "../studio/views/StudioAccesses";
import { StudioProfile } from "../studio/views/StudioProfile";

// Em um cenário multi-tema real, você faria uma query no banco para descobrir o themeId da loja,
// e então renderizaria o componente adequado (ex: return themes[storeTheme].Layout).
// Para esta etapa, como "Studio" é o tema principal e obrigatório, vamos rotear diretamente para ele.

export async function ThemeEngineLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  return <StudioLayout storeSlug={storeSlug}>{children}</StudioLayout>;
}

export async function ThemeEngineHome({ storeSlug }: { storeSlug: string }) {
  return <StudioHome storeSlug={storeSlug} />;
}

export async function ThemeEngineSearch({ storeSlug, q }: { storeSlug: string, q: string }) {
  return <StudioSearch storeSlug={storeSlug} q={q} />;
}

export async function ThemeEngineCart({ storeSlug }: { storeSlug: string }) {
  return <StudioCart storeSlug={storeSlug} />;
}

export async function ThemeEngineAccesses({ storeSlug }: { storeSlug: string }) {
  return <StudioAccesses storeSlug={storeSlug} />;
}

export async function ThemeEngineProfile({ storeSlug }: { storeSlug: string }) {
  return <StudioProfile storeSlug={storeSlug} />;
}

export async function ThemeEngineProduct({ storeSlug, productSlug }: { storeSlug: string, productSlug: string }) {
  const { StudioProduct } = await import("../studio/views/StudioProduct");
  return <StudioProduct storeSlug={storeSlug} productSlug={productSlug} />;
}

export async function ThemeEngineCategory({ storeSlug, categorySlug }: { storeSlug: string, categorySlug: string }) {
  const { StudioCategory } = await import("../studio/views/StudioCategory");
  return <StudioCategory storeSlug={storeSlug} categorySlug={categorySlug} />;
}
