"use client";

import React, { useTransition } from "react";
import { toggleThemeStatus, setAsDefaultTheme } from "./actions";
import { Star, Image as ImageIcon, Sparkles, Smartphone, ShoppingBag, Layers } from "lucide-react";

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
      {initialThemes.map((theme) => {
        const isStudio = theme.slug === "studio";

        return (
          <div 
            key={theme.id} 
            className={`bg-[#141416] rounded-2xl overflow-hidden border border-[#27272A] shadow-xl transition-all duration-200 hover:border-[#3F3F46] flex flex-col justify-between ${
              theme.isDefault ? "ring-2 ring-red-500/50 border-red-500/30" : ""
            }`}
          >
            {/* PREVIEW IMAGE / MOCKUP */}
            <div className="aspect-video bg-[#0B0B0D] flex items-center justify-center text-gray-500 border-b border-[#27272A] relative overflow-hidden group">
              {theme.previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={theme.previewImageUrl} alt={theme.name} className="w-full h-full object-cover" />
              ) : (
                /* HIGH-FIDELITY STUDIO MINI APP UI MOCKUP */
                <div className="w-full h-full p-4 bg-gradient-to-br from-[#18181B] via-[#141416] to-[#0B0B0D] flex flex-col justify-between relative overflow-hidden select-none">
                  {/* Subtle Background Glow */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-600/15 rounded-full blur-2xl" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl" />

                  {/* Mock Mini App Top Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#27272A]/80 z-10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-red-600 flex items-center justify-center text-white font-black text-[9px]">W</div>
                      <span className="text-[11px] font-bold text-white tracking-tight">Loja Studio</span>
                    </div>
                    <span className="text-[9px] font-semibold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                      MINI APP
                    </span>
                  </div>

                  {/* Mock Banner Carousel */}
                  <div className="my-2 p-2 rounded-lg bg-gradient-to-r from-red-950/80 via-[#27272A] to-[#18181B] border border-red-500/20 flex items-center justify-between z-10">
                    <div>
                      <p className="text-[10px] font-bold text-white leading-tight">Banner de Destaque</p>
                      <p className="text-[8px] text-gray-400">Carrossel interativo WebGran</p>
                    </div>
                    <Sparkles className="w-3.5 h-3.5 text-red-400" />
                  </div>

                  {/* Mock Product Grid */}
                  <div className="grid grid-cols-2 gap-2 z-10">
                    <div className="p-1.5 rounded-lg bg-[#18181B] border border-[#27272A]">
                      <div className="h-6 bg-[#27272A] rounded mb-1 flex items-center justify-center">
                        <ShoppingBag className="w-3 h-3 text-gray-500" />
                      </div>
                      <div className="h-1.5 bg-gray-400/40 rounded w-3/4 mb-1" />
                      <div className="h-2 bg-emerald-500/40 rounded w-1/2" />
                    </div>

                    <div className="p-1.5 rounded-lg bg-[#18181B] border border-[#27272A]">
                      <div className="h-6 bg-[#27272A] rounded mb-1 flex items-center justify-center">
                        <Layers className="w-3 h-3 text-gray-500" />
                      </div>
                      <div className="h-1.5 bg-gray-400/40 rounded w-3/4 mb-1" />
                      <div className="h-2 bg-emerald-500/40 rounded w-1/2" />
                    </div>
                  </div>

                  {/* Watermark Label */}
                  <div className="text-center pt-1 z-10">
                    <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest">
                      WebGran Studio Engine Layout
                    </span>
                  </div>
                </div>
              )}
              
              {theme.isDefault && (
                <span className="absolute top-3 right-3 px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-1 z-20">
                  <Star className="w-3 h-3 fill-current text-white" />
                  Tema Padrão
                </span>
              )}
            </div>
            
            {/* CARD CONTENT */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg text-white">{theme.name}</h3>
                    {isStudio && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Em uso
                      </span>
                    )}
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    theme.isActive 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                  }`}>
                    {theme.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  {isStudio
                    ? "Tema Premium Oficial do WebGran. Layout utilizado e aprimorado em toda a plataforma com suporte a Mini App Telegram, carrosséis, banners de destaque e checkout integrado."
                    : theme.description || "Sem descrição informada"}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[11px] font-mono text-gray-400 bg-[#18181B] px-2.5 py-1 rounded-lg border border-[#27272A] inline-block">
                    slug: {theme.slug}
                  </div>
                  {isStudio && (
                    <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-red-400" />
                      Optimized for Mini App
                    </span>
                  )}
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
        );
      })}
    </div>
  );
}
