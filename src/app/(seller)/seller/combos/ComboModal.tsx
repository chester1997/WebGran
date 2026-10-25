"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#13131A] border-white/10 text-white p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Boxes className="w-4 h-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              {comboToEdit ? "Editar Combo" : "Novo Combo de Produtos"}
            </DialogTitle>
          </div>
          <p className="text-xs text-zinc-400">
            Combine produtos da sua loja com um preço promocional e mostre a economia real ao cliente.
          </p>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Nome e Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Nome do Combo *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex: Pacote VIP + Acesso Completo"
                className="w-full bg-[#1A1A22] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
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
                className="w-full bg-[#1A1A22] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600 font-mono text-xs"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Descrição do Combo
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as vantagens e o que está incluso neste pacote..."
              className="w-full bg-[#1A1A22] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600 resize-none"
            />
          </div>

          {/* Imagem de Capa */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Capa do Combo (Opcional)
            </label>
            <div className="flex gap-4 items-center">
              <div className="w-20 h-20 rounded-xl border border-white/10 bg-[#1A1A22] overflow-hidden flex items-center justify-center shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="Capa do Combo" className="w-full h-full object-cover" />
                ) : (
                  <Boxes className="w-6 h-6 text-zinc-600" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#1A1A22] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white h-9 px-3 text-xs rounded-lg w-full justify-start"
                >
                  <Upload className="w-3.5 h-3.5 mr-2 shrink-0" />
                  {imageUrl ? "Trocar imagem" : "Enviar imagem do computador"}
                </Button>
                <input
                  type="text"
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="ou cole uma URL de imagem aqui"
                  className="w-full bg-[#1A1A22] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>

          {/* Seleção de Produtos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>Produtos Participantes *</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  selectedProductIds.length >= 2
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}>
                  {selectedProductIds.length} selecionado{selectedProductIds.length === 1 ? "" : "s"} (mínimo 2)
                </span>
              </label>
            </div>

            {/* Busca de Produtos */}
            {activeProducts.length > 5 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produto para adicionar..."
                  className="w-full bg-[#1A1A22] border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
                />
              </div>
            )}

            {/* Lista de Produtos com seleção */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 rounded-xl border border-white/5 bg-[#0E0E14] p-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  Nenhum produto ativo encontrado. Cadastre produtos antes de criar um combo.
                </div>
              ) : (
                filteredProducts.map((prod) => {
                  const isSelected = selectedProductIds.includes(prod.id);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => toggleProduct(prod.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                          : "bg-[#16161E] border-white/5 hover:border-white/10 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500 text-black"
                            : "border-zinc-700 bg-zinc-900"
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="w-8 h-8 rounded bg-zinc-900 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                          {prod.coverUrl ? (
                            <img src={prod.coverUrl} alt={prod.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
                        <span className="text-xs font-medium truncate">{prod.title}</span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-400 shrink-0 ml-2">
                        R$ {parseFloat(prod.price).toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card de Precificação e Economia em Tempo Real */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Precificação e Economia</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Soma dos Produtos Selecionados
                </label>
                <div className="text-base font-bold text-zinc-300">
                  R$ {normalPrice.toFixed(2)}
                </div>
                <p className="text-[10px] text-zinc-500">Preço cheio individual</p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-400 mb-1 uppercase tracking-wider font-semibold">
                  Preço Promocional do Combo (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#1A1A22] border border-emerald-500/30 rounded-xl pl-9 pr-3.5 py-2 text-sm text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Badge de Economia em Tempo Real */}
            {selectedProductIds.length >= 2 && parsedPromoPrice > 0 && (
              <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-xs">
                {parsedPromoPrice < normalPrice ? (
                  <>
                    <span className="text-zinc-400">
                      Economia para o cliente:
                    </span>
                    <span className="font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      R$ {savings.toFixed(2)} ({savingsPercentage}% OFF)
                    </span>
                  </>
                ) : (
                  <span className="text-amber-400 text-xs flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    O preço promocional deve ser menor que R$ {normalPrice.toFixed(2)}.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Status e Posição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="w-full bg-[#1A1A22] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="active">Ativo (Visível no catálogo)</option>
                <option value="inactive">Inativo (Oculto)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Posição de Exibição
              </label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="w-full bg-[#1A1A22] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-transparent border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedProductIds.length < 2 || parsedPromoPrice <= 0 || parsedPromoPrice >= normalPrice}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5"
            >
              {loading ? "Salvando..." : comboToEdit ? "Salvar Alterações" : "Criar Combo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
