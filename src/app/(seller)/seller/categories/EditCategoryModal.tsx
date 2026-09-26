"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit3, Upload, X, Package, Check, Search } from "lucide-react";
import { updateCategoryAction } from "./actions";
import { IconSelector } from "./IconSelector";

interface ProductItem {
  id: string;
  title: string;
  price: string;
  coverUrl?: string | null;
  categoryId?: string | null;
}

interface EditCategoryModalProps {
  category: any;
  storeProducts?: ProductItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function EditCategoryModal({ 
  category, 
  storeProducts = [],
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger
}: EditCategoryModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (isControlled) {
      setControlledOpen?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || "");
  const [iconName, setIconName] = useState(category?.iconName || "Tv");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setImageUrl(category?.imageUrl || "");
      setIconName(category?.iconName || "Tv");
      // Pre-select products belonging to this category
      const initialAssigned = storeProducts
        .filter((p) => p.categoryId === category.id)
        .map((p) => p.id);
      setSelectedProductIds(initialAssigned);
    }
  }, [open, category, storeProducts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === storeProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(storeProducts.map((p) => p.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("imageUrl", imageUrl);
    formData.set("iconName", iconName);
    
    // Append selected product IDs
    selectedProductIds.forEach((id) => {
      formData.append("selectedProductIds", id);
    });

    try {
      await updateCategoryAction(category.id, formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = storeProducts.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger>
          {trigger}
        </DialogTrigger>
      ) : null}
      
      <DialogContent className="sm:max-w-[600px] w-[94vw] max-w-[calc(100vw-1rem)] bg-[#121214] border border-white/10 p-0 overflow-hidden text-zinc-100 shadow-2xl rounded-2xl">
        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between">
          <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-white">Editar Categoria</DialogTitle>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden max-h-[75vh] custom-scrollbar w-full max-w-full">
          <form id={`edit-category-form-${category.id}`} onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 w-full">
            
            {/* Nome e Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Nome da Categoria</label>
                <input 
                  type="text" 
                  name="name"
                  defaultValue={category.name}
                  placeholder="Ex: Fantasia, Ação"
                  className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select name="status" defaultValue={category.status} className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="active">Ativo na Loja</option>
                  <option value="inactive">Inativo (Oculto)</option>
                </select>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Descrição</label>
              <textarea 
                name="description"
                defaultValue={category.description || ""}
                rows={2}
                placeholder="Uma breve descrição sobre os produtos desta categoria..."
                className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* SELEÇÃO DE PRODUTOS DA CATEGORIA */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span>Produtos nesta Categoria</span>
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Selecione quais produtos pertencem a esta categoria.
                  </p>
                </div>

                {storeProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
                  >
                    {selectedProductIds.length === storeProducts.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </button>
                )}
              </div>

              {storeProducts.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#1A1A1E] border border-white/5 text-center text-xs text-zinc-500">
                  Nenhum produto cadastrado na sua loja ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Buscar produto pelo nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar border border-white/5 p-2 rounded-xl bg-[#18181C]">
                    {filteredProducts.map((product) => {
                      const isChecked = selectedProductIds.includes(product.id);
                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProduct(product.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${
                            isChecked
                              ? "bg-blue-600/10 border-blue-500/30 text-white"
                              : "bg-[#1A1A1E]/50 border-white/5 text-zinc-400 hover:bg-[#1A1A1E]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked ? "bg-blue-600 border-blue-500 text-white" : "border-white/20 bg-black/40"
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            {product.coverUrl ? (
                              <img src={product.coverUrl} alt={product.title} className="w-8 h-8 rounded-md object-cover border border-white/10 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5">
                                <Package className="w-4 h-4 text-zinc-500" />
                              </div>
                            )}

                            <span className="text-xs font-medium truncate">{product.title}</span>
                          </div>

                          <span className="text-xs font-bold text-emerald-400 shrink-0 ml-2">
                            R$ {Number(product.price).toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="text-[11px] text-zinc-500 text-right">
                    {selectedProductIds.length} produto(s) selecionado(s)
                  </div>
                </div>
              )}
            </div>

            {/* Ícone da Categoria */}
            <div className="pt-2 border-t border-white/5">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Ícone da Categoria (Para exibição por Ícones)</label>
              <IconSelector value={iconName} onChange={setIconName} />
            </div>

            {/* Imagem */}
            <div className="pt-2 border-t border-white/5">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Imagem 1:1 Transparent PNG (Para exibição por Imagens)</label>
              
              {imageUrl && (
                <div className="mb-3 relative w-20 h-20 rounded-lg border border-white/10 overflow-hidden bg-[#1A1A1E]">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setImageUrl("")}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
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
                  className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white shrink-0 h-10 px-4 rounded-lg text-xs"
                >
                  <Upload className="w-3.5 h-3.5 mr-2" /> Enviar imagem
                </Button>
                <input 
                  type="text" 
                  name="imageUrl"
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="ou cole uma URL aqui"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-3.5 py-2 text-xs text-zinc-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

          </form>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-3 bg-[#121214]">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white hover:bg-white/5 px-5 rounded-xl text-xs font-medium"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form={`edit-category-form-${category.id}`}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 rounded-xl shadow-lg shadow-blue-600/20 text-xs disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
