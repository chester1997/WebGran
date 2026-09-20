"use client";

import React, { useTransition } from "react";
import { toggleThemeStatus, setAsDefaultTheme } from "./actions";
import { Palette, CheckCircle2, Star, Image as ImageIcon } from "lucide-react";

export function ThemeList({ initialThemes }: { initialThemes: any[] }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleThemeStatus(id, !currentStatus);
      if (res.error) alert(res.error);
    });
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const res = await setAsDefaultTheme(id);
      if (res.error) alert(res.error);
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {initialThemes.map((theme) => (
        <div 
          key={theme.id} 
          className={`bg-[#141416] rounded-2xl overflow-hidden border border-[#27272A] shadow-xl transition-all duration-200 hover:border-[#3F3F46] flex flex-col justify-between ${
            theme.isDefault ? "ring-2 ring-red-500/50 border-red-500/30" : ""
          }`}
        >
          {/* PREVIEW IMAGE */}
          <div className="aspect-video bg-[#18181B] flex items-center justify-center text-gray-500 border-b border-[#27272A] relative">
            {theme.previewImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.previewImageUrl} alt={theme.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-gray-500">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <span className="text-xs font-semibold">Sem Preview</span>
              </div>
            )}
            
            {theme.isDefault && (
              <span className="absolute top-3 right-3 px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-1">
                <Star className="w-3 h-3 fill-current text-white" />
                Tema Padrão
              </span>
            )}
          </div>
          
          {/* CARD CONTENT */}
          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-black text-lg text-white">{theme.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  theme.isActive 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                }`}>
                  {theme.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 min-h-[32px]">
                {theme.description || "Sem descrição informada"}
              </p>
              <div className="mt-2 text-[11px] font-mono text-gray-500 bg-[#18181B] px-2.5 py-1 rounded-lg border border-[#27272A] inline-block">
                slug: {theme.slug}
              </div>
            </div>

            {/* BUTTON ACTIONS */}
            <div className="flex items-center gap-2 pt-4 border-t border-[#27272A]">
              <button 
                disabled={isPending || theme.isDefault}
                onClick={() => handleToggle(theme.id, theme.isActive)}
                className="flex-1 py-2 px-3 rounded-xl border border-[#27272A] bg-[#18181B] hover:bg-[#27272A] text-gray-300 hover:text-white text-xs font-semibold transition-all disabled:opacity-40"
              >
                {theme.isActive ? "Desativar" : "Ativar"}
              </button>
              
              <button 
                disabled={isPending || theme.isDefault || !theme.isActive}
                onClick={() => handleSetDefault(theme.id)}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-900/30 transition-all disabled:opacity-40"
              >
                Definir Padrão
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
