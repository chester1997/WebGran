"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Bell, 
  Check, 
  Copy, 
  ExternalLink, 
  QrCode, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  UserPlus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Send,
  X,
  Smartphone,
  ShieldCheck
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getBotNotificationInfoAction,
  generateBotNotificationLinkAction,
  disconnectBotNotificationRecipientAction,
  saveManualBotNotificationRecipientAction,
  sendTestBotNotificationAction,
  BotNotificationRecipientInfo
} from "./actions";

interface BotNotificationModalProps {
  bot: {
    id: string;
    username: string;
    displayName?: string | null;
    status?: string;
  };
  initialStatus?: "active" | "disconnected" | "reconnect";
  initialRecipients?: BotNotificationRecipientInfo[];
  triggerClassName?: string;
}

export function BotNotificationModal({
  bot,
  initialStatus = "disconnected",
  initialRecipients = [],
  triggerClassName,
}: BotNotificationModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"active" | "disconnected" | "reconnect">(initialStatus);
  const [recipients, setRecipients] = useState<BotNotificationRecipientInfo[]>(initialRecipients);
  
  // Link generation & Polling state
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  // Test notification state
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manual advanced ID state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualId, setManualId] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Load current info whenever modal opens
  const refreshStatus = useCallback(async () => {
    try {
      const res = await getBotNotificationInfoAction(bot.id);
      if (res.success) {
        setStatus(res.status);
        setRecipients(res.recipients);
        return res;
      }
    } catch (err) {
      console.error("Erro ao verificar status dos avisos:", err);
    }
    return null;
  }, [bot.id]);

  useEffect(() => {
    if (open) {
      refreshStatus();
      setTestMessage(null);
      setManualError(null);
    } else {
      // Reset pending generation state when modal closes
      setPendingLink(null);
      setExpiresAt(null);
      setIsExpired(false);
      setJustConnected(false);
    }
  }, [open, refreshStatus]);

  // Polling hook: while a linking flow is active, poll every 3 seconds to auto-detect connection
  useEffect(() => {
    if (!open || !pendingLink || isExpired || justConnected) return;

    const previousCount = recipients.filter(r => r.status === "active").length;

    const interval = setInterval(async () => {
      // Check expiration
      if (expiresAt && new Date() > expiresAt) {
        setIsExpired(true);
        clearInterval(interval);
        return;
      }

      const info = await refreshStatus();
      if (info?.success) {
        const activeCount = info.recipients.filter(r => r.status === "active").length;
        if (activeCount > previousCount || info.status === "active") {
          setJustConnected(true);
          setPendingLink(null);
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [open, pendingLink, expiresAt, isExpired, justConnected, recipients, refreshStatus]);

  // Generate activation link
  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setIsExpired(false);
    setJustConnected(false);
    setTestMessage(null);

    try {
      const res = await generateBotNotificationLinkAction(bot.id);
      if (res.success && res.link) {
        setPendingLink(res.link);
        setExpiresAt(new Date(res.expiresAt));
        // Open Telegram link in a new tab immediately
        window.open(res.link, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setTestMessage({
        type: "error",
        text: err?.message || "Não foi possível gerar o link de ativação. Tente novamente."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!pendingLink) return;
    navigator.clipboard.writeText(pendingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Disconnect recipient
  const handleDisconnect = async (recipientId: string) => {
    setLoading(true);
    try {
      await disconnectBotNotificationRecipientAction(recipientId);
      await refreshStatus();
    } catch (err: any) {
      alert(err?.message || "Erro ao desconectar aviso.");
    } finally {
      setLoading(false);
    }
  };

  // Send test message
  const handleSendTest = async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const res = await sendTestBotNotificationAction(bot.id);
      setTestMessage({
        type: "success",
        text: res.message || "Aviso de teste enviado com sucesso para o Telegram!",
      });
      await refreshStatus();
    } catch (err: any) {
      setTestMessage({
        type: "error",
        text: err?.message || "Falha ao enviar aviso de teste. Verifique se o bot está ativo no Telegram.",
      });
      await refreshStatus();
    } finally {
      setTesting(false);
    }
  };

  // Save manual ID inside "Avançado"
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;

    setSavingManual(true);
    setManualError(null);
    try {
      await saveManualBotNotificationRecipientAction(bot.id, manualId.trim());
      setManualId("");
      setShowAdvanced(false);
      await refreshStatus();
    } catch (err: any) {
      setManualError(err?.message || "Erro ao salvar ID.");
    } finally {
      setSavingManual(false);
    }
  };

  const hasActiveRecipients = recipients.some((r) => r.status === "active");
  const hasBlocked = status === "reconnect" || recipients.some((r) => r.status === "blocked");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={
          triggerClassName ||
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
        }
        title="Configurar avisos de venda deste bot"
      >
        {status === "active" ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <span className="text-emerald-400 font-semibold">Avisos ativos</span>
          </>
        ) : status === "reconnect" ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" aria-hidden="true" />
            <span className="text-amber-400 font-semibold">Reconectar</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-zinc-500" aria-hidden="true" />
            <span className="text-zinc-400">Avisos desligados</span>
          </>
        )}
      </DialogTrigger>

      <DialogContent 
        showCloseButton={false} 
        className="sm:max-w-[520px] bg-[#121214] border border-white/10 p-0 overflow-hidden flex flex-col max-h-[90vh] text-white shadow-2xl rounded-2xl"
        aria-describedby="bot-notification-desc"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#16161A] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Avisos de venda
                <span className="text-xs font-normal text-zinc-400">(@{bot.username})</span>
              </DialogTitle>
              <p id="bot-notification-desc" className="text-xs text-zinc-400">
                Receba alertas instantâneos de cada venda deste bot no seu Telegram.
              </p>
            </div>
          </div>
          <DialogClose className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </DialogClose>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Automatic live status banner */}
          <div aria-live="polite" className="sr-only">
            {justConnected ? "Telegram conectado com sucesso aos avisos de venda!" : ""}
          </div>

          {justConnected && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-300">Conectado com sucesso! ✅</p>
                <p className="text-xs text-emerald-400/90 mt-0.5">
                  Você já começará a receber os avisos de novas vendas neste bot.
                </p>
              </div>
            </div>
          )}

          {/* Alert if blocked / reconnect needed */}
          {hasBlocked && !justConnected && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">Conexão interrompida</p>
                <p className="text-xs text-amber-300/80 mt-1">
                  O bot foi bloqueado no Telegram ou o aviso parou de chegar. Clique em reconectar para reativar em um clique.
                </p>
                <Button
                  size="sm"
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                  className="mt-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold h-8 text-xs"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                  Reconectar agora
                </Button>
              </div>
            </div>
          )}

          {/* Test message notification alert */}
          {testMessage && (
            <div
              className={`rounded-xl p-3.5 text-xs font-medium flex items-center gap-2.5 ${
                testMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {testMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{testMessage.text}</span>
            </div>
          )}

          {/* 1. STATE: Connected View (Recipient List & Actions) */}
          {hasActiveRecipients && !pendingLink && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Pessoas que recebem os avisos ({recipients.filter(r => r.status === "active").length})
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ativo
                </span>
              </div>

              <div className="space-y-2">
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#1A1A1E] border border-white/5 gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 text-xs font-bold">
                        {recipient.displayName?.charAt(0)?.toUpperCase() || "T"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {recipient.displayName || "Lojista"}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
                          ID: ****{recipient.telegramChatId.slice(-4)}
                          {recipient.status === "blocked" && (
                            <span className="ml-2 text-amber-400 font-medium">Bloqueado no Telegram</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(recipient.id)}
                      disabled={loading}
                      title="Desconectar avisos para esta pessoa"
                      className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-8 px-2.5 text-xs shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Desconectar
                    </Button>
                  </div>
                ))}
              </div>

              {/* Action Buttons for connected state */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={testing}
                  className="bg-[#1A1A1E] border-white/10 hover:bg-white/5 text-zinc-200 hover:text-white h-9 text-xs"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-blue-400" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-2 text-blue-400" />
                  )}
                  {testing ? "Enviando teste..." : "Enviar aviso de teste"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                  className="bg-[#1A1A1E] border-white/10 hover:bg-white/5 text-zinc-200 hover:text-white h-9 text-xs"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                  )}
                  Adicionar outra pessoa
                </Button>
              </div>
            </div>
          )}

          {/* 2. STATE: Disconnected OR Generating Link View */}
          {(!hasActiveRecipients || pendingLink) && (
            <div className="space-y-4">
              {!pendingLink ? (
                /* Primary One-Click CTA */
                <div className="text-center py-4 px-2 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
                    <Bell className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Ativação em 1 clique</h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                      O próprio bot @{bot.username} enviará uma mensagem no seu Telegram a cada venda aprovada.
                    </p>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11 text-sm shadow-lg shadow-blue-600/25"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando link...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" /> Ativar avisos de venda
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Step-by-Step Instructions with Polling & QR Code */
                <div className="space-y-4 bg-[#16161A] border border-white/10 rounded-2xl p-4">
                  
                  {/* Status header of active linking */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                      Aguardando você tocar em INICIAR no Telegram...
                    </div>
                    {isExpired ? (
                      <span className="text-xs text-red-400 font-medium">Link expirado</span>
                    ) : (
                      <span className="text-[11px] text-zinc-500 font-mono">Expira em 15 min</span>
                    )}
                  </div>

                  {isExpired ? (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-xs text-zinc-400">
                        O link de ativação expirou por segurança. Gere um novo para continuar.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleGenerateLink}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Gerar novo link
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Short steps with friendly copy */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            1
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">Abra a conversa com o bot</p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Uma nova aba foi aberta no seu navegador. Se não abriu, clique no botão abaixo:
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                size="sm"
                                onClick={() => window.open(pendingLink, "_blank", "noopener,noreferrer")}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir no Telegram
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCopyLink}
                                className="bg-transparent border-white/10 hover:bg-white/5 text-zinc-300 text-xs h-8"
                              >
                                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                                {copied ? "Copiado!" : "Copiar link"}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 pt-2">
                          <span className="w-6 h-6 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            2
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">No Telegram, toque no botão:</p>
                            
                            {/* Stylized SVG illustration of the Telegram "INICIAR" button */}
                            <div className="mt-2 p-3 bg-[#1A1A1E] rounded-xl border border-white/5 flex flex-col items-center justify-center gap-1.5">
                              <div className="w-full max-w-[200px] h-9 bg-[#24A1DE] hover:bg-[#208fcf] text-white font-bold text-xs rounded-lg flex items-center justify-center shadow-md gap-2 tracking-wide uppercase select-none transition-transform hover:scale-[1.02]">
                                <svg 
                                  className="w-4 h-4 fill-white" 
                                  viewBox="0 0 24 24" 
                                  aria-hidden="true"
                                >
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                                </svg>
                                <span>INICIAR</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 text-center">
                                O botão fica fixo no rodapé da conversa no Telegram
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* QR Code fallback for desktop users opening on mobile */}
                      <div className="pt-3 border-t border-white/5 flex flex-col items-center text-center">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2.5">
                          <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Prefere usar o celular? Aponte a câmera com o Telegram:</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl shadow-lg inline-block">
                          <QRCodeSVG
                            value={pendingLink}
                            size={130}
                            level="M"
                            marginSize={0}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Advanced Accordion (Manual ID for expert fallback) */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-semibold text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
            >
              <span>Avançado (inserção manual de ID)</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <form onSubmit={handleSaveManual} className="mt-3 p-3.5 bg-[#16161A] rounded-xl border border-white/5 space-y-3">
                <p className="text-xs text-zinc-400">
                  Caso prefira configurar manualmente, informe o ID numérico do seu usuário pessoal do Telegram (obtido via @userinfobot):
                </p>
                <div>
                  <input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="Ex: 123456789"
                    className="w-full bg-[#1A1A1E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                  {manualError && (
                    <p className="text-xs text-red-400 mt-1.5">{manualError}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingManual || !manualId.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                  >
                    {savingManual ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    Salvar ID manual
                  </Button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#16161A] shrink-0 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Notificações protegidas e criptografadas</span>
          </div>
          <DialogClose className="h-8 px-3 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors cursor-pointer">
            Fechar
          </DialogClose>
        </div>

      </DialogContent>
    </Dialog>
  );
}
