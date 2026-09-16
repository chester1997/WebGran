import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Store as StoreIcon, Globe, Image as ImageIcon, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SellerStorePage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <StoreIcon className="w-16 h-16 text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Loja não encontrada</h2>
        <p className="text-zinc-400 max-w-md">Ocorreu um problema ao localizar os dados da sua loja. Entre em contato com o suporte.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in max-w-5xl">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Minha Loja</h2>
        <p className="text-zinc-400 text-sm mt-1">Gerencie as informações públicas e a identidade visual do seu negócio.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        
        {/* Left Column (Forms) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Informações */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                <Globe className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Informações Principais</h3>
            </div>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Nome da Loja</label>
                  <input 
                    type="text" 
                    defaultValue={store.name}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-300">Link de Acesso (Slug)</label>
                  <input 
                    type="text" 
                    defaultValue={store.slug}
                    disabled
                    className="w-full bg-[#0A0A0A] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Descrição Curta</label>
                <textarea 
                  rows={3}
                  placeholder="Escreva uma breve descrição sobre o que você vende..."
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Card: Identidade */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Identidade Visual</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Logotipo</label>
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:border-violet-500 hover:text-violet-400 transition-colors cursor-pointer bg-[#0A0A0A]">
                  <ImageIcon className="w-6 h-6 mb-2" />
                  <span className="text-xs">Upload Logo</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Capa da Loja (Banner)</label>
                <div className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:border-violet-500 hover:text-violet-400 transition-colors cursor-pointer bg-[#0A0A0A]">
                  <ImageIcon className="w-6 h-6 mb-2" />
                  <span className="text-xs">Upload Banner</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl px-8 shadow-lg shadow-violet-600/20">
              <Save className="w-4 h-4 mr-2" /> Salvar Alterações
            </Button>
          </div>

        </div>

        {/* Right Column (Status & Preview) */}
        <div className="space-y-6">
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Status da Loja</h3>
            <div className="flex items-center gap-3 bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Online e Operante</p>
                <p className="text-xs text-zinc-500 mt-0.5">Visível para clientes</p>
              </div>
            </div>
          </div>

          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Como o cliente vê</h3>
            <div className="w-full aspect-[9/16] bg-[#0A0A0A] rounded-2xl border-4 border-zinc-800 overflow-hidden relative shadow-2xl">
              {/* Fake Mini App Preview */}
              <div className="absolute top-0 w-full h-1/3 bg-gradient-to-b from-violet-900/50 to-transparent"></div>
              <div className="p-4 pt-12 flex flex-col items-center">
                <div className="w-16 h-16 bg-zinc-800 rounded-full border-2 border-white/10 mb-3"></div>
                <div className="w-24 h-4 bg-zinc-800 rounded-full mb-2"></div>
                <div className="w-40 h-2 bg-zinc-800 rounded-full"></div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 h-12 bg-violet-600 rounded-xl flex items-center justify-center text-xs font-bold text-white opacity-80">
                Catálogo
              </div>
            </div>
            <p className="text-center text-xs text-zinc-500 mt-4">Preview em tempo real do Mini App</p>
          </div>
        </div>

      </div>
    </div>
  );
}
