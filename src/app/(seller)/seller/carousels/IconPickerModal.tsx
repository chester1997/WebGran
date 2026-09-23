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
    <div className="space-y-3 p-3.5 sm:p-4 bg-[#181820] border border-white/5 rounded-xl w-full min-w-0 box-border">
      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
        Indicador Visual no Cabeçalho
      </label>

      {/* Indicator Type Selector — Vertical stack on mobile, 3 cols on sm+ */}
      <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 w-full">
        <button
          type="button"
          onClick={() => onChangeIndicatorType("BAR")}
          className={`w-full min-h-[42px] py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-start sm:justify-center gap-2.5 transition-all cursor-pointer ${
            indicatorType === "BAR"
              ? "bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-600/10"
              : "bg-[#121214] border-white/5 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <div className="w-1.5 h-4 bg-violet-500 rounded-full shrink-0"></div>
          <span>Barra</span>
          {indicatorType === "BAR" && <Check className="w-3.5 h-3.5 text-violet-400 ml-auto sm:ml-0" />}
        </button>

        <button
          type="button"
          onClick={() => onChangeIndicatorType("ICON")}
          className={`w-full min-h-[42px] py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-start sm:justify-center gap-2.5 transition-all cursor-pointer ${
            indicatorType === "ICON"
              ? "bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10"
              : "bg-[#121214] border-white/5 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <CarouselIconRenderer iconName={iconName || "Trophy"} color={iconColor || "#FFD700"} size={16} />
          <span>Ícone Outline</span>
          {indicatorType === "ICON" && <Check className="w-3.5 h-3.5 text-blue-400 ml-auto sm:ml-0" />}
        </button>

        <button
          type="button"
          onClick={() => onChangeIndicatorType("NONE")}
          className={`w-full min-h-[42px] py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-start sm:justify-center gap-2.5 transition-all cursor-pointer ${
            indicatorType === "NONE"
              ? "bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-600/10"
              : "bg-[#121214] border-white/5 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>Nenhum</span>
          {indicatorType === "NONE" && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto sm:ml-0" />}
        </button>
      </div>

      {/* Icon Customizer Settings when ICON mode is active */}
      {indicatorType === "ICON" && (
        <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in duration-200 w-full min-w-0">
          {/* Icon & Color Selection Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121214] p-3 sm:p-4 rounded-xl border border-white/5 w-full min-w-0">
            {/* Selected Icon Preview & Details */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner"
                style={{ backgroundColor: `${iconColor || "#FFD700"}15` }}
              >
                <CarouselIconRenderer iconName={iconName} color={iconColor} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white block truncate">
                  {selectedItem.label}
                </span>
                <span className="text-[10px] text-zinc-400 block truncate">
                  {selectedItem.category}
                </span>
              </div>
            </div>

            {/* Modal Trigger for Icon Picker */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer min-h-[42px] flex items-center justify-center shrink-0">
                Trocar Ícone
              </DialogTrigger>

              <DialogContent className="w-[calc(100vw-20px)] sm:w-full sm:max-w-lg bg-[#121216] border border-white/10 text-white rounded-2xl shadow-2xl p-4 sm:p-5 max-h-[calc(100dvh-20px)] sm:max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="border-b border-white/5 pb-3 shrink-0 pr-8">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Biblioteca de Ícones Outline</span>
                  </DialogTitle>
                </DialogHeader>

                {/* Search Bar */}
                <div className="relative mt-3 shrink-0 w-full">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar ícone por nome ou categoria..."
                    className="w-full bg-[#181820] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 box-border"
                  />
                </div>

                {/* Icons Grid */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar grid grid-cols-3 sm:grid-cols-5 gap-2 my-3 p-1">
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
                        className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center group cursor-pointer ${
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
                        <span className="text-[10px] font-medium truncate max-w-full">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-3 border-t border-white/5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer min-h-[38px] w-full sm:w-auto"
                  >
                    Fechar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Color Picker Swatches & HEX Input */}
          <div className="space-y-2.5 w-full min-w-0">
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Cor do Ícone (HEX)
            </label>

            {/* Quick Swatches — Wrap naturally */}
            <div className="flex flex-wrap items-center gap-2 w-full">
              {DEFAULT_CAROUSEL_PALETTE.map((swatch) => {
                const isActive = iconColor?.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => onChangeIconColor(swatch.hex)}
                    title={`${swatch.name} (${swatch.hex})`}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center relative shrink-0 active:scale-95 cursor-pointer ${
                      isActive ? "border-white scale-105 shadow-lg" : "border-transparent opacity-85 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isActive && <Check className="w-4 h-4 text-black drop-shadow font-bold" />}
                  </button>
                );
              })}
            </div>

            {/* Custom HEX Input */}
            <div className="flex items-center gap-2.5 pt-1 w-full flex-wrap sm:flex-nowrap">
              <div
                className="w-8 h-8 rounded-lg border border-white/10 shrink-0 shadow-inner"
                style={{ backgroundColor: iconColor || "#FFD700" }}
              />
              <input
                type="text"
                value={iconColor}
                onChange={(e) => onChangeIconColor(e.target.value)}
                placeholder="#FFD700"
                className="flex-1 sm:w-32 min-w-0 bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500 box-border"
              />
              <span className="text-[10px] text-zinc-500 shrink-0">HEX válido</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
