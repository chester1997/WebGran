"use client";

import { useState, useRef } from "react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit3, Upload, X } from "lucide-react";
import { updateCategoryAction } from "./actions";

export function EditCategoryModal({ category }: { category: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("imageUrl", imageUrl);
    try {
      await updateCategoryAction(category.id, formData);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-2 rounded-md transition-colors border-0 bg-transparent">
        <Edit3 className="w-3.5 h-3.5" /> Editar Categoria
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[550px] w-full bg-[#121214] border border-white/5 p-0 overflow-hidden text-zinc-100 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <DialogTitle className="text-xl font-bold tracking-tight text-white">Editar Categoria</DialogTitle>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <form id={`edit-category-form-${category.id}`} onSubmit={handleSubmit} className="space-y-6">
            
            {/* Nome e Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Nome da Categoria *</label>
                <input 
                  type="text" 
                  name="name"
                  defaultValue={category.name}
                  required
                  placeholder="Ex: Fantasia, Ação"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select 
                  name="status" 
                  defaultValue={category.status}
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-blue-500 appearance-none"
                >
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
                rows={3}
                placeholder="Uma breve descrição sobre os produtos desta categoria..."
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* Imagem */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Imagem / Ícone (Opcional)</label>
              
              {imageUrl && (
                <div className="mb-3 relative w-24 h-24 rounded-lg border border-white/10 overflow-hidden bg-[#1A1A1E]">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-md"
                  >
                    <X className="w-3.5 h-3.5" />
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
                  className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:bg-white/5 hover:text-white shrink-0 h-11 px-6 rounded-lg"
                >
                  <Upload className="w-4 h-4 mr-2" /> Enviar imagem
                </Button>
                <input 
                  type="text" 
                  name="imageUrl"
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="ou cole uma URL aqui"
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
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
            className="text-zinc-400 hover:text-white hover:bg-white/5 px-6 rounded-lg font-medium"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            form={`edit-category-form-${category.id}`}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 rounded-lg shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
