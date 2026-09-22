"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { createProductAction, testTelegramChatAccessAction } from "./actions";

import { DeliveryTestResult } from "@/lib/delivery/telegram-delivery-service";

export function NewProductModal({ categories, bots }: { categories: any[]; bots: any[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<"telegram" | "external">("telegram");
  const [deliveryValue, setDeliveryValue] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [testingAccess, setTestingAccess] = useState(false);
  const [testResult, setTestResult] = useState<DeliveryTestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const handleTestAccess = async () => {
    if (!deliveryValue.trim()) return;
    setTestingAccess(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/seller/products/validate-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryValue: deliveryValue.trim() })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || "Erro ao conectar com a API." });
    } finally {
      setTestingAccess(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("A imagem deve ter no máximo 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("O banner deve ter no máximo 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerUrl(reader.result as string);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!deliveryValue.trim()) {
      setErrorMessage(
        deliveryType === "telegram"
          ? "Informe o ID do Grupo/Canal do Telegram para entrega."
          : "Informe o Link externo para entrega após o pagamento."
      );
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("deliveryType", deliveryType);
    formData.set("deliveryValue", deliveryValue.trim());
    formData.set("coverUrl", imageUrl);
    formData.set("bannerUrl", bannerUrl);

    try {
      const res = await createProductAction(formData);
      if (res?.success) {
        setOpen(false);
        setImageUrl("");
        setBannerUrl("");
        setDeliveryValue("");
        setErrorMessage(null);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao criar produto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setErrorMessage(null); }}>
      <DialogTrigger className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl h-11 px-6 shadow-lg shadow-blue-600/20 w-full sm:w-auto inline-flex items-center justify-center transition-colors">
        <Plus className="w-5 h-5 mr-2" /> Novo Produto
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-2xl w-[94vw] max-w-[calc(100vw-1rem)] bg-[#121214] border border-white/5 p-0 overflow-hidden text-zinc-100 flex flex-col max-h-[90vh] shadow-2xl rounded-2xl">
        <div className="p-4 sm:p-6 border-b border-white/5 shrink-0 flex items-center justify-between">
          <DialogTitle className="text-lg sm:text-xl font-bold text-white">Novo Produto</DialogTitle>
        </div>

        <div className="overflow-y-auto overflow-x-hidden p-4 sm:p-6 custom-scrollbar flex-1 space-y-5 sm:space-y-6 w-full max-w-full">
          {errorMessage && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="new-product-form" onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 w-full">
            
            {/* Título */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Título *</label>
              <input 
                type="text" 
                name="title"
                required
                placeholder="Ex: Plano Mensal Premium"
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
              />
            </div>

            {/* Descrição */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Descrição</label>
              <textarea 
                name="description"
                rows={3}
                placeholder="Detalhe tudo o que o cliente recebe ao comprar este produto..."
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600 resize-none custom-scrollbar"
              ></textarea>
            </div>

            {/* Preço e Duração */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Preço (R$) *</label>
                <input 
                  type="number" 
                  name="price"
                  step="0.01"
                  required
                  min="0"
                  placeholder="0.00"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Duração</label>
                <select name="duration" defaultValue="lifetime" className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semiannual">Semestral</option>
                  <option value="annual">Anual</option>
                  <option value="lifetime">Vitalício</option>
                </select>
              </div>
            </div>

            {/* Desconto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Desconto (%)</label>
                <input 
                  type="number" 
                  name="discount"
                  min="0"
                  max="100"
                  placeholder="0"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="flex items-end pb-1 sm:pb-3">
                <span className="text-xs text-zinc-500">Opcional. Ex: 10 para 10% de desconto</span>
              </div>
            </div>

            {/* Imagem do Produto */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Imagem do produto</label>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start w-full">
                <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg border border-white/10 overflow-hidden bg-[#1A1A1E] flex items-center justify-center self-center sm:self-start">
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setImageUrl("")}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 text-zinc-600" />
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full min-w-0">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white h-10 sm:h-11 px-4 rounded-lg w-full text-xs sm:text-sm truncate"
                  >
                    <Upload className="w-4 h-4 mr-2 shrink-0" /> Enviar imagem do computador
                  </Button>
                  <input 
                    type="text" 
                    value={imageUrl.startsWith("data:") ? "" : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="ou cole uma URL de imagem aqui"
                    className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
                  />
                  <p className="text-[10px] text-zinc-500">Recomendado: 600 × 600 px - máx 5MB</p>
                </div>
              </div>
              <input type="hidden" name="coverUrl" value={imageUrl} />
            </div>

            {/* Banner Horizontal (16:9 / Top 15) — Opcional */}
            <div className="w-full pt-2 border-t border-white/5">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Banner Horizontal 16:9 / Top 15 <span className="text-zinc-500 font-normal lowercase">(opcional)</span>
              </label>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start w-full">
                <div className="relative shrink-0 w-32 sm:w-36 h-20 sm:h-22 rounded-lg border border-white/10 overflow-hidden bg-[#1A1A1E] flex items-center justify-center self-center sm:self-start">
                  {bannerUrl ? (
                    <>
                      <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setBannerUrl("")}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 text-zinc-600" />
                  )}
                </div>

                <div className="flex-1 space-y-2 w-full min-w-0">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={bannerFileInputRef} 
                    onChange={handleBannerFileChange} 
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => bannerFileInputRef.current?.click()}
                    className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white h-10 sm:h-11 px-4 rounded-lg w-full text-xs sm:text-sm truncate"
                  >
                    <Upload className="w-4 h-4 mr-2 shrink-0" /> Enviar banner horizontal (16:9)
                  </Button>
                  <input 
                    type="text" 
                    value={bannerUrl.startsWith("data:") ? "" : bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="ou cole uma URL de banner horizontal aqui"
                    className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
                  />
                  <p className="text-[10px] text-zinc-500">Recomendado: 1200 × 675 px (16:9) - Imagem especial para Top 15</p>
                </div>
              </div>
              <input type="hidden" name="bannerUrl" value={bannerUrl} />
            </div>

            {/* Tipo de Entrega */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                Tipo de entrega após pagamento *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 w-full">
                <div 
                  onClick={() => setDeliveryType("telegram")}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${deliveryType === "telegram" ? "border-blue-500 bg-blue-500/5" : "border-white/5 bg-[#1A1A1E] hover:border-white/10"}`}
                >
                  <p className={`text-sm font-bold ${deliveryType === "telegram" ? "text-white" : "text-zinc-300"}`}>Grupo / Canal Telegram</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Bot envia link de convite automaticamente</p>
                </div>
                <div 
                  onClick={() => setDeliveryType("external")}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${deliveryType === "external" ? "border-blue-500 bg-blue-500/5" : "border-white/5 bg-[#1A1A1E] hover:border-white/10"}`}
                >
                  <p className={`text-sm font-bold ${deliveryType === "external" ? "text-white" : "text-zinc-300"}`}>Link externo</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-tight">Bot envia qualquer link após pagamento</p>
                </div>
              </div>
              
              <input type="hidden" name="deliveryType" value={deliveryType} />

              {/* Input for Delivery */}
              {deliveryType === "telegram" && (
                <div className="space-y-2 w-full">
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <input 
                      type="text"
                      name="deliveryValue"
                      required
                      value={deliveryValue}
                      onChange={(e) => {
                        setDeliveryValue(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="Ex: -1001234567890"
                      className="flex-1 bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={testingAccess || !deliveryValue.trim()}
                      onClick={handleTestAccess}
                      className="bg-[#1A1A1E] border-white/10 hover:bg-white/5 text-xs text-zinc-300 h-10 sm:h-11 px-4 rounded-lg shrink-0 font-medium w-full sm:w-auto"
                    >
                      {testingAccess ? "Testando..." : "🔍 Testar conexão"}
                    </Button>
                  </div>

                  {testResult && (
                    testResult.success ? (
                      <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-1.5 font-sans">
                        <p className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 mb-2">
                          ✓ Canal encontrado
                        </p>
                        <p><strong>Nome:</strong> {testResult.chatName || "Grupo/Canal Telegram"}</p>
                        {testResult.chatType && <p><strong>Tipo:</strong> {testResult.chatType}</p>}
                        <p className="text-emerald-400 font-semibold mt-1">✓ Bot verificado com permissão de Administrador (pode convidar usuários)</p>
                      </div>
                    ) : (
                      <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs whitespace-pre-line font-sans leading-relaxed">
                        {testResult.error}
                      </div>
                    )
                  )}

                  <div className="text-[11px] text-zinc-500 leading-relaxed">
                    <p><strong>Como obter o ID:</strong> Acesse algum bot de ID no Telegram e encaminhe uma mensagem do canal/grupo.</p>
                    <p className="text-amber-500/80 mt-1">⚠️ O bot de vendas precisa ser <strong>administrador</strong> do grupo/canal para gerar links de convite.</p>
                  </div>
                </div>
              )}

              {deliveryType === "external" && (
                <div className="space-y-1.5 w-full">
                  <input 
                    type="url" 
                    name="deliveryValue"
                    required
                    value={deliveryValue}
                    onChange={(e) => setDeliveryValue(e.target.value)}
                    placeholder="Ex: https://meudrive.com/arquivo"
                    className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Vínculo de Bot e Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Vincular Bot</label>
                <select 
                  name="botId" 
                  value={selectedBotId} 
                  onChange={(e) => setSelectedBotId(e.target.value)} 
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="">Todos os Bots (Loja Geral)</option>
                  {bots?.map(b => (
                    <option key={b.id} value={b.id}>{b.displayName || `@${b.username}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Categoria</label>
                <select name="categoryId" defaultValue="" className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="">Sem Categoria</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select name="status" defaultValue="active" className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="active">Ativo na Loja</option>
                  <option value="draft">Inativo (Rascunho)</option>
                </select>
              </div>
            </div>

          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-white/5 shrink-0 flex items-center justify-end gap-3 bg-[#121214]">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white hover:bg-white/5 px-4 sm:px-6 rounded-lg font-medium text-xs sm:text-sm"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form="new-product-form"
            disabled={loading} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 sm:px-8 shadow-lg shadow-blue-600/20 text-xs sm:text-sm"
          >
            {loading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
