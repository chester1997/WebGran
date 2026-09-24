import React, { ReactNode } from "react";
import { notFound } from "next/navigation";
import { StudioBottomNav } from "./components/StudioBottomNav";
import { getStoreBySlug } from "@/lib/store-cache";

export async function StudioLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const store = await getStoreBySlug(storeSlug);

  if (!store) {
    notFound();
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0e10] text-white font-sans overflow-hidden relative">
      {/* GLOBAL BLURRED AMBIENT BACKGROUND IMAGE */}
      <div 
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden"
      >
        <img
          src="/miniapp-bg.png"
          alt=""
          className="w-full h-full object-cover blur-2xl scale-110 opacity-90"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Scrollable Center Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-[calc(68px+env(safe-area-inset-bottom,0px)+8px)] relative z-10">
        {children}
      </main>

      {/* Fixed Bottom Navigation Area */}
      <StudioBottomNav storeSlug={storeSlug} />
    </div>
  );
}
