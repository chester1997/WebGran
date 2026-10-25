"use client";

import React from "react";
import { Boxes, Sparkles } from "lucide-react";
import { ActiveComboDTO } from "@/lib/combos/combo-service";
import { ComboCard } from "./ComboCard";

interface CombosCarouselProps {
  combos: ActiveComboDTO[];
  storeSlug: string;
}

export function CombosCarousel({ combos, storeSlug }: CombosCarouselProps) {
  if (!combos || combos.length === 0) return null;

  return (
    <section className="w-full max-w-[460px] mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Boxes className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Combos Promocionais</span>
              <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                Economia
              </span>
            </h3>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar px-4 scroll-smooth pb-2">
        {combos.map((combo) => (
          <ComboCard key={combo.id} combo={combo} storeSlug={storeSlug} />
        ))}
      </div>
    </section>
  );
}
