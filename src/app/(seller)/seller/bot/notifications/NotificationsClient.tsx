"use client";

import { useState } from "react";
import { 
  Bell, 
  Sparkles, 
  Check, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Package, 
  RotateCcw,
  Sliders,
  Smartphone,
  Save,
  Clock,
  Layers,
  CheckSquare,
  Square
} from "lucide-react";
import { 
  updateFloatingSettingsAction, 
  toggleFloatingNotificationAction, 
  deleteFloatingNotificationAction, 
  reorderFloatingNotificationsAction, 
  seedDefaultFloatingNotificationsAction 
} from "./actions";
import { NotificationModal } from "./NotificationModal";

interface ProductOption {
  id: string;
  title: string;
}

interface NotificationItem {
  id: string;
  storeId: string;
  productId: string | null;
  text: string;
  icon: string;
  enabled: boolean;
  position: number;
  countMin: number | null;
  countMax: number | null;
  product?: {
    id: string;
    title: string;
  } | null;
}

interface NotificationsClientProps {
  initialSettings: {
    floatingNotificationsEnabled: boolean;
    floatingNotificationsPages: string[];
    floatingNotificationsDisplayDuration: number;
    floatingNotificationsIntervalMin: number;
    floatingNotificationsIntervalMax: number;
  };
  notifications: NotificationItem[];
  products: ProductOption[];
}

const PAGES_OPTIONS = [
  { id: "home", label: "Página inicial" },
  { id: "product", label: "Página de produto" },
  { id: "category", label: "Categorias" },
  { id: "search", label: "Busca" },
];

export function NotificationsClient({ initialSettings, notifications, products }: NotificationsClientProps) {
  // Settings state
  const [enabled, setEnabled] = useState(initialSettings.floatingNotificationsEnabled);
  const [pages, setPages] = useState<string[]>(initialSettings.floatingNotificationsPages || ["home", "product", "category", "search"]);
  const [displayDuration, setDisplayDuration] = useState(initialSettings.floatingNotificationsDisplayDuration || 5);
  const [intervalMin, setIntervalMin] = useState(initialSettings.floatingNotificationsIntervalMin || 15);
  const [intervalMax, setIntervalMax] = useState(initialSettings.floatingNotificationsIntervalMax || 30);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Selected item for preview
  const [previewId, setPreviewId] = useState<string | null>(notifications[0]?.id || null);

  const selectedForPreview = notifications.find((n) => n.id === previewId) || notifications[0] || {
    id: "demo",
    text: "🔥 10 pessoas estão comprando agora",
    icon: "🔥",
    productId: null,
    product: { title: "Meu Ovo Negro" },
  };

  const handleTogglePage = (pageId: string) => {
    if (pages.includes(pageId)) {
      if (pages.length === 1) return; // Require at least 1 page
      setPages(pages.filter((p) => p !== pageId));
    } else {
      setPages([...pages, pageId]);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (intervalMin > intervalMax) {
      setSettingsError("O intervalo mínimo não pode ser maior que o intervalo máximo.");
      return;
    }

    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);

    try {
      await updateFloatingSettingsAction({
        floatingNotificationsEnabled: enabled,
        floatingNotificationsPages: pages,
        floatingNotificationsDisplayDuration: Number(displayDuration),
        floatingNotificationsIntervalMin: Number(intervalMin),
        floatingNotificationsIntervalMax: Number(intervalMax),
      });

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      setSettingsError(err?.message || "Erro ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleNotification = async (id: string, currentEnabled: boolean) => {
    await toggleFloatingNotificationAction(id, !currentEnabled);
  };

  const handleDeleteNotification = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta mensagem promocional?")) {
      await deleteFloatingNotificationAction(id);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= notifications.length) return;

    const newOrdered = [...notifications];
    const [moved] = newOrdered.splice(index, 1);
    newOrdered.splice(targetIndex, 0, moved);

    await reorderFloatingNotificationsAction(newOrdered.map((n) => n.id));
  };

  const handleSeedDefaults = async () => {
    if (confirm("Deseja adicionar os modelos de mensagens promocionais pré-configurados?")) {
      await seedDefaultFloatingNotificationsAction();
    }
  };

  // Generate preview text with simulated count (e.g. 10)
  const sampleCount = 10;
  const previewText = selectedForPreview.text.replace(/\{count\}/g, String(sampleCount));
  const previewProductTitle = selectedForPreview.product?.title || (selectedForPreview.productId ? "Produto em Destaque" : null);

  return (
    <div className="space-y-8 fade-in w-full pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
              Recurso Promocional
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">Notificações Flutuantes</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            Exiba pequenas mensagens promocionais durante a navegação da sua loja para aumentar destaque e sensação de atividade.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {notifications.length === 0 && (
            <button
              type="button"
              onClick={handleSeedDefaults}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Carregar Modelos Prontos</span>
            </button>
          )}

          <NotificationModal products={products} />
        </div>
      </div>

      {/* Grid: 2 Columns on XL screens (Settings & Preview left, Messages CRUD right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: General Configuration & Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Configuration Form */}
          <form onSubmit={handleSaveSettings} className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Configurações de Exibição</h3>
                  <p className="text-xs text-zinc-400">Controle o comportamento das notificações</p>
                </div>
              </div>

              {/* Master Toggle */}
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

            {settingsError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                {settingsError}
              </div>
            )}

            {settingsSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4" /> Configurações salvas com sucesso!
              </div>
            )}

            {/* Master Enabled Status Banner */}
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 ${
              enabled 
                ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-300"
                : "bg-zinc-800/40 border-white/5 text-zinc-400"
            }`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${enabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
              <span>
                {enabled 
                  ? "Notificações flutuantes ATIVAS na Mini App." 
                  : "Notificações flutuantes DESATIVADAS. Nenhum aviso será exibido na Mini App."}
              </span>
            </div>

            {/* Where to Display (Onde Exibir) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-red-500" />
                <span>Onde Exibir</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAGES_OPTIONS.map((page) => {
                  const isChecked = pages.includes(page.id);
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => handleTogglePage(page.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                        isChecked
                          ? "bg-red-500/10 border-red-500/30 text-white font-semibold"
                          : "bg-[#18181C] border-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                      <span className="truncate">{page.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timings (Tempo visível & Intervalos) */}
            <div className="space-y-4 pt-2 border-t border-white/5">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span>Tempo & Intervalo (Segundos)</span>
              </label>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-medium">Tempo Visível</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={displayDuration}
                      onChange={(e) => setDisplayDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#18181C] border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-red-500/50"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">seg</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-medium">Intervalo Mín</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={intervalMin}
                      onChange={(e) => setIntervalMin(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#18181C] border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-red-500/50"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">seg</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-medium">Intervalo Máx</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={intervalMax}
                      onChange={(e) => setIntervalMax(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#18181C] border border-white/10 text-white text-xs font-bold text-center focus:outline-none focus:border-red-500/50"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">seg</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500">
                A notificação aparece por {displayDuration}s e depois aguarda um intervalo aleatório entre {intervalMin}s e {intervalMax}s.
              </p>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? "Salvando..." : "Salvar Configurações"}</span>
            </button>
          </form>

          {/* Card 2: Simulated Mini App Live Preview */}
          <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold text-white">Preview Interativo na Mini App</h3>
              </div>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Modo Studio</span>
            </div>

            {/* Simulated Phone Frame */}
            <div className="bg-[#0D0E10] border border-white/10 rounded-2xl p-4 relative min-h-[220px] flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Top Mini App Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[11px] font-bold text-zinc-300">Minha Loja WebGran</span>
                </div>
                <span className="text-[10px] text-zinc-500">Preview</span>
              </div>

              {/* Simulated Content Area */}
              <div className="py-4 space-y-2 text-center text-zinc-600 text-xs">
                <div className="w-24 h-2.5 bg-white/5 rounded-full mx-auto" />
                <div className="w-40 h-2 bg-white/5 rounded-full mx-auto" />
              </div>

              {/* Floating Toast Notification Preview Card */}
              <div className="my-2 p-3 bg-[#14151C]/95 border border-white/10 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-left">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-base shadow-inner">
                  {selectedForPreview.icon || "🔥"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 leading-tight">
                    {previewText}
                  </p>
                  {previewProductTitle && !previewText.toLowerCase().includes(previewProductTitle.toLowerCase()) && (
                    <p className="text-[11px] font-bold text-red-400 truncate mt-0.5">
                      {previewProductTitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Nav Bar Preview */}
              <div className="pt-3 border-t border-white/5 flex justify-around text-zinc-600 text-[10px]">
                <span className="text-red-500 font-bold">Início</span>
                <span>Produtos</span>
                <span>Carrinho</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: CRUD Table / List of Messages (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-500" />
              <span>Mensagens Promocionais</span>
            </h3>
            <span className="text-xs text-zinc-400 font-medium">
              {notifications.length} cadastrada{notifications.length !== 1 ? "s" : ""}
            </span>
          </div>

          {notifications.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center bg-[#121214] rounded-2xl border border-white/5 shadow-xl p-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#1A1A1E] flex items-center justify-center border border-white/5 shadow-inner">
                <Bell className="w-7 h-7 text-zinc-500" />
              </div>
              <div>
                <p className="text-zinc-300 font-bold text-base mb-1">Nenhuma mensagem cadastrada</p>
                <p className="text-zinc-500 text-xs max-w-sm">
                  Crie suas próprias mensagens promocionais ou clique abaixo para carregar os modelos prontos.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Carregar Modelos Prontos</span>
                </button>
                <NotificationModal products={products} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item, index) => {
                const isSelected = item.id === previewId;

                return (
                  <div
                    key={item.id}
                    className={`bg-[#121214] border rounded-2xl p-4 shadow-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected
                        ? "border-red-500/40 bg-red-950/10"
                        : "border-white/5 hover:border-white/10"
                    }`}
                  >
                    {/* Icon & Message Text */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#18181F] border border-white/10 flex items-center justify-center shrink-0 text-xl shadow-inner">
                        {item.icon}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-white truncate">{item.text}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border shrink-0 ${
                              item.enabled
                                ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30"
                                : "bg-zinc-800 text-zinc-400 border-white/10"
                            }`}
                          >
                            {item.enabled ? (
                              <>
                                <Eye className="w-3 h-3 text-emerald-400" /> Ativa
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-zinc-400" /> Inativa
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                          {item.product ? (
                            <span className="flex items-center gap-1 text-red-400 font-semibold">
                              <Package className="w-3 h-3" />
                              {item.product.title}
                            </span>
                          ) : (
                            <span className="text-zinc-500 font-medium">Global (Toda a loja)</span>
                          )}

                          {item.text.includes("{count}") && (
                            <span className="text-amber-400/80 font-medium">
                              Variável &#123;count&#125;: {item.countMin ?? 5} a {item.countMax ?? 18}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 w-full sm:w-auto justify-end">
                      {/* Preview Select Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewId(item.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-red-500 text-white"
                            : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Visualizar no preview"
                      >
                        Preview
                      </button>

                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMove(index, "down")}
                        disabled={index === notifications.length - 1}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* Quick Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleNotification(item.id, item.enabled)}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                          item.enabled ? "bg-emerald-600" : "bg-zinc-700"
                        }`}
                        title={item.enabled ? "Desativar" : "Ativar"}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            item.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>

                      {/* Edit Modal */}
                      <NotificationModal notification={item} products={products} />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteNotification(item.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
