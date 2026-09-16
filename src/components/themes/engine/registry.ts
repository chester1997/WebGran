import { ReactNode } from "react";

export interface ThemeConfig {
  slug: string;
  name: string;
  // Neste ponto os componentes ainda sǜo tipados como promises para lazy loading, 
  // mas como estamos usando RSC, podemos importar dinamicamente.
}

export const ThemeRegistry: Record<string, ThemeConfig> = {
  studio: {
    slug: 'studio',
    name: 'Studio',
  },
  // future themes:
  // cinema: { slug: 'cinema', name: 'Cinema' }
};

export function getThemeConfig(slug: string | null): ThemeConfig {
  if (!slug || !ThemeRegistry[slug]) {
    // Fallback sempre para Studio se não encontrar
    return ThemeRegistry['studio'];
  }
  return ThemeRegistry[slug];
}
