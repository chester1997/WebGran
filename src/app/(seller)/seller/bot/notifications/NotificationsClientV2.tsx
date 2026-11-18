"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Bell, ChevronDown, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader, Card, Chip, Button, Switch, ConfirmDialog, Toast } from "@/components/seller-v2";
import {
  updateFloatingSettingsAction,
  toggleFloatingNotificationAction,
  deleteFloatingNotificationAction,
  reorderFloatingNotificationsAction,
  seedDefaultFloatingNotificationsAction,
} from "./actions";
import { NotificationModal } from "./NotificationModal";

/**
 * Redesign V2 das Notificações flutuantes — exclusivo da conta proprietária.
 * Usa as mesmas server actions e o mesmo modal de criação/edição da versão clássica.
 */

interface ProductOption {
  id: string;
  title: string;
}

export interface NotificationItemV2 {
  id: string;
  storeId: string;
  productId: string | null;
  text: string;
  icon: string;
  enabled: boolean;
  position: number;
  countMin: number | null;
  countMax: number | null;
  product?: { id: string; title: string } | null;
}

export interface NotificationsSettingsV2 {
  floatingNotificationsEnabled: boolean;
  floatingNotificationsPages: string[];
  floatingNotificationsDisplayDuration: number;
  floatingNotificationsIntervalMin: number;
  floatingNotificationsIntervalMax: number;
}

export interface NotificationsClientV2Props {
  initialSettings: NotificationsSettingsV2;
  notifications: NotificationItemV2[];
  products: ProductOption[];
  hideHeader?: boolean;
}

const PAGES_OPTIONS = [
  { id: "home", label: "Página inicial" },
  { id: "product", label: "Página de produto" },
  { id: "category", label: "Categorias" },
  { id: "search", label: "Busca" },
];

/** Situação de uma mensagem considerando o interruptor geral. */
export function getNotificationStatusLabel(itemEnabled: boolean, globalEnabled: boolean): {
  label: string;
  variant: "active" | "inactive" | "warning";
} {
  if (!itemEnabled) return { label: "Desligada", variant: "inactive" };
  if (!globalEnabled) return { label: "Pronta · pausada", variant: "warning" };
  return { label: "Aparecendo", variant: "active" };
}

export default function NotificationsClientV2({
  initialSettings,
  notifications,
  products,
  hideHeader = false,
}: NotificationsClientV2Props) {
  const router = useRouter();

  const [list, setList] = useState<NotificationItemV2[]>(notifications);
  useEffect(() => setList(notifications), [notifications]);

  const [enabled, setEnabled] = useState(initialSettings.floatingNotificationsEnabled);
  const [pages, setPages] = useState<string[]>(
    initialSettings.floatingNotificationsPages?.length
      ? initialSettings.floatingNotificationsPages
      : ["home", "product", "category", "search"]
  );
  const [displayDuration, setDisplayDuration] = useState(initialSettings.floatingNotificationsDisplayDuration || 5);
  const [intervalMin, setIntervalMin] = useState(initialSettings.floatingNotificationsIntervalMin || 15);
  const [intervalMax, setIntervalMax] = useState(initialSettings.floatingNotificationsIntervalMax || 30);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<NotificationItemV2 | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(notifications[0]?.id || null);

  const readyCount = useMemo(() => list.filter((n) => n.enabled).length, [list]);
  const preview = list.find((n) => n.id === previewId) || list[0] || null;

  const refresh = () => router.refresh();
  const fail = (err: unknown, fallback: string) =>
    setToast({ type: "error", message: (err as Error)?.message || fallback });

  const buildSettings = (overrides: Partial<NotificationsSettingsV2> = {}): NotificationsSettingsV2 => ({
    floatingNotificationsEnabled: enabled,
    floatingNotificationsPages: pages,
    floatingNotificationsDisplayDuration: Number(displayDuration),
    floatingNotificationsIntervalMin: Number(intervalMin),
    floatingNotificationsIntervalMax: Number(intervalMax),
    ...overrides,
  });

  const handleToggleGlobal = async () => {
    const next = !enabled;
    setTogglingGlobal(true);
    try {
      await updateFloatingSettingsAction(buildSettings({ floatingNotificationsEnabled: next }));
      setEnabled(next);
      setToast({ type: "success", message: next ? "Notificações ligadas na vitrine." : "Notificações desligadas na vitrine." });
      refresh();
    } catch (err) {
      fail(err, "Não foi possível alterar as notificações.");
    } finally {
      setTogglingGlobal(false);
    }
  };

  const handleSaveSettings = async () => {
    if (Number(intervalMin) > Number(intervalMax)) {
      setToast({ type: "error", message: "O intervalo mínimo não pode ser maior que o máximo." });
      return;
    }
    setSavingSettings(true);
    try {
      await updateFloatingSettingsAction(buildSettings());
      setToast({ type: "success", message: "Configurações salvas." });
      refresh();
    } catch (err) {
      fail(err, "Erro ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTogglePage = (pageId: string) => {
    setPages((prev) => {
      if (prev.includes(pageId)) return prev.length === 1 ? prev : prev.filter((p) => p !== pageId);
      return [...prev, pageId];
    });
  };

  const handleToggleItem = async (item: NotificationItemV2, next: boolean) => {
    setBusyId(item.id);
    setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, enabled: next } : n)));
    try {
      await toggleFloatingNotificationAction(item.id, next);
      refresh();
    } catch (err) {
      setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, enabled: item.enabled } : n)));
      fail(err, "Não foi possível alterar a mensagem.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    const previous = list;
    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setList(reordered);
    try {
      await reorderFloatingNotificationsAction(reordered.map((n) => n.id));
      refresh();
    } catch (err) {
      setList(previous);
      fail(err, "Não foi possível reordenar.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteFloatingNotificationAction(toDelete.id);
      setList((prev) => prev.filter((n) => n.id !== toDelete.id));
      setToast({ type: "success", message: "Mensagem excluída." });
      setToDelete(null);
      refresh();
    } catch (err) {
      fail(err, "Não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSeed = async () => {
    try {
      await seedDefaultFloatingNotificationsAction();
      setToast({ type: "success", message: "Modelos adicionados." });
      refresh();
    } catch (err) {
      fail(err, "Não foi possível carregar os modelos.");
    }
  };

  const onModalSaved = () => {
    setToast({ type: "success", message: "Mensagem salva." });
    refresh();
  };

  const newButton = (
    <NotificationModal
      products={products}
      onSuccess={onModalSaved}
      triggerButton={
        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
          Nova mensagem
        </Button>
      }
    />
  );

  const previewText = preview ? preview.text.replace(/\{count\}/g, "10") : "";
  const previewProduct = preview?.product?.title || null;
  const pagesSummary = PAGES_OPTIONS.filter((p) => pages.includes(p.id)).map((p) => p.label).join(", ");

  return (
    <div className="space-y-6 w-full pb-16">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} duration={3500} />}

      {!hideHeader ? (
        <PageHeader
          title="Notificações flutuantes"
          subtitle="Avisos curtos que aparecem por cima da vitrine para puxar o cliente para um produto."
          actions={newButton}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-white tracking-tight">Notificações flutuantes</h3>
            <p className="text-xs text-[#9a9aa2]">
              Avisos curtos que aparecem por cima da vitrine para puxar o cliente para um produto.
            </p>
          </div>
          {newButton}
        </div>
      )}

      {/* Interruptor geral em destaque */}
      <Card padding="md" className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${enabled ? "bg-emerald-400" : "bg-zinc-500"}`}
        />
        <div className="flex-1 min-w-[240px] flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-white">
            {enabled ? "Ligadas na vitrine" : "Desligadas na vitrine"}
          </span>
          <span className="text-xs text-[#9a9aa2]">
            {enabled
              ? `${readyCount} ${readyCount === 1 ? "mensagem aparece" : "mensagens aparecem"} para os clientes em: ${pagesSummary}.`
              : readyCount > 0
              ? `${readyCount} ${readyCount === 1 ? "mensagem está pronta" : "mensagens estão prontas"}, mas nenhuma aparece para os clientes enquanto isto estiver desligado.`
              : "Nenhuma mensagem aparece para os clientes."}
          </span>
        </div>
        <Button
          variant={enabled ? "secondary" : "primary"}
          size="md"
          isLoading={togglingGlobal}
          onClick={handleToggleGlobal}
          className={enabled ? "" : "!bg-[#16a34a] hover:!bg-[#15803d]"}
        >
          {enabled ? "Desligar" : "Ligar notificações"}
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {list.length === 0 ? (
            <Card padding="lg" className="flex flex-col items-center text-center gap-3 py-12">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Bell className="w-6 h-6 text-zinc-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Crie sua primeira mensagem</p>
                <p className="text-xs text-[#9a9aa2] max-w-sm">
                  Escreva a sua ou comece pelos modelos prontos e ajuste depois.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button variant="secondary" size="md" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={handleSeed}>
                  Usar modelos prontos
                </Button>
                {newButton}
              </div>
            </Card>
          ) : (
            <Card padding="none" className="overflow-hidden divide-y divide-[#26262a]">
              {list.map((item, index) => {
                const status = getNotificationStatusLabel(item.enabled, enabled);
                const isPreview = preview?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${isPreview ? "bg-[#3b82f6]/[0.06]" : ""}`}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Mover para cima"
                        disabled={index === 0}
                        onClick={() => handleMove(index, "up")}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Mover para baixo"
                        disabled={index === list.length - 1}
                        onClick={() => handleMove(index, "down")}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewId(item.id)}
                      className="flex items-center gap-3 flex-1 min-w-[200px] text-left cursor-pointer"
                      aria-label={`Ver prévia: ${item.text}`}
                    >
                      <span className="w-10 h-10 rounded-xl bg-[#16161a] border border-[#26262a] flex items-center justify-center text-lg shrink-0">
                        {item.icon}
                      </span>
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold text-white truncate">{item.text}</span>
                        <span className="text-xs text-[#9a9aa2] truncate">
                          {item.product ? `Leva para: ${item.product.title}` : "Vale para toda a loja"}
                        </span>
                      </span>
                    </button>
                    <Chip size="sm" variant={status.variant} label={status.label} />
                    <Switch
                      checked={item.enabled}
                      onChange={(next) => handleToggleItem(item, next)}
                      disabled={busyId === item.id}
                      label={<span className="sr-only">{item.enabled ? "Desligar mensagem" : "Ligar mensagem"}</span>}
                    />
                    <NotificationModal
                      notification={item}
                      products={products}
                      onSuccess={onModalSaved}
                      triggerButton={
                        <Button variant="secondary" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />}>
                          Editar
                        </Button>
                      }
                    />
                    <button
                      type="button"
                      aria-label="Excluir mensagem"
                      onClick={() => setToDelete(item)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </Card>
          )}

          {/* Configurações recolhidas */}
          <Card padding="none" className="overflow-hidden">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-white/[0.02]"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-white">Onde e com que frequência</span>
                <span className="text-xs text-[#9a9aa2]">
                  {pagesSummary} · aparece por {displayDuration}s, a cada {intervalMin}–{intervalMax}s
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
            </button>
            {settingsOpen && (
              <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[#26262a]">
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold text-white mb-2">Onde exibir</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PAGES_OPTIONS.map((p) => {
                      const checked = pages.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs cursor-pointer ${
                            checked ? "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-white" : "bg-[#16161a] border-[#26262a] text-[#9a9aa2]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleTogglePage(p.id)}
                            className="accent-[#3b82f6] w-4 h-4"
                          />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "nf-dur", label: "Tempo visível", value: displayDuration, set: setDisplayDuration, max: 60 },
                    { id: "nf-min", label: "Intervalo mín.", value: intervalMin, set: setIntervalMin, max: 300 },
                    { id: "nf-max", label: "Intervalo máx.", value: intervalMax, set: setIntervalMax, max: 300 },
                  ].map((f) => (
                    <div key={f.id} className="flex flex-col gap-1">
                      <label htmlFor={f.id} className="text-[11px] text-[#9a9aa2]">
                        {f.label} (seg)
                      </label>
                      <input
                        id={f.id}
                        type="number"
                        min={1}
                        max={f.max}
                        value={f.value}
                        onChange={(e) => f.set(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-[#16161a] border border-[#26262a] text-white text-sm text-center focus:outline-none focus:border-[#3b82f6]"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="primary" size="md" isLoading={savingSettings} onClick={handleSaveSettings}>
                    Salvar configurações
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Prévia no celular */}
        <aside aria-label="Prévia da notificação" className="lg:col-span-4 space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71717a]">Prévia no celular</span>
          <Card padding="md" className="space-y-3">
            <div className="relative rounded-2xl bg-[#0d0e10] border border-[#26262a] p-3 min-h-[240px] flex flex-col justify-end gap-3">
              <div className="flex-1 rounded-xl bg-[#16161a] flex items-center justify-center text-xs text-[#71717a]">
                Vitrine
              </div>
              {preview ? (
                <div className={`flex items-center gap-3 rounded-xl border p-2.5 ${enabled && preview.enabled ? "bg-[#1f1f24] border-[#34343b]" : "bg-[#1f1f24]/50 border-dashed border-[#34343b] opacity-70"}`}>
                  <span className="w-9 h-9 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-base shrink-0">
                    {preview.icon}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-white leading-tight">{previewText}</span>
                    {previewProduct && !previewText.toLowerCase().includes(previewProduct.toLowerCase()) && (
                      <span className="text-[11px] font-semibold text-[#60a5fa] truncate">{previewProduct}</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#34343b] p-3 text-center text-xs text-[#71717a]">
                  Sem mensagem para mostrar
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#71717a]">
              Toque numa mensagem da lista para ver aqui. {"{count}"} aparece como 10 só na prévia.
            </p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir mensagem"
        description={toDelete ? `“${toDelete.text}” deixa de aparecer na vitrine. Não dá para desfazer.` : ""}
        confirmLabel="Excluir"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
