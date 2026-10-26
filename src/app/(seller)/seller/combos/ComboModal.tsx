"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Boxes, 
  Upload, 
  X, 
  AlertCircle, 
  Check, 
  Sparkles, 
  DollarSign, 
  Search,
  Package
} from "lucide-react";
import { 
  createComboAction, 
  updateComboAction, 
  ComboItem 
} from "./actions";

interface ActiveProduct {
  id: string;
  title: string;
  price: string;
  coverUrl: string | null;
  status: string;
}

interface ComboModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comboToEdit?: ComboItem | null;
  activeProducts: ActiveProduct[];
  onSuccess: () => void;
}

export function ComboModal({
  open,
  onOpenChange,
  comboToEdit,
  activeProducts,
  onSuccess,
}: ComboModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [promoPrice, setPromoPrice] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [position, setPosition] = useState(0);

  // Product filter in modal
  const [productSearch, setProductSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when comboToEdit changes or modal opens
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (comboToEdit) {
        setTitle(comboToEdit.title);
        setSlug(comboToEdit.slug);
        setSlugManuallyEdited(true);
        setDescription(comboToEdit.description || "");
        setImageUrl(comboToEdit.coverUrl || "");
        setSelectedProductIds(comboToEdit.products.map((p) => p.id));
        setPromoPrice(parseFloat(comboToEdit.price).toFixed(2));
        setStatus(comboToEdit.status as "active" | "inactive");
        setPosition(comboToEdit.position || 0);
      } else {
        setTitle("");
        setSlug("");
        setSlugManuallyEdited(false);
        setDescription("");
        setImageUrl("");
        setSelectedProductIds([]);
        setPromoPrice("");
        setStatus("active");
        setPosition(0);
      }
    }
  }, [open, comboToEdit]);

  // Auto-generate slug while typing title if not manually edited
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!slugManuallyEdited) {
      const generated = newTitle
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setSlug(generated);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("A imagem deve ter no máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl((event.target?.result as string) || "");
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // Calculations
  const selectedProducts = activeProducts.filter((p) =>
    selectedProductIds.includes(p.id)
  );

  const normalPrice = selectedProducts.reduce(
    (sum, p) => sum + parseFloat(p.price || "0"),
    0
  );

  const parsedPromoPrice = parseFloat(promoPrice.replace(",", ".")) || 0;
  const savings = Math.max(0, normalPrice - parsedPromoPrice);
  const savingsPercentage = normalPrice > 0 && parsedPromoPrice > 0 && parsedPromoPrice < normalPrice
    ? Math.round((savings / normalPrice) * 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("Informe o nome do combo.");
      return;
    }

    if (selectedProductIds.length < 2) {
      setErrorMessage("Selecione pelo menos 2 produtos para compor o combo.");
      return;
    }

    if (isNaN(parsedPromoPrice) || parsedPromoPrice <= 0) {
      setErrorMessage("Informe um preço promocional válido e maior que zero.");
      return;
    }

    if (parsedPromoPrice >= normalPrice) {
      setErrorMessage(
        `O preço promocional (R$ ${parsedPromoPrice.toFixed(2)}) deve ser menor que a soma individual dos produtos (R$ ${normalPrice.toFixed(2)}).`
      );
      return;
    }

    setLoading(true);
    try {
      if (comboToEdit) {
        await updateComboAction(comboToEdit.id, {
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          coverUrl: imageUrl || null,
          price: parsedPromoPrice,
          productIds: selectedProductIds,
          status,
          position: Number(position) || 0,
        });
      } else {
        await createComboAction({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          coverUrl: imageUrl || null,
          price: parsedPromoPrice,
          productIds: selectedProductIds,
          status,
          position: Number(position) || 0,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar combo.");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = activeProducts.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1.5rem)] sm:w-full max-w-[calc(100vw-1.5rem)] sm:max-w-2xl md:max-w-3xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col p-0 gap-0 bg-[#13131A] border border-white/10 text-white rounded-2xl shadow-2xl overflow-hidden outline-none"
      >
        {/* Header Fixo */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-white/5 bg-[#16161F] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {comboToEdit ? "Editar Combo" : "Novo Combo de Produtos"}
              </DialogTitle>
              <p className="text-xs text-zinc-400 mt-0.5 truncate hidden sm:block">
                Combine produtos da sua loja com um preço promocional e mostre a economia real ao cliente.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg shrink-0 w-8 h-8"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        {/* Formulário com corpo rolável e rodapé fixo */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5 break-words">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-0">{errorMessage}</span>
              </div>
            )}

            {/* Nome e Slug: 2 colunas no desktop, 1 coluna no mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Nome do Combo *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Ex: Pacote VIP + Acesso Completo"
                  className="w-full bg-[#1A1A24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Slug (URL amigável)
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="pacote-vip-acesso-completo"
                  className="w-full bg-[#1A1A24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600 font-mono text-xs truncate"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Descrição do Combo
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva as vantagens e o que está incluso neste pacote..."
                className="w-full bg-[#1A1A24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* Capa do Combo */}
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Capa do Combo (Opcional)
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-white/10 bg-[#1A1A24] overflow-hidden flex items-center justify-center shrink-0 self-start sm:self-auto">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Capa do Combo" className="w-full h-full object-cover" />
                  ) : (
                    <Boxes className="w-6 h-6 text-zinc-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-[#1A1A24] border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white h-9 px-3 text-xs rounded-xl justify-start truncate"
                    >
                      <Upload className="w-3.5 h-3.5 mr-2 shrink-0 text-emerald-400" />
                      <span className="truncate">{imageUrl ? "Trocar imagem" : "Enviar imagem do computador"}</span>
                    </Button>
                    {imageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setImageUrl("")}
                        className="h-9 px-3 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs rounded-xl shrink-0"
                        title="Remover imagem"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={imageUrl.startsWith("data:") ? "" : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="ou cole uma URL de imagem aqui"
                    className="w-full bg-[#1A1A24] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600 truncate"
                  />
                </div>
              </div>
            </div>

            {/* Seleção de Produtos */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Produtos Participantes *
                </label>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                    selectedProductIds.length >= 2
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {selectedProductIds.length} selecionado{selectedProductIds.length === 1 ? "" : "s"} (mínimo 2)
                </span>
              </div>

              {/* Busca de Produtos */}
              {activeProducts.length > 5 && (
                <div className="relative mb-2.5">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar produto para adicionar..."
                    className="w-full bg-[#1A1A24] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
                  />
                </div>
              )}

              {/* Lista de Produtos com seleção */}
              <div className="max-h-48 sm:max-h-56 overflow-y-auto space-y-1.5 p-1.5 sm:p-2 rounded-xl border border-white/5 bg-[#0E0E14]">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-xs">
                    {productSearch
                      ? "Nenhum produto corresponde à busca."
                      : "Nenhum produto ativo encontrado. Cadastre produtos antes de criar um combo."}
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => toggleProduct(prod.id)}
                        className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all border gap-2 min-w-0 ${
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                            : "bg-[#161620] border-white/5 hover:border-white/15 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              isSelected
                                ? "bg-emerald-500 border-emerald-500 text-black"
                                : "border-zinc-700 bg-zinc-900"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.coverUrl ? (
                              <img src={prod.coverUrl} alt={prod.title} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-600" />
                            )}
                          </div>
                          <span className="text-xs font-medium text-zinc-200 truncate flex-1 min-w-0">
                            {prod.title}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-zinc-300 shrink-0 whitespace-nowrap pl-1 sm:pl-2">
                          R$ {parseFloat(prod.price).toFixed(2)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Card de Precificação e Economia em Tempo Real */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 space-y-3 min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Precificação e Economia</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-stretch">
                <div className="p-3 rounded-xl bg-black/25 border border-white/5 min-w-0 flex flex-col justify-center">
                  <span className="block text-[11px] font-medium text-zinc-400 mb-0.5 truncate">
                    Soma dos Produtos Selecionados
                  </span>
                  <div className="text-lg sm:text-xl font-bold text-zinc-200 truncate">
                    R$ {normalPrice.toFixed(2)}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Preço cheio individual</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 min-w-0 flex flex-col justify-center">
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1 uppercase tracking-wider truncate">
                    Preço Promocional do Combo *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400 font-bold pointer-events-none">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={promoPrice}
                      onChange={(e) => setPromoPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#1A1A24] border border-emerald-500/30 rounded-lg pl-9 pr-3 py-1.5 text-sm text-emerald-300 font-bold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">Valor final cobrado no checkout</p>
                </div>
              </div>

              {/* Badge de Economia em Tempo Real */}
              {selectedProductIds.length >= 2 && parsedPromoPrice > 0 && (
                <div className="pt-2.5 border-t border-emerald-500/15 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {parsedPromoPrice < normalPrice ? (
                    <>
                      <span className="text-zinc-300 font-medium">
                        Economia para o cliente:
                      </span>
                      <span className="font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                        R$ {savings.toFixed(2)} ({savingsPercentage}% OFF)
                      </span>
                    </>
                  ) : (
                    <span className="text-amber-400 text-xs flex items-center gap-1.5 font-medium break-words">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      O preço promocional deve ser menor que R$ {normalPrice.toFixed(2)}.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Status e Posição */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                  className="w-full bg-[#1A1A24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                >
                  <option value="active">Ativo (Visível no catálogo)</option>
                  <option value="inactive">Inativo (Oculto)</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Posição de Exibição
                </label>
                <input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="w-full bg-[#1A1A24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Rodapé Fixo com Ações */}
          <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/5 bg-[#16161F] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-9 sm:h-10 px-4 bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300 hover:text-white text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedProductIds.length < 2 || parsedPromoPrice <= 0 || parsedPromoPrice >= normalPrice}
              className="w-full sm:w-auto h-9 sm:h-10 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? "Salvando..." : comboToEdit ? "Salvar Alterações" : "Criar Combo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
