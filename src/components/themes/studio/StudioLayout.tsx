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
    <div className="flex flex-col h-full w-full bg-[#161616] text-white font-sans overflow-hidden relative">
      {/* Scrollable Center Content Area (Only scrollable container) */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-[calc(76px+1.25rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* Fixed Bottom Navigation Area */}
      <StudioBottomNav storeSlug={storeSlug} />
    </div>
  );
}
