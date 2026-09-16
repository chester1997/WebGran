"use client";

import { useState } from "react";
import { createProductAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Image as ImageIcon, Box, Tag, DollarSign, LayoutList, Lock } from "lucide-react";
import Link from "next/link";

export function ProductForm({ categories }: { categories: any[] }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setSlug(newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    // Action will handle redirect on success
  };

  return (
    <form action={createProductAction} onSubmit={handleSubmit} className="space-y-8 fade-in pb-12 max-w-6xl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-20 bg-[#0A0A0A]/90 backdrop-blur-md z-20 py-4 border-b border-white/5 -mx-8 px-8">
        <div className="flex items-center gap-4">
          <Link href="/seller/products">
            <Button type="button" variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-[#121212] border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Novo Produto</h2>
            <p className="text-zinc-500 text-sm mt-0.5">Preencha as informações para adicionar ao catálogo.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white rounded-xl px-6 h-11 hidden sm:flex">
            Descartar
          </Button>
          <Button type="submit" disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-8 shadow-lg shadow-violet-600/20">
            <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column (Main Info) */}
        <div className="lg:col-span-2 space-y-8">
          
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
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descrição Curta (Subtítulo)</label>
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
                  rows={5}
                  placeholder="Detalhe tudo o que o cliente recebe ao comprar este produto..."
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600 resize-none custom-scrollbar"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Comercial (Preços) */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Comercial</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Preço de Venda (R$)</label>
                <input 
                  type="number" 
                  name="price"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full bg-[#0A0A0A] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-semibold placeholder:text-emerald-900/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Preço Antigo / Riscado (R$)</label>
                <input 
                  type="number" 
                  name="compareAtPrice"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-700 line-through decoration-zinc-600"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-4">Preencha o "Preço Antigo" se quiser gerar uma âncora de desconto (ex: De R$ 99 por R$ 49).</p>
          </div>

          {/* Mídia (Imagens) */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <ImageIcon className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Mídia</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Capa do Produto (Vertical)</label>
                <div className="w-full aspect-[2/3] max-w-[200px] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:border-violet-500 hover:text-violet-400 hover:bg-violet-500/5 transition-all cursor-pointer bg-[#0A0A0A]">
                  <ImageIcon className="w-8 h-8 mb-3 opacity-50" />
                  <span className="text-xs font-medium">Upload da Capa</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Banner (Horizontal)</label>
                <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:border-violet-500 hover:text-violet-400 hover:bg-violet-500/5 transition-all cursor-pointer bg-[#0A0A0A]">
                  <ImageIcon className="w-8 h-8 mb-3 opacity-50" />
                  <span className="text-xs font-medium">Upload do Banner</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Organization & Delivery) */}
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
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
                <select name="status" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none">
                  <option value="active">Ativo (Visível na loja)</option>
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

          {/* Entrega (Delivery Auth Mock) */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full"></div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5 relative z-10">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <Lock className="w-4 h-4 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Entrega / Acesso</h3>
            </div>
            
            <div className="space-y-4 relative z-10">
              <p className="text-sm text-zinc-400 mb-4">Como o sistema deve entregar o conteúdo após o pagamento ser confirmado?</p>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-violet-500/30 bg-violet-500/5 rounded-xl cursor-pointer">
                  <input type="radio" name="deliveryType" defaultChecked className="mt-1 accent-violet-500" />
                  <div>
                    <p className="text-sm font-medium text-white">Conteúdo Nativo / Área de Membros</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Libera o acesso diretamente dentro da aba "Meus Acessos" no Mini App.</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 p-3 border border-white/5 hover:border-white/10 bg-[#0A0A0A] rounded-xl cursor-pointer opacity-50 transition-colors">
                  <input type="radio" name="deliveryType" disabled className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">Grupo / Canal VIP</p>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-bold uppercase">Em Breve</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">Envia um link de convite exclusivo e gerencia a permanência.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border border-white/5 hover:border-white/10 bg-[#0A0A0A] rounded-xl cursor-pointer opacity-50 transition-colors">
                  <input type="radio" name="deliveryType" disabled className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">Link Externo</p>
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-bold uppercase">Em Breve</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">Redireciona o cliente para um site, drive ou arquivo externo seguro.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
