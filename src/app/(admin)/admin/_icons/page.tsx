import React from "react";
import { SOLAR_MENU_ICONS } from "@/components/icons/solar";

export default function SolarIconsPreviewPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-[#0B0D13] min-h-screen text-white">
      <div className="border-b border-white/[0.08] pb-4 space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Prévia dos Ícones Solar Bold Duotone (480 Design)</span>
          <span className="text-[10px] bg-blue-500/10 text-blue-400 font-mono px-2 py-0.5 rounded border border-blue-500/20">
            CC BY 4.0
          </span>
        </h1>
        <p className="text-xs text-zinc-400">
          Visualização dos 17 ícones oficiais Solar Bold Duotone extraídos do pacote @iconify-json/solar.
          Comparativo nos tamanhos 16px (padrão atual) e 18px, nas cores inativo (cinza) e ativo (azul).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOLAR_MENU_ICONS.map((item, idx) => {
          const Icon = item.Component;
          return (
            <div
              key={item.id}
              className="bg-[#12141C] border border-white/[0.06] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-zinc-500">#{idx + 1}</span>
                  <h2 className="text-sm font-semibold text-white">{item.label}</h2>
                  <p className="text-[10px] font-mono text-zinc-400">{item.id}</p>
                </div>
              </div>

              {/* Comparativo de Tamanhos e Cores */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/[0.04]">
                {/* Estado Inativo (Cinza) */}
                <div className="space-y-1.5 p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Inativo (text-zinc-400)
                  </span>
                  <div className="flex items-center gap-4 text-zinc-400">
                    <div className="flex flex-col items-center gap-1">
                      <Icon size={16} />
                      <span className="text-[9px] font-mono text-zinc-500">16px</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Icon size={18} />
                      <span className="text-[9px] font-mono text-zinc-500">18px</span>
                    </div>
                  </div>
                </div>

                {/* Estado Ativo (Azul) */}
                <div className="space-y-1.5 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] font-mono uppercase text-blue-400 block">
                    Ativo (text-blue-500)
                  </span>
                  <div className="flex items-center gap-4 text-blue-500">
                    <div className="flex flex-col items-center gap-1">
                      <Icon size={16} />
                      <span className="text-[9px] font-mono text-blue-400/70">16px</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Icon size={18} />
                      <span className="text-[9px] font-mono text-blue-400/70">18px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulação Exata da Linha da Sidebar */}
              <div className="pt-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                  Simulação no Item da Sidebar (16px):
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white text-xs font-medium border border-transparent">
                    <Icon size={16} className="shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/10 text-white font-semibold text-xs border border-transparent">
                    <Icon size={16} className="text-blue-500 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

