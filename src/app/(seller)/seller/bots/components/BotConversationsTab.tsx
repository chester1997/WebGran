"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  MessageSquare,
  RefreshCw,
  Loader2,
  Send,
  CheckCircle2,
  Clock,
  HelpCircle,
  AlertCircle,
  ArrowLeft,
  User,
  ShieldCheck,
  SendHorizontal
} from "lucide-react";
import { getBotCustomerMessagesAction, sendTelegramDirectMessageAction } from "../actions";

export interface CustomerItem {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  messagesCount?: number;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  lastMessageDirection?: "inbound" | "outbound" | null;
}

export interface MessageItem {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
}

interface BotConversationsTabProps {
  botId: string;
  botUsername: string;
  initialCustomers: CustomerItem[];
  initialMessages?: MessageItem[];
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function BotConversationsTab({
  botId,
  botUsername,
  initialCustomers,
  initialMessages = [],
  showNotification,
}: BotConversationsTabProps) {
  const [customersList, setCustomersList] = useState<CustomerItem[]>(initialCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Controle de tela móvel: no mobile, alterna entre visualização da lista ou do chat
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Chave de idempotência ativa para retries seguros da mesma mensagem lógica
  const activeClientMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolagem suave para a última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Carregar histórico de mensagens ao selecionar outro cliente
  const handleSelectCustomer = async (cust: CustomerItem) => {
    setSelectedCustomer(cust);
    setMobileChatOpen(true);
    setSendError(null);
    activeClientMessageIdRef.current = null;
    setLoadingMessages(true);
    try {
      const res = await getBotCustomerMessagesAction({
        botId,
        customerId: cust.id,
      });
      if (res.success && res.data) {
        setMessages(res.data.messages);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Recarregar mensagens do chat atual
  const handleRefreshMessages = async () => {
    if (!selectedCustomer) return;
    setLoadingMessages(true);
    setSendError(null);
    try {
      const res = await getBotCustomerMessagesAction({
        botId,
        customerId: selectedCustomer.id,
      });
      if (res.success && res.data) {
        setMessages(res.data.messages);
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Enviar mensagem real via Telegram Bot API com chave de idempotência
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCustomer) return;
    const textToSend = messageText.trim();
    if (!textToSend || sendingMessage) return;

    // Gerar ou reaproveitar o mesmo clientMessageId para retries da mesma mensagem lógica
    if (!activeClientMessageIdRef.current) {
      activeClientMessageIdRef.current = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    }

    const clientMessageId = activeClientMessageIdRef.current;
    setSendingMessage(true);
    setSendError(null);

    try {
      const res = await sendTelegramDirectMessageAction({
        botId,
        customerId: selectedCustomer.id,
        text: textToSend,
        clientMessageId,
      });

      if (res.success && res.data) {
        const newMsg: MessageItem = {
          id: res.data.id,
          direction: "outbound",
          messageType: "text",
          text: res.data.text,
          status: "sent",
          createdAt: res.data.createdAt,
        };
        setMessages((prev) => [...prev, newMsg]);
        setMessageText("");
        activeClientMessageIdRef.current = null; // Sucesso confirmado, limpa chave
        showNotification("success", "Mensagem enviada com sucesso ao cliente no Telegram!");

        // Atualizar lista de leads
        setCustomersList((prev) =>
          prev.map((c) =>
            c.id === selectedCustomer.id
              ? {
                ...c,
                messagesCount: (c.messagesCount || 0) + 1,
                lastMessageText: textToSend,
                lastMessageAt: new Date().toISOString(),
                lastMessageDirection: "outbound",
              }
              : c
          )
        );
      } else {
        setSendError(res.error || "Falha ao enviar mensagem pelo Telegram.");
        showNotification("error", res.error || "Falha no envio.");
      }
    } catch {
      const err = "Erro de conexão ao enviar mensagem.";
      setSendError(err);
      showNotification("error", err);
    } finally {
      setSendingMessage(false);
    }
  };

  const filteredCustomers = customersList.filter((cust) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${cust.firstName || ""} ${cust.lastName || ""}`.toLowerCase();
    const username = (cust.username || "").toLowerCase();
    const tgId = String(cust.telegramUserId);
    return fullName.includes(q) || username.includes(q) || tgId.includes(q);
  });

  return (
    <div className="bg-[#111215] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl min-h-[600px] flex flex-col md:flex-row relative">
      {/* ========================================================= */}
      {/* COLUNA ESQUERDA: LISTA DE CONTATOS                        */}
      {/* (Oculta no mobile se um chat estiver aberto)               */}
      {/* ========================================================= */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-white/[0.08] flex flex-col shrink-0 bg-[#111215] transition-all ${mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
      >
        {/* Topo da lista: Título e Busca */}
        <div className="p-4 border-b border-white/[0.08] bg-[#14151A] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Leads & Clientes</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {customersList.length} contatos registrados
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 tracking-wide">
              TELEGRAM
            </span>
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, @user ou ID..."
              className="w-full bg-[#18191E] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF] transition-colors"
            />
          </div>
        </div>

        {/* Lista de Contatos com Scroll */}
        <div className="overflow-y-auto max-h-[520px] divide-y divide-white/[0.04]">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 space-y-1">
              <p className="font-semibold text-zinc-400">Nenhum contato encontrado</p>
              <p className="text-[11px]">Clientes que iniciarem conversas com o bot aparecerão nesta lista.</p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const isSelected = selectedCustomer?.id === cust.id;
              const name = [cust.firstName, cust.lastName].filter(Boolean).join(" ") || cust.username || `ID ${cust.telegramUserId}`;
              const initial = name.charAt(0).toUpperCase();

              return (
                <div
                  key={cust.id}
                  onClick={() => handleSelectCustomer(cust)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${isSelected
                    ? "bg-[#3984FF]/10 border-l-2 border-[#3984FF] text-white"
                    : "hover:bg-white/[0.03] text-zinc-300"
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-white/10 flex items-center justify-center font-bold text-xs text-[#3984FF] shrink-0 mt-0.5 shadow-sm">
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate tracking-tight">{name}</span>
                      {cust.lastMessageAt && (
                        <span className="text-[10px] text-zinc-500 shrink-0 font-medium">
                          {new Date(cust.lastMessageAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                      {cust.lastMessageText ? (
                        <>
                          <span className="text-zinc-500 text-[10px]">
                            {cust.lastMessageDirection === "outbound" ? "Você: " : ""}
                          </span>
                          <span className="truncate">{cust.lastMessageText}</span>
                        </>
                      ) : cust.username ? (
                        <span className="text-zinc-500 font-mono">@{cust.username}</span>
                      ) : (
                        <span className="text-zinc-500 font-mono">ID: {cust.telegramUserId}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* COLUNA DIREITA: HISTÓRICO E COMPOSIÇÃO DE MENSAGEM        */}
      {/* ========================================================= */}
      <div
        className={`flex-1 flex flex-col justify-between p-4 md:p-6 bg-[#0D0E11] ${!mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
      >
        {selectedCustomer ? (
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            {/* Header do Chat Selecionado */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3 min-w-0">
                {/* Botão Voltar para Lista no Mobile */}
                <button
                  type="button"
                  onClick={() => setMobileChatOpen(false)}
                  className="md:hidden p-2 rounded-xl bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10"
                  title="Voltar para a lista"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="w-10 h-10 rounded-full bg-[#3984FF]/15 border border-[#3984FF]/30 flex items-center justify-center font-bold text-sm text-[#3984FF] shrink-0">
                  {(selectedCustomer.firstName || selectedCustomer.username || "U").charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate tracking-tight">
                    {[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(" ") || selectedCustomer.username || "Cliente"}
                  </h4>
                  <p className="text-xs text-zinc-400 font-mono truncate">
                    {selectedCustomer.username ? `@${selectedCustomer.username}` : `Telegram ID: ${selectedCustomer.telegramUserId}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshMessages}
                  disabled={loadingMessages}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Recarregar mensagens do chat"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? "animate-spin text-[#3984FF]" : ""}`} />
                </button>

                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25">
                  Bot @{botUsername}
                </span>
              </div>
            </div>

            {/* Área de Histórico Cronológico das Mensagens */}
            <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 max-h-[420px] min-h-[260px]">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-48 text-zinc-400 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#3984FF]" />
                  <span>Carregando histórico do Telegram...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500 text-xs space-y-2">
                  <MessageSquare className="w-8 h-8 text-zinc-600 stroke-1" />
                  <p className="font-semibold text-zinc-400">Nenhuma mensagem registrada ainda</p>
                  <p className="text-[11px] max-w-sm text-zinc-500">
                    Mensagens enviadas pelo cliente no bot e respostas do vendedor aparecerão aqui.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isInbound = msg.direction === "inbound";
                  const isSent = msg.status === "sent" || msg.status === "delivered";
                  const isFailed = msg.status === "failed";
                  const isSending = msg.status === "sending";
                  const isPending = msg.status === "pending";
                  const isUnknown = msg.status === "unknown";
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                  let bubbleStyle = "bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white rounded-tr-sm";
                  if (isInbound) {
                    bubbleStyle = "bg-[#18191E] text-zinc-200 border border-white/10 rounded-tl-sm";
                  } else if (isFailed) {
                    bubbleStyle = "bg-rose-950/80 text-rose-200 border border-rose-500/30 rounded-tr-sm";
                  } else if (isUnknown) {
                    bubbleStyle = "bg-amber-950/80 text-amber-200 border border-amber-500/40 rounded-tr-sm";
                  } else if (isSending) {
                    bubbleStyle = "bg-blue-950/70 text-blue-100 border border-blue-500/30 rounded-tr-sm";
                  } else if (isPending) {
                    bubbleStyle = "bg-zinc-800/90 text-zinc-300 border border-zinc-700 rounded-tr-sm";
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[82%] md:max-w-[75%] rounded-2xl px-4 py-3 text-xs shadow-md space-y-1.5 ${bubbleStyle}`}>
                        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold opacity-75">
                          <span>{isInbound ? (selectedCustomer.firstName || "Cliente") : "Você (WebGran)"}</span>
                          <span className="text-[9px] font-normal">{timeStr}</span>
                        </div>

                        <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.text || "[Mensagem sem texto]"}</p>

                        {!isInbound && (
                          <div className="flex items-center justify-end gap-1.5 pt-0.5 text-[9px]">
                            {isSent && (
                              <span className="flex items-center gap-1 text-emerald-300 font-medium">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Enviado ao Telegram
                              </span>
                            )}
                            {isSending && (
                              <span className="flex items-center gap-1 text-blue-300 font-medium">
                                <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> Enviando ao Telegram...
                              </span>
                            )}
                            {isPending && (
                              <span className="flex items-center gap-1 text-zinc-400 font-medium">
                                <Clock className="w-3 h-3 text-zinc-400" /> Processando...
                              </span>
                            )}
                            {isUnknown && (
                              <span className="flex items-center gap-1 text-amber-300 font-medium">
                                <HelpCircle className="w-3 h-3 text-amber-400 shrink-0" /> Não confirmado. Verifique o Telegram antes de reenviar.
                              </span>
                            )}
                            {isFailed && (
                              <span className="flex items-center gap-1 text-rose-300 font-medium">
                                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" /> Falha no envio
                              </span>
                            )}
                          </div>
                        )}

                        {(isFailed || isUnknown) && msg.errorMessage && (
                          <div
                            className={`text-[10px] p-2 rounded-lg border mt-1 leading-relaxed ${isUnknown
                              ? "text-amber-300 bg-amber-900/30 border-amber-500/20"
                              : "text-rose-300 bg-rose-900/40 border-rose-500/20"
                              }`}
                          >
                            {msg.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Banner de Erro de Envio (se houver) */}
            {sendError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Barra de Composição e Envio Real */}
            <form onSubmit={handleSendMessage} className="pt-3 border-t border-white/[0.08] flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  activeClientMessageIdRef.current = null;
                }}
                disabled={sendingMessage}
                placeholder="Digite uma mensagem para o cliente no Telegram..."
                className="flex-1 bg-[#16171B] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF] disabled:opacity-50 transition-colors"
              />

              <button
                type="submit"
                disabled={sendingMessage || !messageText.trim()}
                className="p-2.5 rounded-xl bg-[#3984FF] hover:bg-[#2563EB] text-white transition-all disabled:opacity-50 flex items-center justify-center shrink-0 shadow-lg shadow-[#3984FF]/25 cursor-pointer"
                title="Enviar mensagem oficial pelo Telegram"
              >
                {sendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 text-xs py-16 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-zinc-600">
              <MessageSquare className="w-6 h-6 stroke-1" />
            </div>
            <p className="font-semibold text-zinc-400">Nenhum contato selecionado</p>
            <p className="text-[11px] max-w-xs text-zinc-500">
              Escolha um contato na lista à esquerda para visualizar as mensagens e responder diretamente pelo painel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

