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

export async function ThemeEngineHome({ storeSlug, originBotId }: { storeSlug: string; originBotId?: string | null }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioHome storeSlug={storeSlug} originBotId={originBotId} />;
  return <StudioHome storeSlug={storeSlug} originBotId={originBotId} />;
}

export async function ThemeEngineSearch({ storeSlug, q, originBotId }: { storeSlug: string; q: string; originBotId?: string | null }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioSearch storeSlug={storeSlug} q={q} originBotId={originBotId} />;
  return <StudioSearch storeSlug={storeSlug} q={q} originBotId={originBotId} />;
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

export async function ThemeEngineFavorites({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') {
    const { StudioFavorites } = await import("../studio/views/StudioFavorites");
    return <StudioFavorites storeSlug={storeSlug} />;
  }
  const { StudioFavorites } = await import("../studio/views/StudioFavorites");
  return <StudioFavorites storeSlug={storeSlug} />;
}

export async function ThemeEngineProfile({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') return <StudioProfile storeSlug={storeSlug} />;
  return <StudioProfile storeSlug={storeSlug} />;
}

export async function ThemeEngineProduct({ storeSlug, productSlug, originBotId }: { storeSlug: string; productSlug: string; originBotId?: string | null }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') {
    const { StudioProduct } = await import("../studio/views/StudioProduct");
    return <StudioProduct storeSlug={storeSlug} productSlug={productSlug} originBotId={originBotId} />;
  }
  const { StudioProduct } = await import("../studio/views/StudioProduct");
  return <StudioProduct storeSlug={storeSlug} productSlug={productSlug} originBotId={originBotId} />;
}

export async function ThemeEngineCategory({ storeSlug, categorySlug, originBotId }: { storeSlug: string; categorySlug: string; originBotId?: string | null }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') {
    const { StudioCategory } = await import("../studio/views/StudioCategory");
    return <StudioCategory storeSlug={storeSlug} categorySlug={categorySlug} originBotId={originBotId} />;
  }
  const { StudioCategory } = await import("../studio/views/StudioCategory");
  return <StudioCategory storeSlug={storeSlug} categorySlug={categorySlug} originBotId={originBotId} />;
}

export async function ThemeEngineClips({ storeSlug }: { storeSlug: string }) {
  const theme = await getResolvedThemeSlug(storeSlug);
  if (theme === 'studio') {
    const { StudioClips } = await import("../studio/views/StudioClips");
    return <StudioClips storeSlug={storeSlug} />;
  }
  const { StudioClips } = await import("../studio/views/StudioClips");
  return <StudioClips storeSlug={storeSlug} />;
}

