"use client";

import React from "react";
import Link from "next/link";
import { Layers, ExternalLink, Check, Sparkles } from "lucide-react";
import { CarouselIconRenderer } from "@/lib/carousel-icons";

export interface CarouselOption {
  id: string;
  name: string;
  indicatorType?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
  status?: string | null;
}

interface ProductCarouselsPickerProps {
  carousels: CarouselOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ProductCarouselsPicker({
  carousels,
  selectedIds,
  onChange,
}: ProductCarouselsPickerProps) {
  const toggleCarousel = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-[#15171D] border border-white/[0.08] space-y-3 w-full">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Em quais carrosséis este produto deve aparecer?
        </label>
        {carousels.length > 0 && selectedIds.length > 0 && (
          <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            {selectedIds.length} selecionado{selectedIds.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 -mt-1 leading-relaxed">
        Selecione os carrosséis onde este produto será exibido na vitrine da loja. Você pode marcar múltiplos carrosséis ou nenhum.
      </p>

      {/* Hidden inputs to guarantee form serialization */}
      <input type="hidden" name="carouselIds_initialized" value="true" />
      <input type="hidden" name="carouselIds" value={JSON.stringify(selectedIds)} />

      {carousels.length === 0 ? (
        <div className="p-4 rounded-xl bg-[#0F1014] border border-white/[0.08] text-center space-y-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">
              Nenhum carrossel personalizado criado ainda
            </p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mt-0.5">
              Crie carrosséis para organizar sua vitrine em coleções temáticas como Lançamentos, Ofertas, Séries, etc.
            </p>
          </div>
          <div className="pt-1">
            <Link
              href="/seller/carousels"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-semibold transition-all hover:scale-[1.02]"
            >
              Criar meu primeiro carrossel
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-0.5">
          {carousels.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            const indicatorType = c.indicatorType || "BAR";
            const iconColor = c.iconColor || "#3B82F6";

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCarousel(c.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all group ${
                  isSelected
                    ? "bg-blue-500/10 border-blue-500/40 shadow-sm shadow-blue-500/5"
                    : "bg-[#0F1014] border-white/[0.08] hover:border-white/20 hover:bg-[#15171D]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {/* Indicator preview */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/5"
                    style={{
                      backgroundColor: `${iconColor}15`,
                    }}
                  >
                    {indicatorType === "ICON" && c.iconName ? (
                      <CarouselIconRenderer
                        iconName={c.iconName}
                        color={iconColor}
                        size={15}
                      />
                    ) : indicatorType === "NONE" ? (
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <div
                        className="w-1.5 h-3.5 rounded-full"
                        style={{ backgroundColor: iconColor }}
                      />
                    )}
                  </div>

                  <span
                    className={`text-xs font-medium truncate ${
                      isSelected ? "text-white" : "text-zinc-300 group-hover:text-zinc-200"
                    }`}
                  >
                    {c.name}
                  </span>
                </div>

                {/* Checkbox indicator */}
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "border border-zinc-600 bg-black/20 group-hover:border-zinc-500"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
