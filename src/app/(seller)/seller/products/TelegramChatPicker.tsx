"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, Radio, Loader2 } from "lucide-react";
import { getStoreBotsAction, getBotChatsAction, syncBotChatsAction } from "./actions";

interface BotChat {
  id: string;
  telegramChatId: string;
  title: string;
  type: string;
  username?: string | null;
  botStatus: string;
  canInviteUsers: boolean;
  isActive: boolean;
}

interface TelegramBot {
  id: string;
  botId: string;
  username: string;
  displayName: string;
  photoUrl?: string | null;
}

interface TelegramChatPickerProps {
  selectedBotId: string;
  setSelectedBotId: (botId: string) => void;
  deliveryValue: string;
  setDeliveryValue: (value: string) => void;
  bots?: TelegramBot[];
}

export function TelegramChatPicker({
  selectedBotId,
  setSelectedBotId,
  deliveryValue,
  setDeliveryValue,
  bots: initialBots,
}: TelegramChatPickerProps) {
  const [bots, setBots] = useState<TelegramBot[]>(initialBots || []);
  const [chats, setChats] = useState<BotChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load bots if not passed
  useEffect(() => {
    let isMounted = true;
    async function loadBots() {
      try {
        const fetchedBots = await getStoreBotsAction();
        if (isMounted) {
          setBots(fetchedBots);
          if (fetchedBots.length > 0 && !selectedBotId) {
            setSelectedBotId(fetchedBots[0].id);
          }
        }
      } catch (err: any) {
        console.error("Error loading bots:", err);
      }
    }
    if (!initialBots || initialBots.length === 0) {
      loadBots();
    } else if (initialBots.length > 0 && !selectedBotId) {
      setSelectedBotId(initialBots[0].id);
    }
    return () => { isMounted = false; };
  }, [initialBots, selectedBotId, setSelectedBotId]);

  // Load chats whenever selectedBotId changes
  useEffect(() => {
    let isMounted = true;
    async function loadChats() {
      setLoading(true);
      setError(null);
      try {
        const fetchedChats = await getBotChatsAction(selectedBotId);
        if (isMounted) {
          setChats(fetchedChats);
        }
      } catch (err: any) {
        if (isMounted) setError("Erro ao carregar grupos/canais.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadChats();
    return () => { isMounted = false; };
  }, [selectedBotId]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const updatedChats = await syncBotChatsAction(selectedBotId);
      setChats(updatedChats);
    } catch (err: any) {
      setError(err?.message || "Falha ao sincronizar com o Telegram.");
    } finally {
      setSyncing(false);
    }
  };

  const getChatTypeLabel = (type: string) => {
    switch (type) {
      case "channel":
        return "Canal";
      case "supergroup":
        return "Supergrupo";
      case "group":
        return "Grupo";
      default:
        return "Grupo/Canal";
    }
  };

  const currentBot = bots.find(b => b.id === selectedBotId) || bots[0];

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#121215] p-4 text-white">
      {/* Bot Selector (If multiple bots exist) */}
      {bots.length > 1 && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Bot Selecionado
          </label>
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#1A1A1E] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.displayName} (@{bot.username})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sync Header Button */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">Grupo ou Canal de destino</h4>
          <p className="text-xs text-zinc-400">
            {currentBot ? `Grupos e canais conhecidos de @${currentBot.username}` : "Selecione o chat onde o bot é administrador"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-zinc-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
          Carregando grupos e canais...
        </div>
      ) : chats.length === 0 ? (
        /* Empty State */
        <div className="rounded-lg border border-white/5 bg-[#1A1A1E] p-5 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-400 opacity-80" />
          <p className="text-sm font-semibold text-zinc-200">Nenhum grupo ou canal encontrado.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Adicione este bot como administrador de um grupo ou canal e depois clique em Sincronizar.
          </p>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar novamente
          </button>
        </div>
      ) : (
        /* List of Known Chats */
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {chats.map((chat) => {
            const isSelected = deliveryValue === chat.telegramChatId;
            const isAvailable = chat.botStatus === "administrator" && chat.canInviteUsers;

            return (
              <div
                key={chat.id}
                onClick={() => {
                  if (isAvailable) {
                    setDeliveryValue(chat.telegramChatId);
                  }
                }}
                className={`group relative flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10 shadow-sm shadow-blue-500/10"
                    : isAvailable
                    ? "border-white/10 bg-[#1A1A1E] hover:border-white/20 hover:bg-[#222228]"
                    : "cursor-not-allowed border-white/5 bg-red-500/5 opacity-65"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-zinc-500 bg-transparent"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{chat.title}</span>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                        {getChatTypeLabel(chat.type)}
                      </span>
                    </div>

                    {chat.username && (
                      <p className="text-xs text-zinc-400">@{chat.username}</p>
                    )}

                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      {chat.botStatus === "administrator" ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                          <ShieldCheck className="h-3 w-3" /> Bot administrador
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-red-400">
                          <ShieldAlert className="h-3 w-3" /> Bot sem privilégios de admin
                        </span>
                      )}

                      {chat.canInviteUsers ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Pode gerar convites
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Sem permissão para gerar convites
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Chat ID Summary */}
      {deliveryValue && (
        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#16161a] px-3 py-2 text-xs">
          <span className="text-zinc-400">Chat ID Selecionado:</span>
          <code className="font-mono font-bold text-blue-400">{deliveryValue}</code>
        </div>
      )}
    </div>
  );
}
