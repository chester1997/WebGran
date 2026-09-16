"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Save, Box, DollarSign, Image as ImageIcon, LayoutList, Lock } from "lucide-react";
import { createProductAction } from "./actions";

export function NewProductModal({ categories }: { categories: any[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setSlug(newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createProductAction(formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-6 shadow-lg shadow-violet-600/20 w-full sm:w-auto inline-flex items-center justify-center">
        <Plus className="w-5 h-5 mr-2" /> Novo Produto
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl bg-[#0A0A0A] border-white/10 p-0 overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 bg-[#121212] flex items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-xl font-bold text-white">Criar Novo Produto</DialogTitle>
            <DialogDescription className="text-zinc-400 mt-1">
              Preencha os dados abaixo para adicionar um item ao catálogo.
            </DialogDescription>
          </div>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar flex-1 bg-[#0A0A0A]">
          <form id="new-product-form" onSubmit={handleSubmit} className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
              
              {/* Coluna Esquerda */}
              <div className="space-y-8">
                {/* Informações Básicas */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                      <Box className="w-4 h-4 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Informações Principais</h3>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Título do Produto</label>
                      <input 
                        type="text" 
                        name="title"
                        value={title}
                        onChange={handleTitleChange}
                        required
                        placeholder="Ex: Acesso VIP Mensal"
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">URL (Slug)</label>
                      <input 
                        type="text" 
                        name="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        required
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descrição Curta</label>
                      <input 
                        type="text" 
                        name="shortDescription"
                        placeholder="Aparece nos cards do Mini App..."
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descrição Completa</label>
                      <textarea 
                        name="description"
                        rows={4}
                        placeholder="Detalhe tudo o que o cliente recebe..."
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600 resize-none custom-scrollbar"
                      ></textarea>
                    </div>
                  </div>
                </div>

                {/* Comercial */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Comercial</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Preço (R$)</label>
                      <input 
                        type="number" 
                        name="price"
                        step="0.01"
                        required
                        placeholder="0.00"
                        className="w-full bg-[#0A0A0A] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">Preço Antigo (R$)</label>
                      <input 
                        type="number" 
                        name="compareAtPrice"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all line-through decoration-zinc-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna Direita */}
              <div className="space-y-8">
                
                {/* Organização */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                      <LayoutList className="w-4 h-4 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Organização</h3>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
                        <select name="status" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none">
                          <option value="active">Ativo (Visível)</option>
                          <option value="draft">Rascunho (Oculto)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Categoria</label>
                        <select name="categoryId" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none">
                          <option value="">Sem categoria</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mídia */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Mídia</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Capa Vertical</label>
                      <div className="w-full aspect-[2/3] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:border-violet-500 hover:text-violet-400 transition-all cursor-pointer bg-[#0A0A0A]">
                        <ImageIcon className="w-6 h-6 mb-2 opacity-50" />
                        <span className="text-[10px] font-medium text-center px-2">Upload da Capa</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Banner Horizontal</label>
                      <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:border-violet-500 hover:text-violet-400 transition-all cursor-pointer bg-[#0A0A0A]">
                        <ImageIcon className="w-6 h-6 mb-2 opacity-50" />
                        <span className="text-[10px] font-medium text-center px-2">Upload do Banner</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Entrega */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                      <Lock className="w-4 h-4 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Entrega</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border border-violet-500/30 bg-violet-500/5 rounded-xl cursor-pointer">
                      <input type="radio" name="deliveryType" defaultChecked className="mt-1 accent-violet-500" />
                      <div>
                        <p className="text-sm font-medium text-white">Conteúdo Nativo</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Libera acesso no app.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#121212] flex items-center justify-end gap-3 shrink-0">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form="new-product-form"
            disabled={loading} 
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl px-8 shadow-lg shadow-violet-600/20"
          >
            <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
