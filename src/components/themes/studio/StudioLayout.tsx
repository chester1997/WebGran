import React, { ReactNode } from "react";
import { notFound } from "next/navigation";
import { StudioBottomNav } from "./components/StudioBottomNav";
import { FloatingPromotionNotification } from "./components/FloatingPromotionNotification";
import { getStoreBySlug } from "@/lib/store-cache";

export async function StudioLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const store = await getStoreBySlug(storeSlug);

  if (!store) {
    notFound();
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
