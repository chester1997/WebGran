import React, { ReactNode } from "react";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getThemeConfig } from "./registry";

import { StudioLayout } from "../studio/StudioLayout";
import { StudioHome } from "../studio/views/StudioHome";
import { StudioSearch } from "../studio/views/StudioSearch";
import { StudioCart } from "../studio/views/StudioCart";
import { StudioAccesses } from "../studio/views/StudioAccesses";
import { StudioProfile } from "../studio/views/StudioProfile";

import { getStoreBySlug } from "@/lib/store-cache";

async function getResolvedThemeSlug(storeSlug: string) {
  const store = await getStoreBySlug(storeSlug);
  const themeSlug = store?.theme?.slug || null;
  const config = getThemeConfig(themeSlug);
  return config.slug;
}

export async function ThemeEngineLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  
  if (theme === 'studio') {
    return <StudioLayout storeSlug={storeSlug}>{children}</StudioLayout>;
  }
  // Fallback if we add more themes in the future
  return <StudioLayout storeSlug={storeSlug}>{children}</StudioLayout>;
}

export async function ThemeEngineHome({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioHome storeSlug={storeSlug} />;
  return <StudioHome storeSlug={storeSlug} />;
}

export async function ThemeEngineSearch({ storeSlug, q }: { storeSlug: string, q: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioSearch storeSlug={storeSlug} q={q} />;
  return <StudioSearch storeSlug={storeSlug} q={q} />;
}

export async function ThemeEngineCart({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioCart storeSlug={storeSlug} />;
  return <StudioCart storeSlug={storeSlug} />;
}

export async function ThemeEngineAccesses({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioAccesses storeSlug={storeSlug} />;
  return <StudioAccesses storeSlug={storeSlug} />;
}

export async function ThemeEngineProfile({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioProfile storeSlug={storeSlug} />;
  return <StudioProfile storeSlug={storeSlug} />;
}

export async function ThemeEngineProduct({ storeSlug, productSlug }: { storeSlug: string, productSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') {
    const { StudioProduct } = await import("../studio/views/StudioProduct");
    return <StudioProduct storeSlug={storeSlug} productSlug={productSlug} />;
  }
  const { StudioProduct } = await import("../studio/views/StudioProduct");
  return <StudioProduct storeSlug={storeSlug} productSlug={productSlug} />;
}

export async function ThemeEngineCategory({ storeSlug, categorySlug }: { storeSlug: string, categorySlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') {
    const { StudioCategory } = await import("../studio/views/StudioCategory");
    return <StudioCategory storeSlug={storeSlug} categorySlug={categorySlug} />;
  }
  const { StudioCategory } = await import("../studio/views/StudioCategory");
  return <StudioCategory storeSlug={storeSlug} categorySlug={categorySlug} />;
}
