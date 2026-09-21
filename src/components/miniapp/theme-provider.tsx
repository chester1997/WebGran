"use client";

import { createContext, useContext, ReactNode } from "react";

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
  return (
    <ThemeContext.Provider value={{ theme: defaultTheme }}>
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
