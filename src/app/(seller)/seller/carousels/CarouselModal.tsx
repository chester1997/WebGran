"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Sparkles } from "lucide-react";
import { createCarouselAction, updateCarouselAction } from "./actions";
import { IconPickerModal } from "./IconPickerModal";

interface CarouselModalProps {
  products?: Array<{ id: string; title: string; price: string | number; badge?: string | null }>;
  carousel?: {
    id: string;
    name: string;
    selectedProductIds?: string[];
    indicatorType?: "BAR" | "ICON" | "NONE";
    iconName?: string | null;
    iconColor?: string | null;
  };
  triggerText?: string;
}

export function CarouselModal({ carousel, triggerText }: CarouselModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(carousel?.name || "");

  const [indicatorType, setIndicatorType] = useState<"BAR" | "ICON" | "NONE">(
    carousel?.indicatorType || "BAR"
  );
  const [iconName, setIconName] = useState<string>(carousel?.iconName || "Flame");
  const [iconColor, setIconColor] = useState<string>(carousel?.iconColor || "#8B5CF6");

  const isEditing = !!carousel;

  useEffect(() => {
    if (open) {
      setName(carousel?.name || "");
      setIndicatorType(carousel?.indicatorType || "BAR");
      setIconName(carousel?.iconName || "Flame");
      setIconColor(carousel?.iconColor || "#8B5CF6");
    }
  }, [open, carousel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (isEditing) {
        await updateCarouselAction(
          carousel.id,
          name,
          undefined, // Preserva produtos já associados
          indicatorType,
          iconName,
          iconColor
        );
      } else {
        await createCarouselAction(
          name,
          undefined, // Cria carrossel vazio sem exigir produtos prévios
          indicatorType,
          iconName,
          iconColor
        );
      }
      setOpen(false);
      if (!isEditing) {
        setName("");
        setIndicatorType("BAR");
        setIconName("Flame");
        setIconColor("#8B5CF6");
      }
    } catch (err: any) {
      alert(err.message || "Erro ao salvar carrossel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEditing ? (
        <DialogTrigger className="bg-transparent text-zinc-400 hover:text-white hover:bg-white/5 h-8 px-2 text-xs font-medium rounded-lg inline-flex items-center justify-center border-0 cursor-pointer">
          <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
        </DialogTrigger>
      ) : (
        <DialogTrigger className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-blue-600/20 inline-flex items-center justify-center border-0 cursor-pointer">
          <Plus className="w-4 h-4 mr-2" /> {triggerText || "Novo Carrossel"}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[500px] w-full bg-[#121214] border border-white/5 p-0 overflow-hidden text-zinc-100 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <DialogTitle className="text-lg font-bold text-white">
            {isEditing ? "Editar Carrossel" : "Novo Carrossel"}
          </DialogTitle>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
            {/* Nome do carrossel */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Nome do Carrossel *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Lançamentos, Ofertas Especiais, Doramas"
                required
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Visual Indicator Picker (Bar / Outline Icon / None) */}
            <IconPickerModal
              indicatorType={indicatorType}
              iconName={iconName}
              iconColor={iconColor}
              onChangeIndicatorType={setIndicatorType}
              onChangeIconName={setIconName}
              onChangeIconColor={setIconColor}
            />

            {/* Info Box: Product Association Clarification */}
            <div className="bg-[#1A1A1E] rounded-xl p-4 border border-white/5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-200">Como vincular produtos?</p>
                <p className="leading-relaxed">
                  Os produtos são vinculados diretamente no cadastro e edição de cada produto na tela de <strong className="text-zinc-300">Produtos</strong>. Você pode salvar este carrossel agora e associar os itens a qualquer momento.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-3 bg-[#121214]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white hover:bg-white/5 px-5 rounded-lg font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 shadow-lg shadow-blue-600/20"
            >
              {loading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar Carrossel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
