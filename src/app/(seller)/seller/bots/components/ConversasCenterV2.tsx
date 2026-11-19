"use client";

/**
 * Redesign V2 da Central de Conversas — exclusivo da conta proprietária (useRedesignV2).
 * Mesma lógica da versão clássica (ConversasCenter); muda só o visual: lista e chat em
 * painéis flutuantes sobre o fundo de desenhos, coluna central para as mensagens.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  MessageSquare,
  RefreshCw,
  Loader2,
  SendHorizontal,
  Paperclip,
  Smile,
  Mic,
  Trash2,
  X,
  ArrowLeft,
  Clock,
  AlertCircle,
  Hand,
  Volume2,
  FileText,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import {
  getBotCustomerMessagesAction,
  getBotCustomersAction,
  sendTelegramDirectMessageAction,
  toggleBotCustomerManualModeAction,
} from "../actions";
import BotAvatar from "./BotAvatar";
import { SolarSellerConversasIcon } from "@/components/icons/solar/seller-icons";

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
  isManualMode?: boolean;
  manualModeExpiresAt?: string;
}

export interface MessageItem {
  id: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
  mediaUrl?: string | null;
  metadata?: Record<string, any> | null;
}

interface ConversasCenterProps {
  bot: {
    id: string;
    botId: string;
    username: string;
    displayName: string;
    photoUrl?: string | null;
    status: string;
  };
  initialCustomers: CustomerItem[];
  initialMessages?: MessageItem[];
  onClose?: () => void;
  isModal?: boolean;
  showNotification?: (type: "success" | "error", message: string) => void;
}

// Emojis organizados por categorias para a gaveta do compositor
const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    name: "Smileys",
    icon: "😄",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
      "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏",
      "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣"
    ]
  },
  {
    id: "gestures",
    name: "Gestos & Pessoas",
    icon: "👍",
    emojis: [
      "👍", "👎", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚",
      "🖐️", "🖖", "👋", "🤝", "👏", "🙌", "👐", "🤲", "🙏", "💪", "🦾", "❤️", "🧡", "💛", "💚", "💙",
      "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💯", "🔥"
    ]
  },
  {
    id: "animals",
    name: "Animais",
    icon: "🐶",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
      "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌",
      "🐞", "🐜", "🪰", "🪲", "🐙", "🦑", "🦐", "🦞"
    ]
  },
  {
    id: "food",
    name: "Comida",
    icon: "🍕",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥",
      "🥝", "🍅", "🥑", "🥦", "🌽", "🌶️", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆",
      "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿"
    ]
  },
  {
    id: "activities",
    name: "Atividades",
    icon: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍",
      "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌",
      "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "🤺"
    ]
  },
  {
    id: "objects",
    name: "Objetos",
    icon: "💡",
    emojis: [
      "💡", "🔦", "🕯️", "🪔", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "📷", "📸", "📹", "🎥", "📽️",
      "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳",
      "📡", "🔋", "🔌", "💸", "💵", "💴", "💶", "💷"
    ]
  },
  {
    id: "symbols",
    name: "Símbolos",
    icon: "💖",
    emojis: [
      "✨", "⭐️", "🌟", "💫", "⚡️", "☄️", "💥", "🔥", "🌈", "☀️", "🌤️", "⛅️", "🌥️", "☁️", "🌦️", "🌧️",
      "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄️", "🌬️", "💨", "💧", "💦", "🫧", "☂️", "☔️", "⛱️", "⚡️", "🌀",
      "🌁", "🎯", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇"
    ]
  }
];

// Paleta de gradientes dinâmicos para avatares sem foto estilo Telegram
const AVATAR_GRADIENTS = [
  "from-[#3984FF] to-[#1D4ED8]",
  "from-[#8B5CF6] to-[#6D28D9]",
  "from-[#EC4899] to-[#BE185D]",
  "from-[#10B981] to-[#047857]",
  "from-[#F59E0B] to-[#B45309]",
  "from-[#06B6D4] to-[#0E7490]",
  "from-[#6366F1] to-[#4338CA]",
];

function getAvatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

// Agrupador cronológico de mensagens por data
function groupMessagesByDate(messages: MessageItem[]) {
  const groups: { dateLabel: string; messages: MessageItem[] }[] = [];
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const dStr = d.toDateString();
    let dateLabel = "";
    if (dStr === todayStr) {
      dateLabel = "Hoje";
    } else if (dStr === yesterdayStr) {
      dateLabel = "Ontem";
    } else {
      dateLabel = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
    }

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dateLabel === dateLabel) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ dateLabel, messages: [msg] });
    }
  }
  return groups;
}

export default function ConversasCenterV2({
  bot,
  initialCustomers,
  initialMessages = [],
  onClose,
  isModal = false,
  showNotification,
}: ConversasCenterProps) {
  const [customersList, setCustomersList] = useState<CustomerItem[]>(initialCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Modo Manual State
  const [isManualActive, setIsManualActive] = useState(false);
  const [manualExpiresAt, setManualExpiresAt] = useState<string | null>(null);
  const [togglingManual, setTogglingManual] = useState(false);

  // Emojis Drawer State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState("smileys");

  // Anexos State
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    previewUrl?: string;
    base64: string;
    type: "photo" | "document" | "voice";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gravação de Áudio State
  const [audioRecordingState, setAudioRecordingState] = useState<"idle" | "recording" | "preview" | "sending">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Áudio Player da Timeline State
  const [activeAudioPlayingId, setActiveAudioPlayingId] = useState<string | null>(null);
  const timelineAudioRef = useRef<HTMLAudioElement | null>(null);

  // Navegação Mobile (exibe lista ou chat individual)
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Idempotência
  const activeClientMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll suave para última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedFile, showEmojiPicker, audioRecordingState]);

  // Tecla ESC para fechar modal ou gaveta de emojis
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showEmojiPicker, onClose]);

  // Limpar URLs de áudio preview ao desmontar
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  // Carregar mensagens e status manual do cliente ao selecionar
  const handleSelectCustomer = async (cust: CustomerItem) => {
    setSelectedCustomer(cust);
    setMobileChatOpen(true);
    setSendError(null);
    setShowEmojiPicker(false);
    setSelectedFile(null);
    handleDiscardRecordedAudio();
    activeClientMessageIdRef.current = null;
    setLoadingMessages(true);

    try {
      const res = await getBotCustomerMessagesAction({
        botId: bot.id,
        customerId: cust.id,
      });

      if (res.success && res.data) {
        setMessages(res.data.messages);
        setIsManualActive(!!res.data.isManualMode);
        setManualExpiresAt(res.data.manualModeExpiresAt || null);
      } else {
        setMessages([]);
        setIsManualActive(false);
        setManualExpiresAt(null);
      }
    } catch {
      setMessages([]);
      setIsManualActive(false);
      setManualExpiresAt(null);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Recarregar mensagens e lista de clientes manualmente
  const handleRefreshMessages = async () => {
    setLoadingMessages(true);
    setSendError(null);
    try {
      if (selectedCustomer) {
        const res = await getBotCustomerMessagesAction({
          botId: bot.id,
          customerId: selectedCustomer.id,
        });
        if (res.success && res.data) {
          setMessages(res.data.messages);
          setIsManualActive(!!res.data.isManualMode);
          setManualExpiresAt(res.data.manualModeExpiresAt || null);
        }
      }
      const custRes = await getBotCustomersAction(bot.id);
      if (custRes.success && custRes.data) {
        setCustomersList(custRes.data.customers);
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Auto-sincronização periódica da timeline e da lista de clientes (Polling inteligente a cada 2.5s)
  useEffect(() => {
    let isMounted = true;
    let isSyncing = false;

    const syncConversations = async () => {
      if (!isMounted || isSyncing || typeof document === "undefined" || document.hidden) return;
      isSyncing = true;

      try {
        if (selectedCustomer) {
          const res = await getBotCustomerMessagesAction({
            botId: bot.id,
            customerId: selectedCustomer.id,
          });

          if (isMounted && res.success && res.data) {
            setMessages((prev) => {
              const prevSig = prev.map((m) => `${m.id}:${m.status}`).join("|");
              const nextSig = res.data!.messages.map((m) => `${m.id}:${m.status}`).join("|");
              if (prevSig !== nextSig) {
                return res.data!.messages;
              }
              return prev;
            });
            setIsManualActive(!!res.data.isManualMode);
            setManualExpiresAt(res.data.manualModeExpiresAt || null);
          }
        }

        const custRes = await getBotCustomersAction(bot.id);
        if (isMounted && custRes.success && custRes.data) {
          setCustomersList((prev) => {
            const prevSig = prev.map((c) => `${c.id}:${c.lastMessageText}:${c.lastMessageAt}`).join("|");
            const nextSig = custRes.data!.customers.map((c) => `${c.id}:${c.lastMessageText}:${c.lastMessageAt}`).join("|");
            if (prevSig !== nextSig) {
              return custRes.data!.customers;
            }
            return prev;
          });
        }
      } catch {
        // Erro de rede ignorado silenciosamente durante background polling
      } finally {
        isSyncing = false;
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        syncConversations();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(syncConversations, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [bot.id, selectedCustomer?.id]);

  // Alternar Modo Manual
  const handleToggleManualMode = async () => {
    if (!selectedCustomer || togglingManual) return;
    setTogglingManual(true);
    const nextState = !isManualActive;

    try {
      const res = await toggleBotCustomerManualModeAction({
        botId: bot.id,
        customerId: selectedCustomer.id,
        enabled: nextState,
        durationMinutes: 60,
      });

      if (res.success && res.data) {
        setIsManualActive(res.data.isManualMode);
        setManualExpiresAt(res.data.expiresAt || null);

        const sysMsg: MessageItem = {
          id: res.data.systemMessage.id,
          direction: "outbound",
          messageType: "system",
          text: res.data.systemMessage.text,
          status: "delivered",
          createdAt: res.data.systemMessage.createdAt,
        };
        setMessages((prev) => [...prev, sysMsg]);

        if (showNotification) {
          showNotification(
            "success",
            nextState ? "Modo manual ativado por 1 hora para esta conversa." : "Modo manual desativado. O bot retomou o atendimento automático."
          );
        }
      } else {
        if (showNotification) {
          showNotification("error", res.error || "Não foi possível alternar o modo manual.");
        }
      }
    } catch {
      if (showNotification) {
        showNotification("error", "Erro ao comunicar alteração do modo manual.");
      }
    } finally {
      setTogglingManual(false);
    }
  };

  // Inserção de Emoji no Input
  const handleInsertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    textInputRef.current?.focus();
  };

  // Upload e Seleção de Anexo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      if (showNotification) {
        showNotification("error", "O arquivo selecionado excede o limite máximo permitido de 20 MB.");
      }
      return;
    }

    let detectedType: "photo" | "document" | "voice" = "document";
    if (file.type.startsWith("image/")) detectedType = "photo";
    else if (file.type.startsWith("audio/")) detectedType = "voice";

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64 = resultStr.includes(",") ? resultStr.split(",")[1] : resultStr;
      const previewUrl = detectedType === "photo" ? resultStr : undefined;

      setSelectedFile({
        file,
        previewUrl,
        base64,
        type: detectedType,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Iniciar Gravação de Áudio com Negociação de Formatos
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let selectedMime = "";
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ];
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
        for (const candidate of candidates) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            selectedMime = candidate;
            break;
          }
        }
      }

      const mediaRecorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setAudioRecordingState("recording");
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("[ConversasCenter] Erro ao acessar microfone:", err);
      if (showNotification) {
        showNotification("error", "Permissão para acessar o microfone negada ou microfone indisponível.");
      }
    }
  };

  // Parar gravação e entrar em modo de Pré-visualização do Áudio
  const handleStopRecordingToPreview = () => {
    if (!mediaRecorderRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const actualMime = mediaRecorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: actualMime });
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());

      const url = URL.createObjectURL(blob);
      setRecordedAudioBlob(blob);
      setRecordedAudioUrl(url);
      setAudioRecordingState("preview");
    };

    mediaRecorderRef.current.stop();
  };

  // Cancelar e descartar áudio gravado
  const handleDiscardRecordedAudio = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPlayingPreview(false);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setAudioRecordingState("idle");
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  // Alternar reprodução do áudio de pré-visualização
  const handleTogglePlayPreview = () => {
    if (!previewAudioRef.current && recordedAudioUrl) {
      previewAudioRef.current = new Audio(recordedAudioUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (!previewAudioRef.current) return;

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play().catch(() => {});
      setIsPlayingPreview(true);
    }
  };

  // Confirmar e Enviar Áudio Gravado
  const handleSendRecordedAudio = async () => {
    if (!recordedAudioBlob || !selectedCustomer) return;

    setAudioRecordingState("sending");

    const reader = new FileReader();
    reader.onload = async () => {
      const resultStr = reader.result as string;
      const base64 = resultStr.includes(",") ? resultStr.split(",")[1] : resultStr;
      const mime = recordedAudioBlob.type || "audio/webm";

      let ext = "webm";
      if (mime.includes("ogg")) ext = "ogg";
      else if (mime.includes("mp4")) ext = "m4a";

      const sendSuccess = await dispatchMessage({
        mediaType: "voice",
        mediaBase64: base64,
        mediaName: `voice_${Date.now()}.${ext}`,
        caption: "",
      });

      if (sendSuccess) {
        handleDiscardRecordedAudio();
      } else {
        // Se falhar, preserva em preview para retry
        setAudioRecordingState("preview");
      }
    };
    reader.readAsDataURL(recordedAudioBlob);
  };

  // Despacho unificado com idempotência estrita
  const dispatchMessage = async (options?: {
    mediaType?: "text" | "photo" | "voice" | "document";
    mediaBase64?: string;
    mediaName?: string;
    caption?: string;
  }): Promise<boolean> => {
    if (!selectedCustomer || sendingMessage) return false;

    const mediaType = options?.mediaType || (selectedFile ? selectedFile.type : "text");
    const mediaBase64 = options?.mediaBase64 || selectedFile?.base64;
    const mediaName = options?.mediaName || selectedFile?.file.name;
    const textToSend = options?.caption !== undefined ? options.caption : messageText.trim();

    if (!textToSend && !mediaBase64) return false;

    if (!activeClientMessageIdRef.current) {
      activeClientMessageIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
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
        botId: bot.id,
        customerId: selectedCustomer.id,
        text: textToSend,
        clientMessageId,
        mediaType,
        mediaBase64,
        mediaName,
      });

      if (res.success && res.data) {
        const newMsg: MessageItem = {
          id: res.data.id,
          direction: "outbound",
          messageType: res.data.messageType || mediaType,
          text: res.data.text,
          status: "sent",
          createdAt: res.data.createdAt,
        };
        setMessages((prev) => [...prev, newMsg]);
        setMessageText("");
        setSelectedFile(null);
        setShowEmojiPicker(false);
        activeClientMessageIdRef.current = null;

        if (showNotification) {
          showNotification("success", "Mensagem enviada com sucesso ao cliente no Telegram!");
        }

        // Atualizar lista de contatos em memória
        setCustomersList((prev) =>
          prev.map((c) =>
            c.id === selectedCustomer.id
              ? {
                  ...c,
                  messagesCount: (c.messagesCount || 0) + 1,
                  lastMessageText:
                    textToSend ||
                    (mediaType === "voice"
                      ? "Mensagem de voz"
                      : mediaType === "photo"
                      ? "Foto"
                      : "Arquivo anexado"),
                  lastMessageAt: new Date().toISOString(),
                  lastMessageDirection: "outbound",
                }
              : c
          )
        );
        return true;
      } else {
        setSendError(res.error || "Falha ao enviar mensagem pelo Telegram.");
        if (showNotification) showNotification("error", res.error || "Falha no envio.");
        return false;
      }
    } catch {
      const err = "Erro de conexão ao enviar mensagem.";
      setSendError(err);
      if (showNotification) showNotification("error", err);
      return false;
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    dispatchMessage();
  };

  // Filtragem de contatos
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customersList;
    const q = searchQuery.toLowerCase();
    return customersList.filter((cust) => {
      const fullName = `${cust.firstName || ""} ${cust.lastName || ""}`.toLowerCase();
      const username = (cust.username || "").toLowerCase();
      const tgId = String(cust.telegramUserId);
      return fullName.includes(q) || username.includes(q) || tgId.includes(q);
    });
  }, [customersList, searchQuery]);

  // Formatação de timer de gravação (MM:SS)
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Formatação amigável de horário ou dia da semana estilo Telegram
  const formatTimeOrDate = (isoDate?: string | null) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // Agrupamento das mensagens por data cronológica
  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Conteúdo principal (Redesign V2: painéis flutuantes sobre o fundo de desenhos)
  const customerDisplayName = (cust: CustomerItem) =>
    [cust.firstName, cust.lastName].filter(Boolean).join(" ") || cust.username || `ID ${cust.telegramUserId}`;

  const handleCloseChat = () => {
    setMobileChatOpen(false);
    setSelectedCustomer(null);
    setShowEmojiPicker(false);
  };

  const content = (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0d12] text-white overflow-hidden relative select-none">
      {/* 1. Topo: título + fechar */}
      <div className="h-14 px-4 sm:px-5 bg-[#101218] border-b border-white/[0.06] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <SolarSellerConversasIcon size={20} className="text-zinc-300" />
          <h2 className="text-[15px] font-bold text-white tracking-tight">Conversas</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar conversas"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Corpo: fundo de desenhos com painéis flutuantes */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            // Base escura com leve brilho colorido nos cantos (estilo papel de parede do Telegram)
            backgroundColor: "#0b0d12",
            backgroundImage:
              "radial-gradient(120% 90% at 0% 0%, rgba(76,29,149,0.35) 0%, transparent 55%), radial-gradient(110% 90% at 100% 100%, rgba(30,64,175,0.30) 0%, transparent 55%)",
          }}
        />
        {/* Desenhos próprios da WebGran recortando um degradê roxo → azul → rosa */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 35%, #a855f7 65%, #ec4899 100%)",
            opacity: 0.32,
            WebkitMaskImage: "url('/images/chat-pattern-webgran.svg')",
            maskImage: "url('/images/chat-pattern-webgran.svg')",
            WebkitMaskRepeat: "repeat",
            maskRepeat: "repeat",
            WebkitMaskSize: "300px 300px",
            maskSize: "300px 300px",
          }}
        />

        <div className="relative z-10 flex-1 flex min-h-0 gap-4 p-0 sm:p-3 md:p-4">
          {/* Lista de conversas (cartão flutuante) */}
          <aside
            aria-label="Lista de conversas"
            className={`w-full md:w-[300px] lg:w-[320px] shrink-0 flex-col min-h-0 bg-[#15171e]/95 sm:border border-white/[0.06] sm:rounded-[22px] overflow-hidden ${
              mobileChatOpen ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden">
                <BotAvatar botId={bot.id} displayName={bot.displayName} photoUrl={bot.photoUrl} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{bot.displayName}</p>
                <p className="text-xs text-zinc-400 truncate">@{bot.username}</p>
              </div>
            </div>

            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar"
                  aria-label="Buscar conversas"
                  className="w-full bg-[#1d2029] border border-transparent rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF]/60 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
              {filteredCustomers.length === 0 ? (
                <div className="h-full min-h-[200px] flex items-center justify-center text-center px-6">
                  <p className="text-[13px] text-zinc-400">
                    {searchQuery.trim() ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
                  </p>
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomer?.id === cust.id;
                  const name = customerDisplayName(cust);
                  return (
                    <button
                      type="button"
                      key={cust.id}
                      data-customer-card={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      aria-current={isSelected ? "true" : undefined}
                      className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-[#3984FF] text-white" : "hover:bg-white/[0.05] text-zinc-200"
                      }`}
                    >
                      <span
                        className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarGradient(name)} flex items-center justify-center font-bold text-[15px] text-white shrink-0`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold truncate">{name}</span>
                          {cust.lastMessageAt && (
                            <span className={`flex items-center gap-1 shrink-0 text-[11px] ${isSelected ? "text-white/85" : "text-zinc-500"}`}>
                              {cust.lastMessageDirection === "outbound" && <CheckCheck className="w-3.5 h-3.5" />}
                              {formatTimeOrDate(cust.lastMessageAt)}
                            </span>
                          )}
                        </span>
                        <span className={`block text-[12px] truncate mt-0.5 ${isSelected ? "text-white/85" : "text-zinc-400"}`}>
                          {cust.lastMessageText
                            ? `${cust.lastMessageDirection === "outbound" ? "Você: " : ""}${cust.lastMessageText}`
                            : "Sem mensagens recentes"}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Área do chat */}
          <section
            aria-label="Conversa"
            className={`flex-1 min-w-0 flex-col min-h-0 ${!mobileChatOpen ? "hidden md:flex" : "flex"}`}
          >
            {selectedCustomer ? (
              <div className="flex-1 flex flex-col min-h-0 w-full max-w-[780px] mx-auto">
                {/* Cabeçalho flutuante do chat */}
                <div className="mx-2 mt-2 sm:mx-0 sm:mt-0 px-3 py-2.5 bg-[#15171e]/95 border border-white/[0.06] rounded-2xl flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={handleCloseChat}
                      className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] shrink-0 cursor-pointer"
                      title="Voltar para conversas"
                      aria-label="Voltar para conversas"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(
                        customerDisplayName(selectedCustomer)
                      )} flex items-center justify-center font-bold text-sm text-white shrink-0`}
                    >
                      {customerDisplayName(selectedCustomer).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-bold text-white truncate">{customerDisplayName(selectedCustomer)}</h3>
                      {isManualActive && manualExpiresAt ? (
                        <p className="text-[11px] font-medium text-[#60a5fa] flex items-center gap-1 truncate">
                          <Clock className="w-3 h-3 shrink-0" />
                          modo manual até{" "}
                          {new Date(manualExpiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-400 truncate">
                          {selectedCustomer.username ? `@${selectedCustomer.username}` : `ID ${selectedCustomer.telegramUserId}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRefreshMessages}
                      disabled={loadingMessages}
                      className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                      title="Atualizar mensagens"
                      aria-label="Atualizar mensagens"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? "animate-spin text-[#3984FF]" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleManualMode}
                      disabled={togglingManual}
                      aria-pressed={isManualActive}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        isManualActive
                          ? "bg-[#3984FF] text-white"
                          : "bg-[#3984FF]/15 text-[#93c5fd] hover:bg-[#3984FF]/25"
                      }`}
                      title={isManualActive ? "Devolver o atendimento ao bot" : "Assumir o atendimento por 1 hora"}
                    >
                      {togglingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hand className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isManualActive ? "Modo manual ativo" : "Modo manual"}</span>
                    </button>
                  </div>
                </div>

                {/* Histórico */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-2 py-4 space-y-3">
                  <div className="max-w-[260px] mx-auto bg-[#15171e]/90 border border-white/[0.06] rounded-2xl px-4 py-3 text-center space-y-1">
                    <Clock className="w-5 h-5 text-zinc-300 mx-auto" />
                    <p className="text-[12px] font-semibold text-white">Mensagens em tempo real</p>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      O que você envia aqui chega no Telegram do cliente como se fosse o bot.
                    </p>
                  </div>

                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-10 text-zinc-400 text-xs gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#3984FF]" />
                      <span>Carregando conversa…</span>
                    </div>
                  ) : messageGroups.length === 0 ? (
                    <p className="text-center text-[12px] text-zinc-400 py-8">Nenhuma mensagem nesta conversa ainda.</p>
                  ) : (
                    messageGroups.map((group, groupIdx) => (
                      <div key={groupIdx} className="space-y-2">
                        <div className="flex justify-center sticky top-0 z-10 py-1">
                          <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#15171e]/95 border border-white/[0.06] text-zinc-200">
                            {group.dateLabel}
                          </span>
                        </div>

                        {group.messages.map((msg) => {
                          const isInbound = msg.direction === "inbound";
                          const isSystem = msg.messageType === "system";
                          const isVoice = msg.messageType === "voice";
                          const isPhoto = msg.messageType === "photo";
                          const isDoc = msg.messageType === "document";
                          const isSent = msg.status === "sent" || msg.status === "delivered";
                          const isFailed = msg.status === "failed";
                          const isSending = msg.status === "sending";
                          const timeStr = new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          if (isSystem) {
                            return (
                              <div key={msg.id} className="flex justify-center">
                                <span className="px-3 py-1 rounded-full bg-[#15171e]/95 border border-white/[0.06] text-zinc-300 text-[11px] font-medium">
                                  {msg.text}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div key={msg.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                              <div
                                className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-3 py-2 text-[13px] ${
                                  isInbound
                                    ? "bg-[#1d2029] text-zinc-100 rounded-bl-md"
                                    : "bg-[#3984FF] text-white rounded-br-md"
                                }`}
                              >
                                {isPhoto && msg.mediaUrl && (
                                  <div className="rounded-xl overflow-hidden mb-1.5 max-h-60 bg-black/30">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={msg.mediaUrl} alt="Foto" className="w-full h-auto object-cover" />
                                  </div>
                                )}

                                {isVoice && (
                                  <div className="flex items-center gap-3 py-1 pr-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (activeAudioPlayingId === msg.id) {
                                          timelineAudioRef.current?.pause();
                                          setActiveAudioPlayingId(null);
                                        } else if (msg.mediaUrl) {
                                          if (timelineAudioRef.current) timelineAudioRef.current.pause();
                                          const aud = new Audio(msg.mediaUrl);
                                          aud.onended = () => setActiveAudioPlayingId(null);
                                          aud.play().catch(() => {});
                                          timelineAudioRef.current = aud;
                                          setActiveAudioPlayingId(msg.id);
                                        }
                                      }}
                                      aria-label={activeAudioPlayingId === msg.id ? "Pausar áudio" : "Ouvir áudio"}
                                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
                                        isInbound ? "bg-[#3984FF] text-white" : "bg-white text-[#3984FF]"
                                      }`}
                                    >
                                      {activeAudioPlayingId === msg.id ? (
                                        <Pause className="w-4 h-4 fill-current" />
                                      ) : (
                                        <Play className="w-4 h-4 fill-current ml-0.5" />
                                      )}
                                    </button>
                                    <div className="flex items-center gap-[3px] h-4 min-w-[110px]">
                                      {[40, 70, 30, 90, 60, 80, 45, 95, 30, 75, 55, 85, 35, 65].map((h, i) => (
                                        <span
                                          key={i}
                                          className={`w-[3px] rounded-full ${isInbound ? "bg-zinc-500" : "bg-white/70"}`}
                                          style={{ height: `${h}%` }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {isDoc && (
                                  <div className="flex items-center gap-2 py-1">
                                    <FileText className="w-4 h-4 shrink-0" />
                                    <span className="font-semibold text-[12px] truncate">Documento anexado</span>
                                  </div>
                                )}

                                {msg.text && (
                                  <p className="whitespace-pre-wrap leading-relaxed break-words select-text">{msg.text}</p>
                                )}

                                <div
                                  className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] ${
                                    isInbound ? "text-zinc-500" : "text-white/80"
                                  }`}
                                >
                                  <span>{timeStr}</span>
                                  {!isInbound && isSent && <CheckCheck className="w-3.5 h-3.5" aria-label="Enviada" />}
                                  {!isInbound && isSending && <Loader2 className="w-3 h-3 animate-spin" aria-label="Enviando" />}
                                  {!isInbound && isFailed && <AlertCircle className="w-3 h-3 text-rose-200" aria-label="Falhou" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {sendError && (
                  <div className="mx-2 sm:mx-0 mb-2 p-3 rounded-xl bg-rose-950/90 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {sendError}
                    </span>
                    <button type="button" onClick={() => setSendError(null)} aria-label="Fechar aviso" className="text-rose-300 hover:text-white cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {selectedFile && (
                  <div className="mx-2 sm:mx-0 mb-2 p-2.5 bg-[#15171e]/95 border border-white/[0.06] rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {selectedFile.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedFile.previewUrl} alt="Prévia do anexo" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <span className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#3984FF]" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{selectedFile.file.name}</p>
                        <p className="text-[11px] text-zinc-400">{(selectedFile.file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      aria-label="Remover anexo"
                      className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {showEmojiPicker && (
                  <div className="mx-2 sm:mx-0 mb-2 bg-[#15171e] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col h-56">
                    <div className="flex items-center border-b border-white/[0.06] px-2 py-1 gap-1 overflow-x-auto">
                      {EMOJI_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveEmojiCategory(cat.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-sm cursor-pointer ${
                            activeEmojiCategory === cat.id ? "bg-[#3984FF]/20 text-white" : "hover:bg-white/[0.05] text-zinc-400"
                          }`}
                          title={cat.name}
                          aria-label={cat.name}
                        >
                          {cat.icon}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        className="ml-auto p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white cursor-pointer"
                        aria-label="Fechar emojis"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-8 sm:grid-cols-10 gap-1 text-xl">
                      {EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory)?.emojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] flex items-center justify-center cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Campo de mensagem flutuante */}
                <div className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-0 sm:pb-0 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg,image/webp,audio/*,application/pdf"
                    className="hidden"
                  />

                  {audioRecordingState === "recording" ? (
                    <div className="flex items-center justify-between gap-3 bg-[#15171e]/95 border border-rose-500/30 rounded-2xl px-3 py-2">
                      <button
                        type="button"
                        onClick={handleDiscardRecordedAudio}
                        className="p-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                        aria-label="Descartar gravação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <span className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-mono font-bold text-white">{formatTimer(recordingSeconds)}</span>
                        <span className="text-[11px] text-zinc-400 hidden sm:inline">Gravando áudio…</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleStopRecordingToPreview}
                        className="w-10 h-10 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white flex items-center justify-center cursor-pointer"
                        aria-label="Parar e ouvir"
                      >
                        <Pause className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  ) : audioRecordingState === "preview" ? (
                    <div className="flex items-center justify-between gap-3 bg-[#15171e]/95 border border-white/[0.06] rounded-2xl px-3 py-2">
                      <button
                        type="button"
                        onClick={handleDiscardRecordedAudio}
                        className="p-2 rounded-full hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 cursor-pointer"
                        aria-label="Excluir áudio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={handleTogglePlayPreview}
                          className="w-8 h-8 rounded-full bg-[#3984FF] text-white flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label={isPlayingPreview ? "Pausar" : "Ouvir"}
                        >
                          {isPlayingPreview ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">Áudio pronto</p>
                          <p className="text-[11px] text-zinc-400">{formatTimer(recordingSeconds)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendRecordedAudio}
                        disabled={sendingMessage}
                        className="w-10 h-10 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white flex items-center justify-center cursor-pointer"
                        aria-label="Enviar áudio"
                      >
                        {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : audioRecordingState === "sending" ? (
                    <div className="flex items-center justify-center gap-2 bg-[#15171e]/95 border border-white/[0.06] rounded-2xl px-4 py-3 text-xs text-[#93c5fd]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando áudio…</span>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSendMessage}
                      className="flex items-center gap-1 bg-[#15171e]/95 border border-white/[0.06] rounded-2xl pl-2 pr-1.5 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendingMessage}
                        className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
                        title="Anexar imagem ou documento"
                        aria-label="Anexar arquivo"
                      >
                        <Paperclip className="w-[18px] h-[18px]" />
                      </button>
                      <input
                        ref={textInputRef}
                        type="text"
                        value={messageText}
                        onChange={(e) => {
                          setMessageText(e.target.value);
                          activeClientMessageIdRef.current = null;
                        }}
                        disabled={sendingMessage}
                        placeholder="Mensagem"
                        aria-label="Mensagem"
                        className="flex-1 min-w-0 bg-transparent border-0 px-1.5 py-2 text-[14px] text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
                        aria-label="Inserir emoji"
                      >
                        <Smile className="w-[18px] h-[18px]" />
                      </button>
                      {messageText.trim() || selectedFile ? (
                        <button
                          type="submit"
                          disabled={sendingMessage}
                          className="w-10 h-10 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label="Enviar mensagem"
                        >
                          {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="w-10 h-10 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label="Gravar áudio"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      )}
                    </form>
                  )}
                </div>
              </div>
            ) : (
              /* Nenhuma conversa aberta */
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-[300px] bg-[#15171e]/95 border border-white/[0.06] rounded-3xl p-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#3984FF]/15 flex items-center justify-center mx-auto text-[#60a5fa]">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-[15px] font-bold text-white">As conversas do seu bot</h3>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">
                      Aqui aparecem as pessoas que falaram com o seu bot. Abra uma conversa para ler e responder como o bot.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-left bg-white/[0.04] rounded-2xl p-3">
                    <span className="w-9 h-9 rounded-full bg-[#3984FF] flex items-center justify-center shrink-0">
                      <Hand className="w-4 h-4 text-white" />
                    </span>
                    <span className="text-[11px] text-zinc-300 leading-snug">
                      <strong className="block text-white text-[12px]">Modo manual</strong>
                      Assuma a conversa por 1 hora e o bot para de responder sozinho.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  // Se renderizado como Modal Imersivo:
  if (isModal) {
    const modalElement = (
      <div className="fixed inset-0 z-[99999] bg-black/85 flex flex-col p-0 sm:p-3 md:p-4 animate-in fade-in">
        <div className="w-full h-full max-w-[1600px] mx-auto sm:rounded-2xl sm:border border-white/[0.08] overflow-hidden flex flex-col">
          {content}
        </div>
      </div>
    );

    if (typeof document !== "undefined") {
      return createPortal(modalElement, document.body);
    }
    return modalElement;
  }

  // Se renderizado diretamente como Conteúdo da Aba:
  return (
    <div className="w-full rounded-2xl border border-white/[0.08] overflow-hidden min-h-[680px] h-[720px] flex flex-col">
      {content}
    </div>
  );
}
