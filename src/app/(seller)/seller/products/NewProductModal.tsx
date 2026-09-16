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
import { Plus, Save, Upload } from "lucide-react";
import { createProductAction } from "./actions";

export function NewProductModal({ categories }: { categories: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"telegram" | "external" | "native">("telegram");

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
      <DialogTrigger className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-6 shadow-lg shadow-violet-600/20 w-full sm:w-auto inline-flex items-center justify-center transition-colors">
        <Plus className="w-5 h-5 mr-2" /> Novo Produto
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl w-full bg-[#121214] border border-white/5 p-0 overflow-hidden text-zinc-100 flex flex-col max-h-[90vh] shadow-2xl">
        <div className="p-6 border-b border-white/5 shrink-0">
          <DialogTitle className="text-xl font-bold text-white">Novo Produto</DialogTitle>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar flex-1">
          <form id="new-product-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Título */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Título *</label>
              <input 
                type="text" 
                name="title"
                required
                placeholder="Ex: Plano Mensal Premium"
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Descrição</label>
              <textarea 
                name="description"
                rows={4}
                placeholder="Detalhe tudo o que o cliente recebe ao comprar este produto..."
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600 resize-none custom-scrollbar"
              ></textarea>
            </div>

            {/* Preço e Duração (Lado a lado) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Preço (R$) *</label>
                <input 
                  type="number" 
                  name="price"
                  step="0.01"
                  required
                  placeholder="0,00"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Duração</label>
                <select name="duration" className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 appearance-none">
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semiannual">Semestral</option>
                  <option value="annual">Anual</option>
                  <option value="lifetime" selected>Vitalício</option>
                </select>
              </div>
            </div>

            {/* Desconto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Desconto (%)</label>
                <input 
                  type="number" 
                  name="discount"
                  min="0"
                  max="100"
                  placeholder="0"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              <div className="flex items-end pb-3">
                <span className="text-xs text-zinc-500">Opcional. Ex: 10 para 10% de desconto</span>
              </div>
            </div>

            {/* Imagem do Produto */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Imagem do produto</label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white shrink-0 h-11 px-6 rounded-lg">
                  <Upload className="w-4 h-4 mr-2" /> Enviar imagem
                </Button>
                <input 
                  type="text" 
                  placeholder="ou cole uma URL aqui"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-2">Recomendado: 600 x 600 px - máx 5MB</p>
            </div>

            {/* Tipo de Entrega */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Tipo de entrega após pagamento</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div 
                  onClick={() => setDeliveryType("telegram")}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${deliveryType === "telegram" ? "border-violet-500 bg-violet-500/5" : "border-white/5 bg-[#1A1A1E] hover:border-white/10"}`}
                >
                  <p className={`text-sm font-bold ${deliveryType === "telegram" ? "text-white" : "text-zinc-300"}`}>Grupo / Canal Telegram</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Bot envia link de convite automaticamente</p>
                </div>
                <div 
                  onClick={() => setDeliveryType("external")}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${deliveryType === "external" ? "border-violet-500 bg-violet-500/5" : "border-white/5 bg-[#1A1A1E] hover:border-white/10"}`}
                >
                  <p className={`text-sm font-bold ${deliveryType === "external" ? "text-white" : "text-zinc-300"}`}>Link externo</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Bot envia qualquer link após pagamento</p>
                </div>
              </div>
              
              {/* Conditional Input for Delivery */}
              {deliveryType === "telegram" && (
                <div className="fade-in">
                  <input 
                    type="text" 
                    placeholder="Ex: -1001234567890"
                    className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono"
                  />
                  <div className="mt-2 text-[11px] text-zinc-500 leading-relaxed">
                    <p><strong>Como obter o ID:</strong> Acesse algum bot de ID no Telegram e encaminhe uma mensagem do canal/grupo.</p>
                    <p className="text-amber-500/80 mt-1">⚠️ O bot de vendas precisa ser <strong>administrador</strong> do grupo/canal para gerar links de convite.</p>
                  </div>
                </div>
              )}

              {deliveryType === "external" && (
                <div className="fade-in">
                  <input 
                    type="url" 
                    placeholder="Ex: https://meudrive.com/arquivo"
                    className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Organização e Categoria */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Categoria</label>
                <select name="categoryId" className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 appearance-none">
                  <option value="">Sem Categoria</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select name="status" className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 appearance-none">
                  <option value="active">Ativo na Loja</option>
                  <option value="draft">Inativo (Rascunho)</option>
                </select>
              </div>
            </div>

          </form>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-3 bg-[#121214]">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white hover:bg-white/5 px-6 rounded-lg font-medium"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form="new-product-form"
            disabled={loading} 
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg px-8 shadow-lg shadow-violet-600/20"
          >
            {loading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
