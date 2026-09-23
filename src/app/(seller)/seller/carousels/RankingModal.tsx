"use client";

import { useState, useTransition } from "react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Search 
} from "lucide-react";
import { updateRankingCarouselAction } from "./actions";
import { IconPickerModal } from "./IconPickerModal";

interface ProductOption {
  id: string;
  title: string;
  price: string | number;
}

interface RankingModalProps {
  rankingCarousel: {
    id: string;
    name: string;
    status: string;
    selectedProductIds: string[];
    indicatorType?: "BAR" | "ICON" | "NONE";
    iconName?: string | null;
    iconColor?: string | null;
  };
  products: ProductOption[];
}

export function RankingModal({ rankingCarousel, products }: RankingModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState(rankingCarousel.name || "Top 15 Hoje");
  const [status, setStatus] = useState(rankingCarousel.status || "active");
  const [selectedIds, setSelectedIds] = useState<string[]>(rankingCarousel.selectedProductIds || []);
  const [searchTerm, setSearchTerm] = useState("");

  const [indicatorType, setIndicatorType] = useState<"BAR" | "ICON" | "NONE">(
    rankingCarousel.indicatorType || "ICON"
  );
  const [iconName, setIconName] = useState<string>(rankingCarousel.iconName || "Trophy");
  const [iconColor, setIconColor] = useState<string>(rankingCarousel.iconColor || "#FFD700");

  const maxLimit = 15;
  const isLimitReached = selectedIds.length >= maxLimit;

  // Filter available products not yet selected
  const availableProducts = products.filter(
    (p) => !selectedIds.includes(p.id) && p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddProduct = (productId: string) => {
    if (selectedIds.length >= maxLimit) {
      setErrorMessage("Esta seção permite no máximo 15 produtos.");
      return;
    }
    setSelectedIds([...selectedIds, productId]);
    setErrorMessage(null);
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedIds(selectedIds.filter((id) => id !== productId));
    setErrorMessage(null);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;

    const newList = [...selectedIds];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setSelectedIds(newList);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMessage("Informe um nome para a seção de ranking.");
      return;
    }

    if (selectedIds.length > maxLimit) {
      setErrorMessage("Esta seção permite no máximo 15 produtos.");
      return;
    }

    startTransition(async () => {
      try {
        await updateRankingCarouselAction(
          rankingCarousel.id, 
          name.trim(), 
          status, 
          selectedIds,
          indicatorType,
          iconName,
          iconColor
        );
        setOpen(false);
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(err.message || "Erro ao atualizar ranking.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-semibold rounded-xl px-4 py-2.5 text-xs shadow-lg shadow-red-600/20 inline-flex items-center justify-center gap-2 cursor-pointer border-0 active:scale-95 transition-all">
        <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
        <span>Gerenciar Top 15 (Ranking)</span>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-20px)] sm:w-full sm:max-w-2xl bg-[#121216] border border-white/10 text-white max-h-[calc(100dvh-20px)] sm:max-h-[90vh] flex flex-col rounded-2xl shadow-2xl p-0 overflow-hidden box-border">
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 shrink-0 bg-[#121216] pr-12 relative">
          <DialogHeader className="pr-0">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-start gap-2.5 leading-snug break-words text-white">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>Configurar Ranking Editorial (Top 15)</span>
            </DialogTitle>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 leading-relaxed break-words">
              Personalize o nome da seção, escolha o indicador visual/ícone e selecione manualmente a ordem dos até 15 produtos.
            </p>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 custom-scrollbar">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}

          {/* Section Name & Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3.5 w-full min-w-0">
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">Nome da Seção no Mini App</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Top 15 Hoje, Em Alta, Em Destaque"
                className="w-full bg-[#181820] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-red-500 box-border"
              />
            </div>

            <div className="w-full sm:w-auto shrink-0 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">Status no Mini App</label>
              <button
                type="button"
                onClick={() => setStatus(status === "active" ? "inactive" : "active")}
                className={`w-full sm:w-auto min-h-[42px] py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  status === "active"
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border-white/10"
                }`}
              >
                {status === "active" ? <Eye className="w-4 h-4 text-emerald-400 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
                <span>{status === "active" ? "Ativo no Mini App" : "Oculto"}</span>
              </button>
            </div>
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

          {/* Selected Products List (Max 15) */}
          <div className="space-y-3 w-full min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Produtos Selecionados</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold border ${
                  isLimitReached 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                    : "bg-white/5 text-zinc-400 border-white/10"
                }`}>
                  {selectedIds.length} / {maxLimit} produtos
                </span>
              </h4>
              {isLimitReached && (
                <span className="text-[11px] text-amber-400 font-medium">Limite de 15 atingido</span>
              )}
            </div>

            {selectedIds.length === 0 ? (
              <div className="p-6 text-center bg-[#181820] border border-white/5 rounded-xl text-zinc-500 text-xs">
                Nenhum produto selecionado para o ranking. Escolha os produtos abaixo para começar.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 w-full">
                {selectedIds.map((id, index) => {
                  const prod = products.find((p) => p.id === id);
                  if (!prod) return null;
                  const isTop5 = index < 5;

                  return (
                    <div
                      key={id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all gap-2 min-w-0 w-full ${
                        isTop5
                          ? "bg-gradient-to-r from-red-950/30 to-[#181820] border-red-500/30"
                          : "bg-[#181820] border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Position Badge */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            index === 0
                              ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                              : index === 1
                              ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                              : index === 2
                              ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                              : index < 5
                              ? "bg-yellow-600 text-white"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <span className="text-xs font-semibold text-white truncate min-w-0 flex-1">
                          {prod.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                          title="Subir posição"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === selectedIds.length - 1}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                          title="Descer posição"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(id)}
                          className="w-8 h-8 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 transition-all flex items-center justify-center cursor-pointer active:scale-95 ml-0.5"
                          title="Remover do ranking"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Products Picker */}
          {!isLimitReached && (
            <div className="space-y-3 pt-3 border-t border-white/5 w-full min-w-0">
              <h4 className="text-xs font-semibold text-zinc-300 block">Adicionar Produtos ao Ranking</h4>
              
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar produto por nome..."
                  className="w-full bg-[#181820] border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 box-border"
                />
              </div>

              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 w-full">
                {availableProducts.length === 0 ? (
                  <p className="text-zinc-500 text-xs py-3 text-center">Nenhum produto disponível.</p>
                ) : (
                  availableProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleAddProduct(p.id)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#181820] hover:bg-white/10 border border-white/5 text-xs text-zinc-200 cursor-pointer transition-all min-w-0 w-full"
                    >
                      <span className="truncate min-w-0 flex-1">{p.title}</span>
                      <Plus className="w-4 h-4 text-red-400 shrink-0 ml-2" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-4 sm:p-5 border-t border-white/5 shrink-0 bg-[#121216] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white text-xs w-full sm:w-auto min-h-[42px] cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl px-5 py-2.5 shadow-lg shadow-red-600/20 w-full sm:w-auto min-h-[42px] cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Salvar Ranking Top 15"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
