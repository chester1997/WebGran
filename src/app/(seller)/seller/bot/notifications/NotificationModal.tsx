"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Sparkles, X, Package, Hash } from "lucide-react";
import { saveFloatingNotificationAction, FloatingNotificationInput } from "./actions";

interface ProductOption {
  id: string;
  title: string;
}

interface NotificationModalProps {
  notification?: FloatingNotificationInput | null;
  products: ProductOption[];
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

const EMOJI_PRESETS = ["🔥", "👀", "⚡", "❤️", "🛒", "🛍️", "💥", "⭐", "🎉", "👑", "🚀", "📢"];

export function NotificationModal({ notification, products, onSuccess, triggerButton }: NotificationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [icon, setIcon] = useState("🔥");
  const [productId, setProductId] = useState<string>("");
  const [countMin, setCountMin] = useState<number>(5);
  const [countMax, setCountMax] = useState<number>(18);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (notification) {
      setText(notification.text || "");
      setIcon(notification.icon || "🔥");
      setProductId(notification.productId || "");
      setCountMin(notification.countMin ?? 5);
      setCountMax(notification.countMax ?? 18);
      setEnabled(notification.enabled !== undefined ? notification.enabled : true);
    } else {
      setText("🔥 {count} pessoas estão comprando agora");
      setIcon("🔥");
      setProductId("");
      setCountMin(5);
      setCountMax(18);
      setEnabled(true);
    }
  }, [notification, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Digite o texto da mensagem.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveFloatingNotificationAction({
        id: notification?.id,
        text,
        icon,
        productId: productId || null,
        countMin: text.includes("{count}") ? Number(countMin) : null,
        countMax: text.includes("{count}") ? Number(countMax) : null,
        enabled,
      });

      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar notificação.");
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    setText((prev) => `${prev} ${variable}`.trim());
  };

  return (
    <>
      {triggerButton ? (
        <div onClick={() => setIsOpen(true)}>{triggerButton}</div>
      ) : notification ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/5 transition-all cursor-pointer"
          title="Editar notificação"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Mensagem</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm fade-in">
          <div className="bg-[#121215] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#16161C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {notification ? "Editar Notificação" : "Nova Notificação Flutuante"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Icon presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Ícone de Destaque</label>
                <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all shrink-0 border cursor-pointer ${
                        icon === emoji
                          ? "bg-red-500/20 border-red-500/50 text-white scale-105 shadow-md shadow-red-500/10"
                          : "bg-[#18181F] border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Texto da Mensagem</label>
                  <button
                    type="button"
                    onClick={() => insertVariable("{count}")}
                    className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <Hash className="w-3 h-3" /> Inserir &#123;count&#125;
                  </button>
                </div>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ex: 🔥 {count} pessoas estão comprando agora"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181F] border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-red-500/50 transition-colors"
                  required
                />
                <p className="text-[11px] text-zinc-500">
                  Use <code className="text-amber-400 font-mono text-[11px] bg-amber-500/10 px-1 py-0.5 rounded">&#123;count&#125;</code> para gerar um número promocional aleatório a cada exibição.
                </p>
              </div>

              {/* Dynamic {count} Range Settings if text includes {count} */}
              {text.includes("{count}") && (
                <div className="p-3.5 rounded-xl bg-[#181822] border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <Hash className="w-4 h-4" />
                    <span>Configuração da Variável &#123;count&#125;</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 font-medium">Quantidade Mínima</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={countMin}
                        onChange={(e) => setCountMin(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-[#121216] border border-white/10 text-white text-xs text-center focus:outline-none focus:border-amber-500/50 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400 font-medium">Quantidade Máxima</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={countMax}
                        onChange={(e) => setCountMax(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-[#121216] border border-white/10 text-white text-xs text-center focus:outline-none focus:border-amber-500/50 font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Product link (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Vincular a Produto Específico (Opcional)</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181F] border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50 transition-colors"
                >
                  <option value="">Global (Exibir para toda a loja)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500">
                  Se selecionado, a notificação exibirá o título do produto na segunda linha.
                </p>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs font-semibold text-zinc-300">Status da Notificação</span>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    enabled ? "bg-emerald-600" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      enabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar Notificação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
