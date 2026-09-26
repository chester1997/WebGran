import { ReactNode, Suspense } from "react";
import { MiniAppThemeProvider } from "@/components/miniapp/theme-provider";

export default function MiniAppLayout({ children }: { children: ReactNode }) {
  return (
    <MiniAppThemeProvider defaultTheme="studio">
      <div className="max-w-md mx-auto w-full h-[100dvh] relative shadow-xl overflow-hidden bg-[#0d0d0f] flex flex-col">
        <Suspense fallback={<div className="w-full h-full bg-[#0d0d0f] animate-pulse" />}>
          {children}
        </Suspense>
      </div>
    </MiniAppThemeProvider>
  );
}


