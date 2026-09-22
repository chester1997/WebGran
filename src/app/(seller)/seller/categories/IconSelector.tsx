"use client";

import { useState } from "react";
import { CAROUSEL_ICONS, ICON_MAP } from "@/lib/carousel-icons";
import { Search, Check, Sparkles, Grid } from "lucide-react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface IconSelectorProps {
  value?: string | null;
  onChange: (iconName: string) => void;
}

export function IconSelector({ value, onChange }: IconSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIconName = value || "Tv";
  const SelectedIcon = ICON_MAP[selectedIconName] || ICON_MAP["Tv"] || Sparkles;

  const filteredIcons = CAROUSEL_ICONS.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="w-full flex items-center justify-between gap-2 bg-[#0A0A0C] border border-white/10 text-white hover:bg-white/5 h-11 px-3.5 rounded-xl font-normal cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <SelectedIcon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">
            {CAROUSEL_ICONS.find((i) => i.id === selectedIconName)?.label || selectedIconName}
          </span>
        </div>
        <span className="text-xs text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 font-semibold">
          Alterar Ícone
        </span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[440px] w-[92vw] max-w-[calc(100vw-1rem)] bg-[#121214] border border-white/10 p-4 sm:p-5 text-zinc-100 shadow-2xl rounded-2xl space-y-4">
        <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
          <Grid className="w-4 h-4 text-blue-400" />
          <span>Escolha o Ícone da Categoria</span>
        </DialogTitle>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar ícone (ex: Filme, Série, Coração...)"
            className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
          />
        </div>

        <div className="max-h-[260px] overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-2 p-1 custom-scrollbar">
          {filteredIcons.map((item) => {
            const IconComp = item.icon;
            const isSelected = item.id === selectedIconName;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                title={item.label}
                className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl transition-all border ${
                  isSelected
                    ? "bg-blue-600/30 border-blue-500 text-blue-400 shadow-md shadow-blue-500/20"
                    : "bg-[#0A0A0C] border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <IconComp className="w-5 h-5 shrink-0" />
                <span className="text-[10px] truncate max-w-full text-center leading-tight">
                  {item.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
