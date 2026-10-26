"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  Search,
  Package,
  Plus,
  Trash2,
  TrendingUp,
  Tag
} from "lucide-react";
import { 
  createComboAction, 
  updateComboAction, 
  ComboItem,
  ComboType,
  EligibilityMode,
  TierInput
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

interface EditableTier {
  id?: string;
  minQuantity: number;
  price: string;
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

  // Type & Eligibility
  const [comboType, setComboType] = useState<ComboType>("curated");
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>("all_products");

  // Basic Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [position, setPosition] = useState(0);

  // Curated Combo State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [promoPrice, setPromoPrice] = useState("");

  // Progressive Offer State (Tiers)
  const [tiers, setTiers] = useState<EditableTier[]>([
    { minQuantity: 3, price: "12.00" },
    { minQuantity: 5, price: "18.00" },
  ]);

  // Product filter in modal
  const [productSearch, setProductSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when comboToEdit changes or modal opens
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (comboToEdit) {
        setComboType(comboToEdit.type || "curated");
        setEligibilityMode(comboToEdit.eligibilityMode || "all_products");
        setTitle(comboToEdit.title);
        setSlug(comboToEdit.slug);
        setSlugManuallyEdited(true);
        setDescription(comboToEdit.description || "");
        setImageUrl(comboToEdit.coverUrl || "");
        setSelectedProductIds(comboToEdit.products.map((p) => p.id));
        setPromoPrice(parseFloat(comboToEdit.price).toFixed(2));
        setStatus(comboToEdit.status as "active" | "inactive");
        setPosition(comboToEdit.position || 0);

        if (comboToEdit.tiers && comboToEdit.tiers.length > 0) {
          setTiers(
            comboToEdit.tiers.map((t) => ({
              id: t.id,
              minQuantity: t.minQuantity,
              price: parseFloat(String(t.price)).toFixed(2),
            }))
          );
        } else {
          setTiers([
            { minQuantity: 3, price: "12.00" },
            { minQuantity: 5, price: "18.00" },
          ]);
        }
      } else {
        setComboType("curated");
        setEligibilityMode("all_products");
        setTitle("");
        setSlug("");
        setSlugManuallyEdited(false);
        setDescription("");
        setImageUrl("");
        setSelectedProductIds([]);
        setPromoPrice("");
        setStatus("active");
        setPosition(0);
        setTiers([
          { minQuantity: 3, price: "12.00" },
          { minQuantity: 5, price: "18.00" },
        ]);
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

  // Tier operations
  const handleAddTier = () => {
    const maxQty = tiers.reduce((max, t) => (t.minQuantity > max ? t.minQuantity : max), 2);
    setTiers([...tiers, { minQuantity: maxQty + 2, price: "" }]);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) {
      setErrorMessage("A oferta progressiva deve conter pelo menos uma faixa.");
      return;
    }
    setTiers(tiers.filter((_, i) => i !== index));
    setErrorMessage(null);
  };

  const handleTierChange = (index: number, field: "minQuantity" | "price", val: string) => {
    setErrorMessage(null);
    setTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== index) return tier;
        if (field === "minQuantity") {
          const parsed = parseInt(val, 10);
          return { ...tier, minQuantity: isNaN(parsed) ? 0 : parsed };
        } else {
          return { ...tier, price: val };
        }
      })
    );
  };

  // Calculations for Curated Combo
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

  // Validation logic
  const validateForm = (): string | null => {
    if (!title.trim()) {
      return "Informe o nome da oferta.";
    }

    if (comboType === "curated") {
      if (selectedProductIds.length < 2) {
        return "Selecione pelo menos 2 produtos para compor o combo tradicional.";
      }
      if (isNaN(parsedPromoPrice) || parsedPromoPrice <= 0) {
        return "Informe um preço promocional válido e maior que zero.";
      }
      if (parsedPromoPrice >= normalPrice) {
        return `O preço promocional (R$ ${parsedPromoPrice.toFixed(2)}) deve ser menor que a soma individual dos produtos (R$ ${normalPrice.toFixed(2)}).`;
      }
    } else {
      // Progressive Offer Validation
      if (tiers.length === 0) {
        return "Adicione pelo menos uma faixa de quantidade e preço.";
      }

      const seenQuantities = new Set<number>();
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        if (!t.minQuantity || t.minQuantity < 2) {
          return `A faixa #${i + 1} deve ter quantidade mínima de pelo menos 2 itens.`;
        }
        if (seenQuantities.has(t.minQuantity)) {
          return `A quantidade ${t.minQuantity} itens está duplicada. Cada faixa deve ter uma quantidade distinta.`;
        }
        seenQuantities.add(t.minQuantity);

        const priceNum = parseFloat(String(t.price).replace(",", "."));
        if (isNaN(priceNum) || priceNum <= 0) {
          return `Informe um preço válido e positivo para a faixa de ${t.minQuantity} itens.`;
        }
      }

      if (eligibilityMode === "specific_products" && selectedProductIds.length === 0) {
        return "No modo 'Produtos selecionados', escolha pelo menos 1 produto elegível.";
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationErr = validateForm();
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setLoading(true);
    try {
      if (comboType === "curated") {
        const payload = {
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          coverUrl: imageUrl || null,
          price: parsedPromoPrice,
          productIds: selectedProductIds,
          status,
          position: Number(position) || 0,
          type: "curated" as const,
          eligibilityMode: "specific_products" as const,
        };

        if (comboToEdit) {
          await updateComboAction(comboToEdit.id, payload);
        } else {
          await createComboAction(payload);
        }
      } else {
        // Progressive Offer
        const formattedTiers: TierInput[] = tiers.map((t) => ({
          minQuantity: t.minQuantity,
          price: parseFloat(String(t.price).replace(",", ".")),
        }));

        const payload = {
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          coverUrl: imageUrl || null,
          status,
          position: Number(position) || 0,
          type: "progressive" as const,
          eligibilityMode,
          tiers: formattedTiers,
          productIds: eligibilityMode === "specific_products" ? selectedProductIds : [],
        };

        if (comboToEdit) {
          await updateComboAction(comboToEdit.id, payload);
        } else {
          await createComboAction(payload);
        }
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

  // Sorted tiers for preview
  const sortedTiers = useMemo(() => {
    return [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  }, [tiers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-1.5rem)] sm:w-full max-w-[calc(100vw-1.5rem)] sm:max-w-3xl md:max-w-4xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col p-0 gap-0 bg-[#121218] border border-white/10 text-white rounded-2xl shadow-2xl overflow-hidden outline-none"
      >
        {/* Header Fixo */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-white/5 bg-[#161622] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              comboType === "progressive"
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              {comboType === "progressive" ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <Boxes className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {comboToEdit ? "Editar Oferta" : "Nova Oferta Promocional"}
              </DialogTitle>
              <p className="text-xs text-zinc-400 mt-0.5 truncate hidden sm:block">
                {comboType === "progressive"
                  ? "Configure descontos por volume (ex: 3 por R$ 12) para que o cliente combine produtos."
                  : "Combine produtos específicos com preço reduzido e mostre a economia real."}
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

            {/* SELETOR DE TIPO DE OFERTA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Tipo de Oferta Promocional
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setComboType("curated")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    comboType === "curated"
                      ? "bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/20"
                      : "bg-[#181824] border-white/5 hover:border-white/15 text-zinc-400"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    comboType === "curated" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                  }`}>
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Combo Tradicional</span>
                      {comboType === "curated" && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                      Pacote fechado com produtos específicos e um preço final único.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setComboType("progressive")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    comboType === "progressive"
                      ? "bg-purple-500/10 border-purple-500/40 text-white shadow-lg shadow-purple-950/20"
                      : "bg-[#181824] border-white/5 hover:border-white/15 text-zinc-400"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    comboType === "progressive" ? "bg-purple-500/20 text-purple-400" : "bg-zinc-800 text-zinc-500"
                  }`}>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Oferta Progressiva</span>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-extrabold">
                          Volume
                        </span>
                      </span>
                      {comboType === "progressive" && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                      Leve mais por menos: faixas de quantidade (ex: 3 por R$ 12, 5 por R$ 18).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Nome e Slug: 2 colunas no desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Nome da Oferta *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={comboType === "progressive" ? "Ex: Leve Mais por Menos - Oferta Especial" : "Ex: Pacote VIP + Acesso Completo"}
                  className="w-full bg-[#181824] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600"
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
                  placeholder="promocao-especial-volume"
                  className="w-full bg-[#181824] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600 font-mono text-xs truncate"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Descrição da Promoção
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva as vantagens e as regras para o cliente aproveitar o desconto..."
                className="w-full bg-[#181824] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* Capa */}
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Capa da Oferta (Opcional)
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-white/10 bg-[#181824] overflow-hidden flex items-center justify-center shrink-0 self-start sm:self-auto">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Capa" className="w-full h-full object-cover" />
                  ) : comboType === "progressive" ? (
                    <TrendingUp className="w-6 h-6 text-purple-400/60" />
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
                      className="flex-1 bg-[#181824] border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white h-9 px-3 text-xs rounded-xl justify-start truncate"
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
                    className="w-full bg-[#181824] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors placeholder:text-zinc-600 truncate"
                  />
                </div>
              </div>
            </div>

            {/* CONTEÚDO ESPECÍFICO CONFORME O TIPO */}
            {comboType === "progressive" ? (
              /* SEÇÃO DE OFERTA PROGRESSIVA */
              <div className="space-y-4">
                {/* Modo de Elegibilidade */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-white/10 bg-[#161622] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-purple-400" />
                      <span>Produtos Elegíveis para a Oferta</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      onClick={() => setEligibilityMode("all_products")}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        eligibilityMode === "all_products"
                          ? "bg-purple-500/15 border-purple-500/40 text-white"
                          : "bg-[#181824] border-white/5 hover:border-white/15 text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200">Todos os Produtos</span>
                        {eligibilityMode === "all_products" && (
                          <Check className="w-3.5 h-3.5 text-purple-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        Qualquer produto ativo da loja contabiliza para atingir as faixas.
                      </p>
                    </div>

                    <div
                      onClick={() => setEligibilityMode("specific_products")}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        eligibilityMode === "specific_products"
                          ? "bg-purple-500/15 border-purple-500/40 text-white"
                          : "bg-[#181824] border-white/5 hover:border-white/15 text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200">Produtos Selecionados</span>
                        {eligibilityMode === "specific_products" && (
                          <Check className="w-3.5 h-3.5 text-purple-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        Apenas os produtos marcados abaixo participam da promoção.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seleção de Produtos para modo specific_products */}
                {eligibilityMode === "specific_products" && (
                  <div className="min-w-0 p-3.5 rounded-xl border border-white/10 bg-[#161622] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                        Selecione os Produtos Participantes *
                      </label>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {selectedProductIds.length} selecionado{selectedProductIds.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {activeProducts.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Buscar produtos participantes..."
                          className="w-full bg-[#181824] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 placeholder:text-zinc-600"
                        />
                      </div>
                    )}

                    <div className="max-h-44 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-white/5 bg-[#0E0E14]">
                      {filteredProducts.map((prod) => {
                        const isSelected = selectedProductIds.includes(prod.id);
                        return (
                          <div
                            key={prod.id}
                            onClick={() => toggleProduct(prod.id)}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border gap-2 min-w-0 ${
                              isSelected
                                ? "bg-purple-500/15 border-purple-500/30 text-white"
                                : "bg-[#181824] border-white/5 hover:border-white/15 text-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-purple-500 border-purple-500 text-white"
                                    : "border-zinc-700 bg-zinc-900"
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-medium text-zinc-200 truncate flex-1 min-w-0">
                                {prod.title}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-zinc-300 shrink-0">
                              R$ {parseFloat(prod.price).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tabela de Faixas Progressivas */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                        Faixas de Quantidade e Preço
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTier}
                      className="h-7 px-2.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30 rounded-lg flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Faixa</span>
                    </Button>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Defina pacotes por volume (ex: 3 por R$ 12,00; 5 por R$ 18,00). O cliente pode combinar produtos para atingir a quantidade.
                  </p>

                  <div className="space-y-2 mt-2">
                    {tiers.map((tier, idx) => {
                      const qty = tier.minQuantity || 0;
                      const p = parseFloat(String(tier.price).replace(",", ".")) || 0;
                      const unitAvg = qty > 0 && p > 0 ? (p / qty).toFixed(2) : "0.00";

                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl bg-[#14141E] border border-white/5"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                                Quantidade (unidades)
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="2"
                                  required
                                  value={tier.minQuantity || ""}
                                  onChange={(e) => handleTierChange(idx, "minQuantity", e.target.value)}
                                  placeholder="Ex: 3"
                                  className="w-full bg-[#1C1C28] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-purple-400"
                                />
                                <span className="text-xs text-zinc-500 font-semibold px-1">itens</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                                Preço do Pacote (R$)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-400">
                                  R$
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required
                                  value={tier.price}
                                  onChange={(e) => handleTierChange(idx, "price", e.target.value)}
                                  placeholder="12.00"
                                  className="w-full bg-[#1C1C28] border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-purple-300 font-bold focus:outline-none focus:border-purple-400"
                                />
                              </div>
                            </div>

                            <div className="pt-4 flex items-center gap-2 shrink-0">
                              <div className="text-right hidden sm:block">
                                <span className="block text-[9px] uppercase font-semibold text-zinc-500">Média/un</span>
                                <span className="text-xs font-bold text-zinc-300">R$ {unitAvg}</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveTier(idx)}
                                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center transition-colors"
                                title="Remover faixa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Prévia ao vivo das faixas */}
                  <div className="mt-3 pt-3 border-t border-purple-500/20">
                    <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-2">
                      Prévia dos Descontos por Volume:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {sortedTiers.map((t, idx) => {
                        const pNum = parseFloat(String(t.price).replace(",", ".")) || 0;
                        return (
                          <div
                            key={idx}
                            className="bg-[#101018] border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2"
                          >
                            <span className="font-extrabold text-white">{t.minQuantity} unidades</span>
                            <span className="text-purple-400 font-bold">por R$ {pNum.toFixed(2)}</span>
                            {t.minQuantity > 0 && pNum > 0 && (
                              <span className="text-[10px] text-zinc-400">
                                (R$ {(pNum / t.minQuantity).toFixed(2)}/un)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* SEÇÃO DE COMBO TRADICIONAL */
              <div className="space-y-4">
                {/* Seleção de Produtos do Combo Tradicional */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Produtos Participantes do Combo *
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

                  {activeProducts.length > 5 && (
                    <div className="relative mb-2.5">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar produto para adicionar..."
                        className="w-full bg-[#181824] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
                      />
                    </div>
                  )}

                  <div className="max-h-48 sm:max-h-56 overflow-y-auto space-y-1.5 p-1.5 sm:p-2 rounded-xl border border-white/5 bg-[#0E0E14]">
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-6 text-zinc-500 text-xs">
                        {productSearch
                          ? "Nenhum produto corresponde à busca."
                          : "Nenhum produto ativo encontrado."}
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
                                : "bg-[#181824] border-white/5 hover:border-white/15 text-zinc-300"
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
                          required={comboType === "curated"}
                          value={promoPrice}
                          onChange={(e) => setPromoPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#181824] border border-emerald-500/30 rounded-lg pl-9 pr-3 py-1.5 text-sm text-emerald-300 font-bold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
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
              </div>
            )}

            {/* Status e Posição */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-white/5">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Status da Oferta
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                  className="w-full bg-[#181824] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                >
                  <option value="active">Ativo (Visível na loja e aplicando no carrinho)</option>
                  <option value="inactive">Inativo (Pausado)</option>
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
                  className="w-full bg-[#181824] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Rodapé Fixo com Ações */}
          <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/5 bg-[#161622] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
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
              disabled={loading}
              className={`w-full sm:w-auto h-9 sm:h-10 px-6 font-bold text-xs rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all ${
                comboType === "progressive"
                  ? "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/20"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-emerald-500/20"
              }`}
            >
              {loading
                ? "Salvando..."
                : comboToEdit
                ? "Salvar Alterações"
                : comboType === "progressive"
                ? "Criar Oferta Progressiva"
                : "Criar Combo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
