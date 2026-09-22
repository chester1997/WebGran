"use client";

import { useState, useTransition } from "react";
import { updateCategoryDisplayStyleAction } from "./actions";
import { Image as ImageIcon, LayoutGrid, Check } from "lucide-react";

interface CategoryStyleToggleProps {
  initialStyle: "IMAGE" | "ICON";
}

export function CategoryStyleToggle({ initialStyle }: CategoryStyleToggleProps) {
  const [style, setStyle] = useState<"IMAGE" | "ICON">(initialStyle || "IMAGE");
  const [isPending, startTransition] = useTransition();

  const handleSelect = (newStyle: "IMAGE" | "ICON") => {
    if (newStyle === style) return;
    setStyle(newStyle);
    startTransition(async () => {
      try {
        await updateCategoryDisplayStyleAction(newStyle);
      } catch (err) {
        console.error("Erro ao atualizar estilo de exibição:", err);
      }
    });
  };

  return (
    <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
            Estilo das Categorias no Mini App
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Escolha como suas categorias serão apresentadas para os clientes na vitrine da loja.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-[#0A0A0C] border border-white/10 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleSelect("IMAGE")}
            disabled={isPending}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              style === "IMAGE"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Imagens (1:1 Transparentes)</span>
            {style === "IMAGE" && <Check className="w-3.5 h-3.5 ml-1" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelect("ICON")}
            disabled={isPending}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              style === "ICON"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Ícones + Nomes</span>
            {style === "ICON" && <Check className="w-3.5 h-3.5 ml-1" />}
          </button>
        </div>
      </div>
    </div>
  );
}
