"use client";

import { useState } from "react";

interface IndicatorTypePickerProps {
  initialShowViews?: boolean;
  initialViewsCount?: number;
  initialShowFire?: boolean;
  initialFireCount?: number;
}

export function IndicatorTypePicker({
  initialShowViews = false,
  initialViewsCount = 0,
  initialShowFire = false,
  initialFireCount = 0,
}: IndicatorTypePickerProps) {
  const [showViews, setShowViews] = useState<boolean>(initialShowViews);
  const [viewsCount, setViewsCount] = useState<number>(initialViewsCount);
  const [showFire, setShowFire] = useState<boolean>(initialShowFire);
  const [fireCount, setFireCount] = useState<number>(initialFireCount);

  return (
    <div className="space-y-3">
      {/* Selector Cards for Eye and Fire */}
      <div className="grid grid-cols-2 gap-2.5 w-full">
        {/* Option 1: Olho (Visualizações) */}
        <button
          type="button"
          onClick={() => setShowViews(!showViews)}
          className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all select-none cursor-pointer ${
            showViews
              ? "border-sky-500/50 bg-sky-500/10 text-white shadow-sm shadow-sky-500/10"
              : "border-white/5 bg-[#1A1A1E] text-zinc-400 hover:border-white/15 hover:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base leading-none">👁</span>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight">Visualizações (👁)</p>
              <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Exibir número de views</p>
            </div>
          </div>
          <div
            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold ${
              showViews ? "border-sky-400 bg-sky-400 text-black" : "border-zinc-600 bg-transparent"
            }`}
          >
            {showViews && "✓"}
          </div>
        </button>

        {/* Option 2: Foguinho (Em Alta / Destaque) */}
        <button
          type="button"
          onClick={() => setShowFire(!showFire)}
          className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all select-none cursor-pointer ${
            showFire
              ? "border-amber-500/50 bg-amber-500/10 text-white shadow-sm shadow-amber-500/10"
              : "border-white/5 bg-[#1A1A1E] text-zinc-400 hover:border-white/15 hover:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base leading-none">🔥</span>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight">Foguinho (🔥)</p>
              <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Exibir destaque em alta</p>
            </div>
          </div>
          <div
            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold ${
              showFire ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-600 bg-transparent"
            }`}
          >
            {showFire && "✓"}
          </div>
        </button>
      </div>

      {/* Input Number for Olho (👁) */}
      {showViews && (
        <div className="space-y-1 p-3 rounded-xl bg-[#15151A] border border-sky-500/20">
          <label className="block text-[10px] font-bold text-sky-400 uppercase tracking-wider">
            Número de Visualizações (👁)
          </label>
          <input
            type="number"
            min="0"
            value={viewsCount}
            onChange={(e) => setViewsCount(Number(e.target.value))}
            placeholder="Ex: 46600 (exibe 👁 46.6K)"
            className="w-full bg-[#1A1A1E] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-all font-mono font-bold"
          />
        </div>
      )}

      {/* Input Number for Foguinho (🔥) */}
      {showFire && (
        <div className="space-y-1 p-3 rounded-xl bg-[#15151A] border border-amber-500/20">
          <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Número do Foguinho (🔥)
          </label>
          <input
            type="number"
            min="0"
            value={fireCount}
            onChange={(e) => setFireCount(Number(e.target.value))}
            placeholder="Ex: 12400 (exibe 🔥 12.4K)"
            className="w-full bg-[#1A1A1E] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-all font-mono font-bold"
          />
        </div>
      )}

      {/* Hidden inputs submitted in form */}
      <input type="hidden" name="showViews" value={showViews ? "true" : "false"} />
      <input type="hidden" name="viewsCount" value={showViews ? viewsCount : 0} />
      <input type="hidden" name="showFire" value={showFire ? "true" : "false"} />
      <input type="hidden" name="fireCount" value={showFire ? fireCount : 0} />
    </div>
  );
}
