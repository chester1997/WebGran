"use client";

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

export default function ConversasCenter({
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

  // Conteúdo principal
  const content = (
    <div className="flex flex-col h-full min-h-0 bg-[#0e1117] text-white overflow-hidden relative select-none">
      {/* ========================================================= */}
      {/* 1. TOPO DA CENTRAL DE CONVERSAS                           */}
      {/* ========================================================= */}
      <div className="h-14 px-4 sm:px-6 bg-[#131720] border-b border-white/[0.08] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] bg-[#3984FF]/15 border border-[#3984FF]/30 flex items-center justify-center text-[#3984FF]">
            <SolarSellerConversasIcon size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              Conversas
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25">
                Central de Atendimento
              </span>
            </h2>
          </div>
        </div>

        {/* Botão Fechar Modal (se estiver em modal) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[10px] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. CORPO DUAS COLUNAS: LISTA À ESQUERDA & CHAT À DIREITA */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* ======================================================= */}
        {/* COLUNA ESQUERDA: LISTA DE CONVERSAS (Estilo Telegram)   */}
        {/* ======================================================= */}
        <div
          className={`w-full md:w-[320px] lg:w-[360px] xl:w-[380px] bg-[#12151c] border-r border-white/[0.08] flex flex-col shrink-0 transition-all z-10 ${
            mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Card do Bot Responsável */}
          <div className="p-3.5 border-b border-white/[0.06] bg-[#151922] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden border border-white/10 relative">
                <BotAvatar
                  botId={bot.id}
                  displayName={bot.displayName}
                  photoUrl={bot.photoUrl}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate tracking-tight">{bot.displayName}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Bot Online / Rodando" />
                </div>
                <p className="text-[11px] text-zinc-400 font-mono truncate">@{bot.username}</p>
              </div>
            </div>
          </div>

          {/* Campo de Busca de Contatos Estilo Telegram */}
          <div className="p-3 border-b border-white/[0.06] bg-[#12151c]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, @user ou ID..."
                className="w-full bg-[#181d26] border border-white/10 rounded-full pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF] transition-colors"
              />
            </div>
          </div>

          {/* Lista Rolável de Contatos */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03] p-1.5 space-y-0.5">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto stroke-1" />
                <p className="font-semibold text-zinc-400">Nenhuma conversa encontrada</p>
                <p className="text-[11px] text-zinc-500">
                  Quando clientes interagirem com este bot no Telegram, aparecerão listados aqui.
                </p>
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                const name =
                  [cust.firstName, cust.lastName].filter(Boolean).join(" ") ||
                  cust.username ||
                  `ID ${cust.telegramUserId}`;
                const initial = name.charAt(0).toUpperCase();
                const avatarBg = getAvatarGradient(name);

                return (
                  <div
                    key={cust.id}
                    data-customer-card={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className={`p-2.5 sm:p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#3984FF]/15 text-white border-l-2 border-[#3984FF] shadow-sm"
                        : "hover:bg-white/[0.04] text-zinc-300"
                    }`}
                  >
                    {/* Avatar do Contato em Destaque */}
                    <div
                      className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarBg} border border-white/15 flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm`}
                    >
                      {initial}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate tracking-tight text-zinc-100">{name}</span>
                        {cust.lastMessageAt && (
                          <div className="flex items-center gap-1 shrink-0">
                            {cust.lastMessageDirection === "outbound" && (
                              <Check className="w-3 h-3 text-zinc-400" />
                            )}
                            <span className="text-[11px] text-zinc-400 font-medium">
                              {formatTimeOrDate(cust.lastMessageAt)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
                        {cust.lastMessageText ? (
                          <>
                            {cust.lastMessageDirection === "outbound" && (
                              <span className="text-zinc-500 text-[10px] shrink-0 font-medium">Você:</span>
                            )}
                            <span className="truncate">{cust.lastMessageText}</span>
                          </>
                        ) : (
                          <span className="text-zinc-500 italic text-[10px]">Sem mensagens recentes</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================= */}
        {/* COLUNA DIREITA: TELA INDIVIDUAL DE CONVERSA             */}
        {/* ======================================================= */}
        <div
          className={`flex-1 flex flex-col h-full min-h-0 bg-[#0c1017] relative overflow-hidden ${
            !mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Fundo Telegram com Ilustrações Doodles Originais WebGran */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: "#0c1017",
              backgroundImage: `url('/images/chat-pattern.svg')`,
              backgroundRepeat: "repeat",
              backgroundSize: "380px 380px",
              opacity: 0.95,
            }}
          />

          {selectedCustomer ? (
            <div className="flex-1 flex flex-col h-full min-h-0 relative z-10 overflow-hidden">
              {/* =================================================== */}
              {/* HEADER DO CHAT SELECIONADO                          */}
              {/* =================================================== */}
              <div className="h-16 px-4 sm:px-6 bg-[#131720]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Botão Voltar para Lista no Mobile */}
                  <button
                    type="button"
                    onClick={() => setMobileChatOpen(false)}
                    className="md:hidden p-2 rounded-[10px] bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10 shrink-0"
                    title="Voltar para conversas"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* Avatar do Contato */}
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(
                      selectedCustomer.firstName || selectedCustomer.username || "Cliente"
                    )} border border-white/20 flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm`}
                  >
                    {(selectedCustomer.firstName || selectedCustomer.username || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate tracking-tight">
                      {[selectedCustomer.firstName, selectedCustomer.lastName].filter(Boolean).join(" ") ||
                        selectedCustomer.username ||
                        "Cliente"}
                    </h3>

                    {/* Subtítulo: username ou status do modo manual */}
                    <div className="flex items-center gap-2">
                      {isManualActive && manualExpiresAt ? (
                        <span className="text-[11px] font-medium text-[#3984FF] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          modo manual ativo até {new Date(manualExpiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 font-mono truncate">
                          {selectedCustomer.username ? `@${selectedCustomer.username}` : `Telegram ID: ${selectedCustomer.telegramUserId}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações do Header: Atualizar e Modo Manual */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshMessages}
                    disabled={loadingMessages}
                    className="p-2 rounded-[10px] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    title="Atualizar mensagens"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? "animate-spin text-[#3984FF]" : ""}`} />
                  </button>

                  {/* Botão Modo Manual com Identificação Clara */}
                  <button
                    type="button"
                    onClick={handleToggleManualMode}
                    disabled={togglingManual}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-all cursor-pointer ${
                      isManualActive
                        ? "bg-[#3984FF] text-white border-[#3984FF] shadow-lg shadow-[#3984FF]/25"
                        : "bg-white/[0.04] text-zinc-300 hover:text-white border-white/10 hover:border-white/20"
                    }`}
                    title={isManualActive ? "Encerrar atendimento manual" : "Assumir atendimento manual por 1 hora"}
                  >
                    {togglingManual ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Hand className="w-3.5 h-3.5" />
                    )}
                    <span>{isManualActive ? "Modo manual ativo" : "Modo manual"}</span>
                  </button>
                </div>
              </div>

              {/* =================================================== */}
              {/* HISTÓRICO DE MENSAGENS COM SCROLL                   */}
              {/* =================================================== */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Banner Central de Mensagens Temporárias Inspirado no Telegram */}
                <div className="max-w-md mx-auto bg-[#171c26]/90 border border-white/10 rounded-2xl p-4 text-center shadow-xl space-y-1.5 backdrop-blur-md">
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-zinc-300 mb-1">
                    <Clock className="w-4 h-4 text-[#3984FF]" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Mensagens sincronizadas em tempo real</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    As mensagens desta conversa são transmitidas diretamente entre o WebGran e o Telegram do cliente.
                  </p>
                </div>

                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400 text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#3984FF]" />
                    <span>Carregando histórico do Telegram...</span>
                  </div>
                ) : messageGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 text-xs space-y-2">
                    <MessageSquare className="w-8 h-8 text-zinc-600 stroke-1" />
                    <p className="font-semibold text-zinc-400">Nenhuma mensagem registrada ainda</p>
                    <p className="text-[11px] max-w-sm text-zinc-500">
                      Mensagens enviadas pelo cliente no Telegram e suas respostas manuais aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  messageGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-3">
                      {/* Separador de Data Cronológica (Hoje, Ontem, etc.) */}
                      <div className="flex items-center justify-center my-3 sticky top-1 z-10">
                        <span className="px-3.5 py-1 rounded-full text-[11px] font-semibold bg-black/50 border border-white/10 text-zinc-300 shadow-sm backdrop-blur-sm">
                          {group.dateLabel}
                        </span>
                      </div>

                      {/* Lista de Mensagens do Grupo */}
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

                        // Mensagem de Evento do Sistema
                        if (isSystem) {
                          return (
                            <div key={msg.id} className="flex justify-center my-2">
                              <div className="px-3.5 py-1.5 rounded-full bg-[#181d27]/90 border border-white/10 text-zinc-300 text-[11px] font-medium shadow-sm flex items-center gap-1.5 backdrop-blur-sm">
                                <Hand className="w-3 h-3 text-[#3984FF]" />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          );
                        }

                        // Balões de Mensagens Estilo Telegram
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-md space-y-1 relative ${
                                isInbound
                                  ? "bg-[#1d232e] text-zinc-100 border border-white/5 rounded-bl-xs"
                                  : "bg-[#3984FF] text-white rounded-br-xs"
                              }`}
                            >
                              {/* Conteúdo de Foto */}
                              {isPhoto && msg.mediaUrl && (
                                <div className="rounded-xl overflow-hidden mb-2 border border-white/10 max-h-60 bg-black/40">
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Foto"
                                    className="w-full h-auto object-cover"
                                  />
                                </div>
                              )}

                              {/* Conteúdo de Áudio / Nota de Voz */}
                              {isVoice && (
                                <div className="flex items-center gap-3 py-1.5 pr-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (activeAudioPlayingId === msg.id) {
                                        timelineAudioRef.current?.pause();
                                        setActiveAudioPlayingId(null);
                                      } else if (msg.mediaUrl) {
                                        if (timelineAudioRef.current) {
                                          timelineAudioRef.current.pause();
                                        }
                                        const aud = new Audio(msg.mediaUrl);
                                        aud.onended = () => setActiveAudioPlayingId(null);
                                        aud.play().catch(() => {});
                                        timelineAudioRef.current = aud;
                                        setActiveAudioPlayingId(msg.id);
                                      }
                                    }}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-sm ${
                                      isInbound
                                        ? "bg-[#3984FF] text-white"
                                        : "bg-white text-[#3984FF]"
                                    }`}
                                  >
                                    {activeAudioPlayingId === msg.id ? (
                                      <Pause className="w-4 h-4 fill-current" />
                                    ) : (
                                      <Play className="w-4 h-4 fill-current ml-0.5" />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-[120px]">
                                    <div className="flex items-center gap-1 h-3">
                                      {/* Onda decorativa de áudio */}
                                      {[40, 70, 30, 90, 60, 80, 45, 95, 30, 75, 55, 85, 35, 65].map((h, i) => (
                                        <span
                                          key={i}
                                          className={`w-1 rounded-full ${
                                            isInbound ? "bg-zinc-500" : "bg-blue-100/70"
                                          }`}
                                          style={{ height: `${h}%` }}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-[10px] opacity-80 mt-1 inline-block">
                                      Mensagem de voz
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Conteúdo de Documento */}
                              {isDoc && (
                                <div className="flex items-center gap-2.5 py-1">
                                  <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="font-semibold text-[11px] truncate">Documento anexado</span>
                                </div>
                              )}

                              {/* Texto da Mensagem */}
                              {msg.text && (
                                <p className="whitespace-pre-wrap leading-relaxed break-words text-xs">
                                  {msg.text}
                                </p>
                              )}

                              {/* Rodapé do Balão com Horário e Status */}
                              <div
                                className={`flex items-center gap-1.5 pt-0.5 text-[10px] ${
                                  isInbound ? "justify-start text-zinc-400" : "justify-end text-blue-100/90"
                                }`}
                              >
                                <span>{timeStr}</span>
                                {!isInbound && (
                                  <span className="inline-flex items-center">
                                    {isSent && (
                                      <span title="Enviado ao Telegram">
                                        <CheckCheck className="w-3.5 h-3.5 text-white inline" />
                                      </span>
                                    )}
                                    {isSending && (
                                      <span title="Enviando...">
                                        <Loader2 className="w-3 h-3 animate-spin inline text-white" />
                                      </span>
                                    )}
                                    {isFailed && (
                                      <span title="Falha no envio">
                                        <AlertCircle className="w-3 h-3 text-rose-300 inline" />
                                      </span>
                                    )}
                                  </span>
                                )}
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

              {/* Banner de Erro se houver falha de envio */}
              {sendError && (
                <div className="mx-4 mb-2 p-3 rounded-xl bg-rose-950/85 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSendError(null)}
                    className="text-rose-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Pré-visualização de Anexo antes do Envio */}
              {selectedFile && (
                <div className="mx-4 mb-2 p-2.5 bg-[#171c26] border border-white/10 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedFile.previewUrl ? (
                      <img
                        src={selectedFile.previewUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-300">
                        <FileText className="w-5 h-5 text-[#3984FF]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{selectedFile.file.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {(selectedFile.file.size / 1024).toFixed(1)} KB • Pronto para envio
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white cursor-pointer"
                    title="Remover anexo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* =================================================== */}
              {/* GAVETA DE EMOJIS EXPANSÍVEL                         */}
              {/* =================================================== */}
              {showEmojiPicker && (
                <div className="mx-4 mb-2 bg-[#171c26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-56 animate-in fade-in slide-in-from-bottom-3 z-30">
                  <div className="flex items-center border-b border-white/[0.06] bg-[#131720] px-2 py-1 gap-1 overflow-x-auto">
                    {EMOJI_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveEmojiCategory(cat.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                          activeEmojiCategory === cat.id
                            ? "bg-[#3984FF]/20 border border-[#3984FF]/40 text-white"
                            : "hover:bg-white/[0.04] text-zinc-400"
                        }`}
                        title={cat.name}
                      >
                        {cat.icon}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="ml-auto p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white cursor-pointer"
                      title="Fechar emojis"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 grid grid-cols-8 sm:grid-cols-10 gap-1 text-xl select-none">
                    {EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory)?.emojis.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors flex items-center justify-center hover:scale-125 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* COMPOSITOR DE MENSAGENS FIXO (Estilo Telegram)       */}
              {/* =================================================== */}
              <div className="p-3 sm:p-4 bg-[#12161f] border-t border-white/[0.08] relative pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,audio/*,application/pdf"
                  className="hidden"
                />

                {audioRecordingState === "recording" ? (
                  /* 1. Modo Gravação Ativa */
                  <div className="flex items-center justify-between gap-3 bg-[#181d27] border border-rose-500/30 rounded-full px-4 py-2 animate-in fade-in">
                    <button
                      type="button"
                      onClick={handleDiscardRecordedAudio}
                      className="p-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                      title="Descartar gravação"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-mono font-bold text-white tracking-wide">
                        {formatTimer(recordingSeconds)}
                      </span>
                      <span className="text-[11px] text-zinc-400 hidden sm:inline">
                        Gravando áudio para o cliente...
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStopRecordingToPreview}
                      className="p-2 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white transition-colors cursor-pointer shadow-md shadow-[#3984FF]/25"
                      title="Parar e ouvir prévia"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                ) : audioRecordingState === "preview" ? (
                  /* 2. Modo Pré-visualização do Áudio com Player */
                  <div className="flex items-center justify-between gap-3 bg-[#181d27] border border-[#3984FF]/30 rounded-full px-4 py-2 animate-in fade-in">
                    <button
                      type="button"
                      onClick={handleDiscardRecordedAudio}
                      className="p-2 rounded-full hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Excluir áudio gravado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={handleTogglePlayPreview}
                        className="w-8 h-8 rounded-full bg-[#3984FF] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                        title={isPlayingPreview ? "Pausar" : "Ouvir"}
                      >
                        {isPlayingPreview ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">Nota de voz pronta</p>
                        <p className="text-[10px] text-zinc-400">
                          {formatTimer(recordingSeconds)} • Toque em enviar para despachar
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendRecordedAudio}
                      disabled={sendingMessage}
                      className="p-2.5 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white transition-all cursor-pointer shadow-lg shadow-[#3984FF]/25 flex items-center justify-center"
                      title="Enviar áudio"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <SendHorizontal className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ) : audioRecordingState === "sending" ? (
                  /* 3. Modo Transmissão do Áudio */
                  <div className="flex items-center justify-center gap-2 bg-[#181d27] border border-[#3984FF]/30 rounded-full px-4 py-2.5 text-xs text-[#3984FF] font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparando container e transmitindo áudio ao Telegram...</span>
                  </div>
                ) : (
                  /* 4. Modo Normal de Composição (Inspirado no Telegram) */
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    {/* Botão de Anexo (Paperclip) */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendingMessage}
                      className="p-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer shrink-0"
                      title="Anexar imagem ou documento"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Campo de Entrada de Mensagem com Pílula Redonda */}
                    <div className="flex-1 relative flex items-center">
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
                        className="w-full bg-[#181d26] border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#3984FF] transition-colors"
                      />

                      {/* Botão de Emojis dentro do Input */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className="absolute right-2.5 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="Inserir emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Botão Dinâmico: Microfone se vazio, Enviar se houver texto */}
                    {messageText.trim() || selectedFile ? (
                      <button
                        type="submit"
                        disabled={sendingMessage}
                        className="w-10 h-10 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white transition-all disabled:opacity-50 flex items-center justify-center shrink-0 shadow-lg shadow-[#3984FF]/25 cursor-pointer"
                        title="Enviar mensagem"
                      >
                        {sendingMessage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <SendHorizontal className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="w-10 h-10 rounded-full bg-[#3984FF] hover:bg-[#2563EB] text-white transition-all flex items-center justify-center shrink-0 shadow-lg shadow-[#3984FF]/25 cursor-pointer"
                        title="Gravar áudio"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* =================================================== */
            /* TELA VAZIA (NENHUMA CONVERSA SELECIONADA)           */
            /* =================================================== */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 relative z-10 select-none">
              <div className="max-w-sm bg-[#161a24]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#3984FF]/10 border border-[#3984FF]/25 flex items-center justify-center mx-auto text-[#3984FF]">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white tracking-tight">As conversas do seu bot</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Aqui aparecem as pessoas que falaram com o seu bot. Abra uma conversa para ler e responder como o bot.
                  </p>
                </div>
                <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[11px] text-zinc-400 flex items-center gap-2 text-left">
                  <Clock className="w-4 h-4 text-[#3984FF] shrink-0" />
                  <span>Mensagens sincronizadas em tempo real com o Telegram.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Se renderizado como Modal Imersivo:
  if (isModal) {
    const modalElement = (
      <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex flex-col p-0 sm:p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95">
        <div className="w-full h-full max-w-[1440px] mx-auto rounded-none sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl overflow-hidden flex flex-col">
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
    <div className="w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden min-h-[680px] h-[720px] flex flex-col">
      {content}
    </div>
  );
}
