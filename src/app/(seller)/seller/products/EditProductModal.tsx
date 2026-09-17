"use client";

import { useState, useRef } from "react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Edit3, ImageIcon } from "lucide-react";
import { updateProductAction } from "./actions";

export function EditProductModal({ categories, bots, product }: { categories: any[]; bots: any[]; product: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"telegram" | "external">("telegram");
  const [imageUrl, setImageUrl] = useState(product?.coverUrl || "");
  const [imageSource, setImageSource] = useState<"url" | "upload">(
    product?.coverUrl && !product.coverUrl.startsWith("data:") ? "url" : "upload"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setImageSource("upload");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    // Override coverUrl with the controlled state
    formData.set("coverUrl", imageUrl);
    try {
      await updateProductAction(product.id, formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Display label for image field: truncate if base64
  const imageDisplayValue = imageUrl.startsWith("data:") ? "(imagem carregada do seu computador)" : imageUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex-1 bg-transparent border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-8 text-xs font-medium rounded-lg inline-flex items-center justify-center">
        <Edit3 className="w-3.5 h-3.5 mr-2" /> Editar
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[820px] w-full bg-[#121214] border border-white/5 p-0 overflow-hidden text-zinc-100 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <DialogTitle className="text-lg font-bold tracking-tight text-white">Editar Produto</DialogTitle>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar flex-1">
          <form id="edit-product-form" onSubmit={handleSubmit} className="space-y-5">

            {/* Título */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Título *</label>
              <input 
                type="text" name="title" defaultValue={product?.title} required
                placeholder="Ex: Plano Mensal Premium"
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Slug (URL)</label>
              <input 
                type="text" name="slug" defaultValue={product?.slug}
                placeholder="plano-mensal-premium"
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-zinc-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Descrição curta */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Descrição curta</label>
              <input 
                type="text" name="shortDescription" defaultValue={product?.shortDescription || ""}
                placeholder="Resumo exibido na lista de produtos"
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Descrição completa */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Descrição</label>
              <textarea 
                name="description" defaultValue={product?.description || ""}
                rows={3}
                placeholder="Detalhe tudo o que o cliente recebe ao comprar este produto..."
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* Preço + Duração + Status numa linha */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Preço (R$) *</label>
                <input 
                  type="number" name="price" defaultValue={product?.price} required step="0.01" min="0"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Duração</label>
                <select name="duration" defaultValue={product?.duration || "lifetime"} className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="lifetime">Vitalício</option>
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semiannual">Semestral</option>
                  <option value="annual">Anual</option>
                  <option value="weekly">Semanal</option>
                  <option value="daily">Diário</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select name="status" defaultValue={product?.status || "active"} className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="active">Ativo na Loja</option>
                  <option value="draft">Inativo (Rascunho)</option>
                </select>
              </div>
            </div>

            {/* Imagem do Produto */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Imagem do produto</label>
              
              <div className="flex gap-4 items-start">
                {/* Preview */}
                <div className="relative shrink-0 w-24 h-24 rounded-xl border border-white/10 overflow-hidden bg-[#1A1A1E] flex items-center justify-center">
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" onClick={() => setImageUrl("")}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-6 h-6 text-zinc-600" />
                  )}
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-2">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <Button
                    type="button" variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white h-10 px-5 rounded-lg w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" /> Enviar do computador
                  </Button>
                  <div className="relative">
                    <input 
                      type="text"
                      value={imageUrl.startsWith("data:") ? "" : imageUrl}
                      onChange={(e) => { setImageUrl(e.target.value); setImageSource("url"); }}
                      placeholder="ou cole uma URL de imagem aqui"
                      className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2 text-sm text-zinc-400 focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600">Recomendado: 600 × 600 px · máx 5MB</p>
                  {imageUrl.startsWith("data:") && (
                    <p className="text-[10px] text-emerald-500">✓ Imagem carregada do seu computador</p>
                  )}
                </div>
              </div>

              {/* Hidden input to carry imageUrl value */}
              <input type="hidden" name="coverUrl" value={imageUrl} />
            </div>

            {/* Tipo de Entrega */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Tipo de entrega após pagamento</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div 
                  onClick={() => setDeliveryType("telegram")}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${deliveryType === "telegram" ? "border-blue-500 bg-blue-500/5" : "border-white/5 bg-[#1A1A1E] hover:border-white/10"}`}
                >
                  <p className={`text-sm font-bold ${deliveryType === "telegram" ? "text-white" : "text-zinc-300"}`}>Grupo / Canal Telegram</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Bot envia link de convite automaticamente</p>
                </div>
                <div 
                  onClick={() => setDeliveryType("external")}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${deliveryType === "external" ? "border-blue-500 bg-blue-500/5" : "border-white/5 bg-[#1A1A1E] hover:border-white/10"}`}
                >
                  <p className={`text-sm font-bold ${deliveryType === "external" ? "text-white" : "text-zinc-300"}`}>Link externo</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Bot envia qualquer link após pagamento</p>
                </div>
              </div>
              
              {deliveryType === "telegram" && (
                <div>
                  <input 
                    type="text" name="deliveryValue"
                    placeholder="Ex: -1001234567890"
                    className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1.5"><strong>Como obter o ID:</strong> Encaminhe uma mensagem do canal/grupo para @userinfobot.</p>
                  <p className="text-[10px] text-amber-500/80 mt-0.5">⚠ O bot precisa ser <strong>administrador</strong> do grupo/canal para gerar links de convite.</p>
                </div>
              )}
              {deliveryType === "external" && (
                <input 
                  type="url" name="deliveryValue"
                  placeholder="Ex: https://meudrive.com/arquivo"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              )}
            </div>

            {/* Bot + Categoria */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Vincular Bot</label>
                <select name="botId" defaultValue={product?.botId || ''} className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="">Todos os Bots (Loja Geral)</option>
                  {bots?.map(b => (
                    <option key={b.id} value={b.id}>{b.displayName || `@${b.username}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Categoria</label>
                <select name="categoryId" defaultValue={product?.categoryId || ''} className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="">Sem Categoria</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-3 bg-[#121214]">
          <Button 
            type="button" variant="ghost" onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white hover:bg-white/5 px-6 rounded-lg font-medium"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" form="edit-product-form" disabled={loading} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-8 shadow-lg shadow-blue-600/20"
          >
            {loading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
