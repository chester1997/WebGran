"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { StudioBottomNav } from "./components/StudioBottomNav";
import { FloatingPromotionNotification } from "./components/FloatingPromotionNotification";

interface StudioLayoutClientProps {
  storeSlug: string;
  children: ReactNode;
}

export function StudioLayoutClient({ storeSlug, children }: StudioLayoutClientProps) {
  const pathname = usePathname() || "";
  const isVideoPage = pathname.includes("/video/");

  if (isVideoPage) {
    return (
      <div className="flex flex-col h-dvh w-full bg-black text-white font-sans overflow-hidden relative studio-layout-root">
        <main className="flex-1 min-h-0 overflow-hidden relative z-10 w-full h-full pb-0">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f5f7] dark:bg-[#0d0e10] text-zinc-900 dark:text-white font-sans overflow-hidden relative studio-layout-root transition-colors duration-200">
      {/* HIGH-PERFORMANCE AMBIENT BACKGROUND */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden studio-ambient-bg bg-gradient-to-b from-[#f4f5f7] via-[#eef0f4] to-[#e4e7ec] dark:from-[#14161f] dark:via-[#0d0e10] dark:to-[#08090b] transition-colors duration-200"
      />

      {/* Scrollable Center Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-[calc(76px+env(safe-area-inset-bottom,0px))] relative z-10">
        {children}
      </main>

      {/* Floating Promotional Toasts */}
      <FloatingPromotionNotification storeSlug={storeSlug} />

      {/* Fixed Bottom Navigation Area */}
      <StudioBottomNav storeSlug={storeSlug} />
    </div>
  );
}
