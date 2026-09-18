"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
  DialogClose
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { saveBotAction } from "./actions";

export function BotSettingsModal({ store, bot, triggerText, isCard, className }: { store: any; bot?: any; triggerText?: string; isCard?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{type: "success"|"error", message: string} | null>(null);
  
  // Theme colors options (like the reference)
  const colors = [
    "#8B5CF6", // blue
    "#A855F7", // Purple
    "#3B82F6", // Blue
    "#EF4444", // Red
    "#10B981", // Emerald
    "#F97316", // Orange
    "#06B6D4", // Cyan
    "#EC4899", // Pink
    "#000000"  // Black
  ];
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    
    try {
      const formData = new FormData(e.currentTarget);
      if (bot?.id) formData.set("existingBotId", bot.id);
      await saveBotAction(formData);
      setFeedback({ type: "success", message: "Bot configurado! Webhook e botão azul atualizados automaticamente." });
      setTimeout(() => { setOpen(false); setFeedback(null); }, 2000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Erro ao salvar bot." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
        {isCard ? (
          <DialogTrigger className="flex flex-col items-center justify-center gap-3 h-full min-h-[280px] bg-[#1A1A1E]/50 hover:bg-[#1A1A1E] border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-2xl transition-all group text-zinc-400 hover:text-white w-full">
            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium">{triggerText || "Adicionar bot"}</span>
          </DialogTrigger>
        ) : (
          <DialogTrigger className={className || "bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 px-4 py-2 rounded-md text-sm inline-flex items-center justify-center transition-colors"}>
            {triggerText || (bot ? "Editar Bot" : "+ Adicionar bot")}
          </DialogTrigger>
        )}

      <DialogContent className="sm:max-w-[500px] bg-[#121214] border-white/5 p-0 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <DialogTitle className="text-xl font-bold text-white tracking-tight">{bot ? "Editar bot" : "Adicionar bot"}</DialogTitle>
          <DialogClose className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </DialogClose>
        </div>

        <div className="p-6 custom-scrollbar overflow-y-auto flex-1">
          <form id="bot-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Token do Bot */}
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Token do Bot *</label>
              <input 
                type="text" 
                name="token"
                required
                defaultValue={bot ? "••••••••••••••••••••••••" : ""}
                placeholder="1234567890:ABCDefGhIjKlMnOpQRstUVwxyZ"
                className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600 font-mono"
              />
              <p className="text-xs text-zinc-500 mt-2">
                Obtenha em <span className="text-blue-400">@BotFather</span>
              </p>
            </div>

            <div className="pt-4 border-t border-white/5">
              <h3 className="font-bold text-white mb-4">Personalização do Mini App</h3>
              
              {/* Nome exibido */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-zinc-300 mb-2">Nome exibido no mini app</label>
                <input 
                  type="text" 
                  name="name"
                  defaultValue={store.name}
                  placeholder="Ex: Flex IPTV, Premium TV..."
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                />
              </div>

              {/* Logo */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-zinc-300 mb-2">Logo</label>
                <div className="flex gap-3">
                  <input 
                    type="url" 
                    name="logoUrl"
                    defaultValue={store.logoUrl || ""}
                    placeholder="https://..."
                    className="flex-1 bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                  />
                  <Button type="button" variant="outline" className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:text-white hover:bg-white/5 shrink-0 px-6">
                    <Upload className="w-4 h-4 mr-2" /> Enviar
                  </Button>
                </div>
              </div>

              {/* Cor principal */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-zinc-300 mb-2">Cor principal do mini app</label>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${selectedColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Nome do botão */}
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Nome do botão (Telegram)</label>
                <input 
                  type="text" 
                  name="buttonName"
                  defaultValue="Abrir App"
                  maxLength={16}
                  className="w-full bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Máx. 16 caracteres - aparece no botão fixo do Telegram e na mensagem de boas-vindas
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#121214] shrink-0 space-y-3">
          {feedback && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {feedback.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {feedback.message}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              form="bot-form"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6"
            >
              {loading ? "Configurando bot..." : "Salvar e Ativar Bot"}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
