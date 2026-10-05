import React, { ReactNode } from "react";
import { notFound } from "next/navigation";
import { StudioLayoutClient } from "./StudioLayoutClient";
import { getStoreBySlug } from "@/lib/store-cache";

export async function StudioLayout({ storeSlug, children }: { storeSlug: string, children: ReactNode }) {
  const store = await getStoreBySlug(storeSlug);

  if (!store) {
    notFound();
  }

  return <StudioLayoutClient storeSlug={storeSlug}>{children}</StudioLayoutClient>;
}
