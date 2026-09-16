import React from "react";
import { db } from "@/db";
import { products, categories, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Plus, Share2 } from "lucide-react";

export async function StudioProduct({ storeSlug, productSlug }: { storeSlug: string, productSlug: string }) {
  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, storeSlug)
  });

  if (!store) notFound();

  const product = await db.query.products.findFirst({
    where: and(eq(products.storeId, store.id), eq(products.slug, productSlug)),
    with: {
      category: true
    }
  });

  if (!product) notFound();

  const bgImage = product.bannerUrl || product.coverUrl || "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop";

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white pb-24">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <Link href={`/miniapp/${storeSlug}`} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      {/* Top Banner */}
      <div className="relative w-full aspect-video md:h-[50vh] max-h-[600px]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
      </div>

      <div className="px-4 -mt-12 relative z-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{product.title}</h1>
          <div className="flex items-center gap-3 text-sm text-zinc-400 font-medium">
            <span className="text-green-500 font-bold">Lançamento</span>
            <span>{product.category?.name || "Geral"}</span>
            <span className="px-1.5 py-0.5 border border-zinc-600 text-zinc-300 rounded text-[10px]">HD</span>
          </div>
        </div>

        <div className="space-y-3">
          <button className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-md hover:bg-zinc-200 transition-colors">
            <Play className="w-5 h-5 fill-black" />
            <div className="flex flex-col items-center leading-tight">
              <span>Comprar por R$ {Number(product.price).toFixed(2)}</span>
              {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                <span className="text-[10px] line-through text-zinc-500 font-normal">de R$ {Number(product.compareAtPrice).toFixed(2)}</span>
              )}
            </div>
          </button>
          
          <div className="flex gap-4">
            <button className="flex-1 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-white py-2">
              <Plus className="w-6 h-6" />
              <span className="text-xs">Minha Lista</span>
            </button>
            <button className="flex-1 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-white py-2">
              <Share2 className="w-6 h-6" />
              <span className="text-xs">Compartilhar</span>
            </button>
          </div>
        </div>

        <div className="text-sm text-zinc-300 leading-relaxed">
          {product.description || product.shortDescription || "Sem descrição disponível."}
        </div>
      </div>
    </div>
  );
}
