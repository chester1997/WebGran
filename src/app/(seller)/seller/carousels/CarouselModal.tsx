"use client";

import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Check, Package } from "lucide-react";
import { createCarouselAction, updateCarouselAction } from "./actions";

interface CarouselModalProps {
  products: Array<{ id: string; title: string; price: string | number }>;
  carousel?: {
    id: string;
    name: string;
    selectedProductIds: string[];
  };
  triggerText?: string;
}

export function CarouselModal({ products, carousel, triggerText }: CarouselModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(carousel?.name || "");
  const [selectedIds, setSelectedIds] = useState<string[]>(carousel?.selectedProductIds || []);

  const isEditing = !!carousel;

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item != id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (isEditing) {
        await updateCarouselAction(carousel.id, name, selectedIds);
      } else {
        await createCarouselAction(name, selectedIds);
      }
      setOpen(false);
      if (!isEditing) {
        setName("");
        setSelectedIds([]);
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
        <DialogTrigger className="bg-transparent text-zinc-400 hover:text-white hover:bg-white/5 h-8 px-2 text-xs font-medium rounded-lg inline-flex items-center justify-center border-0">
          <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar
        </DialogTrigger>
      ) : (
        <DialogTrigger className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-blue-600/20 inline-flex items-center justify-center border-0">
          <Plus className="w-4 h-4 mr-2" /> {triggerText || "Novo Carrossel"}
        </DialogTrigger>
      )}


      <DialogContent className="sm:max-w-[550px] w-full bg-[#121214] border border-white/5 p-0 overflow-hidden text-zinc-100 shadow-2xl flex flex-col max-h-[85vh]">
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
                placeholder="Ex: Lançamentos, Ofertas Especiais, Mais Vendidos"
                required
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Seleção de produtos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Produtos ({selectedIds.length} selecionados)
                </label>
                <span className="text-[10px] text-zinc-500">
                  Clique nos produtos para incluir neste carrossel
                </span>
              </div>

              {products.length === 0 ? (
                <div className="py-8 text-center bg-[#1A1A1E] rounded-xl border border-white/5 text-zinc-500 text-xs">
                  Nenhum produto cadastrado na sua loja ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                  {products.map(product => {
                    const selected = selectedIds.includes(product.id);
                    return (
                      <div
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                          selected
                            ? "bg-blue-600/10 border-blue-500/50 text-white"
                            : "bg-[#1A1A1E] border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            selected ? "bg-blue-600 border-blue-600 text-white" : "border-white/20 bg-transparent"
                          }`}>
                            {selected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-sm font-medium truncate">{product.title}</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 shrink-0 ml-2">
                          R$ {Number(product.price).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
              {loading ? "Salvando..." : "Salvar Carrossel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
