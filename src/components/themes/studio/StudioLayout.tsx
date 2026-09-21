import React, { ReactNode } from "react";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StudioBottomNav } from "./components/StudioBottomNav";

export async function StudioLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) {
    notFound();
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0d0f] text-white font-sans overflow-hidden relative">
      {/* GLOBAL CINEMATIC FILM GRAIN NOISE & RADIAL DEPTH BACKGROUND */}
      <div 
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 15%, rgba(255, 255, 255, 0.025), transparent 60%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")
          `,
          backgroundRepeat: "no-repeat, repeat",
          backgroundSize: "cover, 200px 200px",
        }}
      />

      {/* Scrollable Center Content Area */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-[calc(76px+1.25rem+env(safe-area-inset-bottom,0px))] relative z-10">
        {children}
      </main>

      {/* Fixed Bottom Navigation Area */}
      <StudioBottomNav storeSlug={storeSlug} />
    </div>
  );
}
