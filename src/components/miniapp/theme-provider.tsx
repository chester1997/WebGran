"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";

type ThemeType = "studio";

interface ThemeContextData {
  theme: ThemeType;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export function MiniAppThemeProvider({
  children,
  defaultTheme = "studio",
}: {
  children: ReactNode;
  defaultTheme?: ThemeType;
}) {
  const value = useMemo(() => ({ theme: defaultTheme }), [defaultTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <div className={`theme-${defaultTheme} min-h-screen bg-[#161616] text-foreground`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useMiniAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useMiniAppTheme must be used within a MiniAppThemeProvider");
  }
  return context;
}
