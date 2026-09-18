import { ReactNode } from "react";
import { MiniAppThemeProvider } from "@/components/miniapp/theme-provider";

export default function MiniAppLayout({ children }: { children: ReactNode }) {
  return (
    <MiniAppThemeProvider defaultTheme="studio">
      <div className="max-w-md mx-auto w-full h-[100dvh] relative shadow-xl overflow-hidden bg-background flex flex-col">
        {children}
      </div>
    </MiniAppThemeProvider>
  );
}
