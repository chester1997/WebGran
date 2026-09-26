"use client";

import { useState } from "react";

type IndicatorMode = "none" | "views" | "fire";

interface IndicatorTypePickerProps {
  /** name do input hidden que envia viewsCount */
  nameViews?: string;
  /** name do input hidden que envia showFire */
  nameFire?: string;
  initialType?: IndicatorMode;
  initialViews?: number;
}

export function IndicatorTypePicker({
  nameViews = "viewsCount",
  nameFire = "showFire",
  initialType = "none",
  initialViews = 0,
}: IndicatorTypePickerProps) {
  const [mode, setMode] = useState<IndicatorMode>(initialType);
  const [views, setViews] = useState<number>(initialViews);

  const options: { value: IndicatorMode; label: string; sub: string }[] = [
    { value: "none",  label: "Nenhum", sub: "Sem indicador" },
    { value: "views", label: "👁 Olho", sub: "Nº de visualizações" },
    { value: "fire",  label: "🔥 Fogo", sub: "Ícone de destaque" },
  ];

  return (
    <div className="space-y-3">
      {/* 3-way toggle */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 rounded-xl border text-center transition-all select-none
              ${mode === opt.value
                ? "border-blue-500 bg-blue-500/10 text-white"
                : "border-white/5 bg-[#1A1A1E] text-zinc-400 hover:border-white/15 hover:text-zinc-300"
              }`}
          >
            <span className="text-base leading-none">{opt.label}</span>
            <span className="text-[10px] leading-tight mt-0.5 font-medium">{opt.sub}</span>
          </button>
        ))}
      </div>

      {/* Views number input — só aparece quando modo = views */}
      {mode === "views" && (
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
            Número de visualizações exibido
          </label>
          <input
            type="number"
            min="0"
            value={views}
            onChange={e => setViews(Number(e.target.value))}
            placeholder="Ex: 46600 → exibe 👁 46.6K"
            className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
          />
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Valores: 1500 → 1.5K · 2400000 → 2.4M
          </span>
        </div>
      )}

      {/* Hidden inputs that are actually submitted in the form */}
      <input type="hidden" name={nameViews}  value={mode === "views" ? views : 0} />
      <input type="hidden" name={nameFire}   value={mode === "fire"  ? "true" : ""} />
    </div>
  );
}
