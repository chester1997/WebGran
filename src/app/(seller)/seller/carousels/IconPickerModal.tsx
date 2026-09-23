"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Check, Palette } from "lucide-react";
import {
  CAROUSEL_ICONS,
  DEFAULT_CAROUSEL_PALETTE,
  CarouselIconRenderer,
} from "@/lib/carousel-icons";

interface IconPickerProps {
  indicatorType: "BAR" | "ICON" | "NONE";
  iconName: string;
  iconColor: string;
  onChangeIndicatorType: (type: "BAR" | "ICON" | "NONE") => void;
  onChangeIconName: (name: string) => void;
  onChangeIconColor: (color: string) => void;
}

export function IconPickerModal({
  indicatorType,
  iconName,
  iconColor,
  onChangeIndicatorType,
  onChangeIconName,
  onChangeIconColor,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = CAROUSEL_ICONS.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const selectedItem = CAROUSEL_ICONS.find((item) => item.id === iconName) || CAROUSEL_ICONS[0];

  return (
    <div className="space-y-3 p-4 bg-[#181820] border border-white/5 rounded-xl">
      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
        Indicador Visual no Cabeçalho
      </label>

      {/* Indicator Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onChangeIndicatorType("BAR")}
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            indicatorType === "BAR"
              ? "bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-600/10"
              : "bg-[#121214] border-white/5 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <div className="w-1 h-3.5 bg-violet-600 rounded-full"></div>
          <span>Barra</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeIndicatorType("ICON")}
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            indicatorType === "ICON"
              ? "bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10"
              : "bg-[#121214] border-white/5 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <CarouselIconRenderer iconName={iconName || "Trophy"} color={iconColor || "#FFD700"} size={14} />
          <span>Ícone Outline</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeIndicatorType("NONE")}
          className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            indicatorType === "NONE"
              ? "bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-600/10"
              : "bg-[#121214] border-white/5 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>Nenhum</span>
        </button>
      </div>

      {/* Icon Customizer Settings when ICON mode is active */}
      {indicatorType === "ICON" && (
        <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in duration-200">
          {/* Icon & Color Selection Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121214] p-3 rounded-xl border border-white/5">
            {/* Selected Icon Preview & Trigger */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner"
                style={{ backgroundColor: `${iconColor || "#FFD700"}15` }}
              >
                <CarouselIconRenderer iconName={iconName} color={iconColor} size={22} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {selectedItem.label}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {selectedItem.category}
                </span>
              </div>
            </div>

            {/* Modal Trigger for Icon Picker */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium border border-white/10 transition-all cursor-pointer">
                Trocar Ícone
              </DialogTrigger>

              <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full sm:max-w-lg bg-[#121216] border border-white/10 text-white rounded-2xl shadow-2xl p-5 max-h-[85vh] flex flex-col">
                <DialogHeader className="border-b border-white/5 pb-3">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-400" />
                    <span>Biblioteca de Ícones Outline</span>
                  </DialogTitle>
                </DialogHeader>

                {/* Search Bar */}
                <div className="relative mt-3">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar ícone por nome ou categoria..."
                    className="w-full bg-[#181820] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Icons Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 my-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredIcons.map((item) => {
                    const isSelected = item.id === iconName;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onChangeIconName(item.id);
                          setOpen(false);
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center group ${
                          isSelected
                            ? "bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10"
                            : "bg-[#181820] border-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <item.icon
                          size={22}
                          strokeWidth={2}
                          style={{ color: isSelected ? iconColor || "#FFD700" : "currentColor" }}
                        />
                        <span className="text-[10px] font-medium truncate w-full">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2 border-t border-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Fechar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Color Picker Swatches & HEX Input */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Cor do Ícone (HEX)
            </label>

            {/* Quick Swatches */}
            <div className="flex flex-wrap items-center gap-2">
              {DEFAULT_CAROUSEL_PALETTE.map((swatch) => {
                const isActive = iconColor?.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => onChangeIconColor(swatch.hex)}
                    title={`${swatch.name} (${swatch.hex})`}
                    className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center relative ${
                      isActive ? "border-white scale-110 shadow-lg" : "border-transparent opacity-85 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isActive && <Check className="w-3.5 h-3.5 text-black drop-shadow" />}
                  </button>
                );
              })}
            </div>

            {/* Custom HEX Input */}
            <div className="flex items-center gap-2 pt-1">
              <div
                className="w-7 h-7 rounded-lg border border-white/10 shrink-0"
                style={{ backgroundColor: iconColor || "#FFD700" }}
              />
              <input
                type="text"
                value={iconColor}
                onChange={(e) => onChangeIconColor(e.target.value)}
                placeholder="#FFD700"
                className="w-32 bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-zinc-500">HEX válido</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
