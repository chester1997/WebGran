"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Camera,
  Trash2,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Percent,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  KeyRound,
  Bell,
  Trophy,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  Volume2,
  VolumeX,
  Download,
  Smartphone,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  playCommissionChime,
  unlockAudioContext,
  getNotificationSoundUrl
} from "@/lib/sound/notification-sound";
import { buildTestNotificationPayload } from "@/lib/push/notification-payload-builder";
import { Button } from "@/components/ui/button";
import {
  updateSellerProfileAction,
  changePasswordAction
} from "./actions";

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
  createdAt?: string | null;
}

interface TransactionFeeData {
  isAvailable: boolean;
  formattedFee: string;
  feeReais: number;
  feeCents?: number;
}

interface Props {
  storeName: string;
  storeId: string | null;
  transactionFee: TransactionFeeData;
  sellerProfile: SellerProfile;
}

/**
 * Formata data no padrão brasileiro com fuso comercial America/Recife
 */
function formatDateRecife(dateStr?: string | null): string {
  if (!dateStr) return "Indisponível";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Indisponível";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Recife",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return "Indisponível";
  }
}

export default function SettingsClient({
  storeName,
  storeId,
  transactionFee,
  sellerProfile
}: Props) {
  const router = useRouter();

  // Profile Form States
  const [name, setName] = useState(sellerProfile.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(sellerProfile.avatarUrl);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password Modal States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Browser Notifications & Real Web Push State
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("default");
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [vapidConfigured, setVapidConfigured] = useState<boolean | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isPlayingSoundTest, setIsPlayingSoundTest] = useState<boolean>(false);
  const [showAndroidSoundGuide, setShowAndroidSoundGuide] = useState<boolean>(false);

  useEffect(() => {
    setSoundEnabled(isNotificationSoundEnabled());
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkPushStatus() {
      if (typeof window === "undefined") return;

      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (isMounted) {
          setBrowserPermission("unsupported");
          setBrowserNotificationsEnabled(false);
        }
        return;
      }

      const currentPerm = Notification.permission;
      if (isMounted) setBrowserPermission(currentPerm);

      try {
        // Checa status do servidor
        const statusRes = await fetch("/api/seller/push/status").then((r) => r.json()).catch(() => null);
        if (statusRes && isMounted) {
          setVapidConfigured(!!statusRes.configured);
        }

        // Checa se o Service Worker possui assinatura Push ativa no dispositivo
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        if (reg) {
          reg.update().catch(() => null);
        }
        const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;

        const savedPref = localStorage.getItem("webgran_browser_notifications");

        if (currentPerm === "granted" && sub) {
          // Se o dispositivo possui inscrição no PushManager, assegura que está registrada no servidor para este usuário
          if (!statusRes?.hasActiveSubscription) {
            try {
              const rawKey = sub.getKey ? sub.getKey("p256dh") : null;
              const rawAuth = sub.getKey ? sub.getKey("auth") : null;
              const p256dh = rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : "";
              const auth = rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : "";
              if (p256dh && auth) {
                fetch("/api/seller/push/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    endpoint: sub.endpoint,
                    keys: { p256dh, auth },
                    userAgent: window.navigator.userAgent,
                  }),
                }).catch(() => {});
              }
            } catch (syncErr) {
              console.warn("[PWA Settings] Falha na auto-sincronização de assinatura:", syncErr);
            }
          }
          if (isMounted) setBrowserNotificationsEnabled(true);
        } else {
          if (isMounted) setBrowserNotificationsEnabled(false);
          if (currentPerm === "denied") {
            localStorage.setItem("webgran_browser_notifications", "false");
          }
        }
      } catch (err) {
        console.warn("[PWA Settings] Falha ao verificar status push:", err);
      }
    }

    checkPushStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(sellerProfile.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME types
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage("Por favor, selecione uma imagem no formato JPG, PNG ou WEBP.");
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("A imagem selecionada excede o tamanho máximo de 10MB.");
      return;
    }

    setErrorMessage(null);
    setSelectedAvatarFile(file);

    // Create immediate local preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
    setAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("O nome do vendedor é obrigatório.");
      return;
    }

    setSavingProfile(true);
    setErrorMessage(null);

    try {
      let finalAvatarUrl = avatarUrl;

      // Se um novo arquivo foi selecionado, faz o upload através da pipeline otimizada para o Bunny CDN
      if (selectedAvatarFile) {
        const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
        const uploadRes = await uploadOptimizedImage(selectedAvatarFile, "profiles");
        finalAvatarUrl = uploadRes.url;
      }

      await updateSellerProfileAction({
        name: name.trim(),
        avatarUrl: finalAvatarUrl,
      });

      setAvatarUrl(finalAvatarUrl);
      setSelectedAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }

      showToast("Perfil atualizado com sucesso!");
      window.dispatchEvent(new Event("seller-profile-updated"));
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Todos os campos são obrigatórios.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da nova senha não confere.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("A nova senha não pode ser igual à senha atual.");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res?.success) {
        setIsPasswordModalOpen(false);
        showToast("Senha alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Erro ao alterar senha. Verifique as credenciais.");
    } finally {
      setChangingPassword(false);
    }
  };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

  const handleToggleBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Seu navegador não oferece suporte completo a notificações Web Push / PWA.");
      return;
    }

    if (browserNotificationsEnabled) {
      // Desativação pelo usuário
      setRequestingPermission(true);
      try {
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
        if (sub) {
          await fetch("/api/seller/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
        setBrowserNotificationsEnabled(false);
        localStorage.setItem("webgran_browser_notifications", "false");
        showToast("Notificações push desativadas.");
      } catch (err: any) {
        console.error("Erro ao desativar push:", err);
      } finally {
        setRequestingPermission(false);
      }
      return;
    }

    // Ativação
    let currentPermission = Notification.permission;
    setBrowserPermission(currentPermission);

    if (currentPermission === "denied") {
      alert("As notificações estão bloqueadas nas configurações do seu navegador. Por favor, acesse as configurações do site e selecione 'Permitir' para ativá-las.");
      return;
    }

    setRequestingPermission(true);
    try {
      if (currentPermission !== "granted") {
        currentPermission = await Notification.requestPermission();
        setBrowserPermission(currentPermission);
        if (currentPermission !== "granted") {
          setBrowserNotificationsEnabled(false);
          localStorage.setItem("webgran_browser_notifications", "false");
          if (currentPermission === "denied") {
            showToast("Permissão de notificações recusada no navegador.");
          }
          return;
        }
      }

      // 1. Obter chave pública VAPID do servidor
      const statusRes = await fetch("/api/seller/push/status").then((r) => r.json()).catch(() => null);
      const publicKey = statusRes?.publicKey;

      if (!publicKey) {
        alert("A chave pública VAPID ainda não foi configurada nas variáveis de ambiente da Vercel (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
        return;
      }

      // 2. Registrar PushManager no Service Worker
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const convertedKey = urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      // 3. Extrair chaves criptográficas
      const rawKey = sub.getKey ? sub.getKey("p256dh") : null;
      const rawAuth = sub.getKey ? sub.getKey("auth") : null;
      const p256dh = rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : "";
      const auth = rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : "";

      // 4. Salvar assinatura no servidor vinculada ao vendedor autenticado
      const saveRes = await fetch("/api/seller/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh, auth },
          userAgent: window.navigator.userAgent,
        }),
      });

      const saveData = await saveRes.json().catch(() => null);

      if (!saveRes.ok) {
        throw new Error(saveData?.error || "Erro ao registrar assinatura no servidor.");
      }

      setBrowserNotificationsEnabled(true);
      localStorage.setItem("webgran_browser_notifications", "true");
      showToast("Notificações push PWA ativadas com sucesso!");
    } catch (err: any) {
      console.error("Erro ao ativar notificações push:", err);
      alert(`Falha ao ativar notificações push: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      alert("Permissão de notificação não concedida.");
      return;
    }

    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => reg?.update().catch(() => null)).catch(() => null);
      }

      showToast("Enviando notificação de teste...");
      const res = await fetch("/api/seller/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        // Fallback local se o servidor não conseguir enviar o push (ex: VAPID pendente no ambiente)
        try {
          const testPayload = buildTestNotificationPayload({
            userName: sellerProfile.name,
            role: sellerProfile.role,
          });

          let shownViaSw = false;
          if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            if (reg && "showNotification" in reg) {
              await reg.showNotification(testPayload.title, {
                body: testPayload.body,
                icon: testPayload.icon,
                badge: testPayload.badge,
                data: testPayload.data,
                tag: testPayload.tag,
              });
              shownViaSw = true;
            }
          }

          if (!shownViaSw) {
            new Notification(testPayload.title, {
              body: testPayload.body,
              icon: testPayload.icon,
              badge: testPayload.badge,
              data: testPayload.data,
              tag: testPayload.tag,
            });
          }

          showToast("Notificação local exibida (configuração VAPID pendente no servidor).");
        } catch {
          alert(data?.message || "Erro ao disparar teste de notificação.");
        }
      } else {
        showToast(data.message || `Notificação push enviada para ${data.details?.sentCount || 1} dispositivo(s)!`);
      }

      // Desbloquear audio e reproduzir o som da comissão quando a notificação for testada
      await unlockAudioContext();
      await playCommissionChime({ force: false, eventId: "test-notification" });
    } catch (err: any) {
      console.error("Erro ao disparar notificação de teste:", err);
      showToast("Erro ao contatar o servidor para envio de teste.");
    }
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) {
      await unlockAudioContext();
      playCommissionChime({ force: true });
    }
  };

  const handleTestSound = async () => {
    setIsPlayingSoundTest(true);
    await unlockAudioContext();
    await playCommissionChime({ force: true });
    setTimeout(() => setIsPlayingSoundTest(false), 1200);
  };

  const displayedAvatar = avatarPreview || avatarUrl;
  const firstLetter = (name || sellerProfile.email || "V").charAt(0).toUpperCase();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <User className="w-7 h-7 text-red-500" />
          Meu Perfil
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Gerencie as suas informações de vendedor, segurança e preferências na plataforma WebGran.
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ÁREA 1: PERFIL DO VENDEDOR & DESTAQUE DE TAXA POR TRANSAÇÃO */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Principal: Perfil do Vendedor (2 Colunas no Desktop) */}
        <div className="lg:col-span-2 bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <div className="border-b border-white/5 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-red-500" />
                  Informações da Conta
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dados de identificação do vendedor cadastrado na plataforma.
                </p>
              </div>

              {/* Account ID Pill */}
              <button
                type="button"
                onClick={handleCopyId}
                title="Clique para copiar o identificador da conta"
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-zinc-500">ID:</span>
                <span>{sellerProfile.id.slice(0, 8)}...</span>
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>
            </div>

            {/* Profile Content */}
            <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-[#16161C] flex items-center justify-center shadow-lg">
                    {displayedAvatar ? (
                      <img
                        src={displayedAvatar}
                        alt="Foto de perfil do vendedor"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-white uppercase">{firstLetter}</span>
                    )}
                  </div>

                  {/* Hover Overlay */}
                  <label
                    htmlFor="avatar-file-input"
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer text-white text-[11px] font-semibold gap-1"
                    title="Alterar foto de perfil"
                  >
                    <Camera className="w-5 h-5 text-white" />
                    <span>Alterar</span>
                  </label>

                  <input
                    ref={fileInputRef}
                    id="avatar-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileSelect}
                    className="hidden"
                  />
                </div>

                <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white">Foto de perfil</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Formatos aceitos: JPG, PNG ou WEBP. Tamanho máximo: 10MB.
                  </p>

                  {avatarPreview && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Sparkles className="w-3 h-3" />
                      Prévia carregada. Clique em "Salvar alterações" para confirmar.
                    </span>
                  )}

                  <div className="flex items-center gap-3 pt-1 justify-center sm:justify-start">
                    <label
                      htmlFor="avatar-file-input"
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer transition-all border border-white/10"
                    >
                      Alterar foto
                    </label>

                    {displayedAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all border border-red-500/20 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Nome do vendedor
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo ou da marca"
                    className="w-full bg-[#18181C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      E-mail da conta
                    </label>
                    <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Somente leitura
                    </span>
                  </div>
                  <input
                    type="email"
                    value={sellerProfile.email}
                    disabled
                    readOnly
                    className="w-full bg-[#141418] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed select-none"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    O e-mail é utilizado para login no sistema e não pode ser alterado diretamente.
                  </p>
                </div>
              </div>

              {/* Metadata Info: Membro desde (Layout limpo e balanceado) */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#18181C] border border-white/5 flex-1">
                  <Calendar className="w-4 h-4 text-red-500 shrink-0" />
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-xs">Membro desde:</span>
                    <span className="text-white font-semibold">
                      {formatDateRecife(sellerProfile.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer shrink-0"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar alterações</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Card de Destaque: Taxa por Transação (1 Coluna no Desktop) */}
        <div className="bg-gradient-to-br from-[#16161c] via-[#121214] to-[#121214] border border-emerald-500/20 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Percent className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  Modelo Financeiro
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                Sem Mensalidade
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">
                Taxa por transação
              </h3>

              {transactionFee.isAvailable ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-tight">
                    {transactionFee.formattedFee}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    / venda
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  Taxa temporariamente indisponível no servidor.
                </div>
              )}

              <p className="text-xs text-emerald-400/90 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Taxa aplicada em cada transação aprovada
              </p>

              <p className="text-xs text-zinc-400 leading-relaxed pt-2">
                Você não paga taxa de adesão ou assinatura mensal pelo uso do painel e bots. A taxa é retida automaticamente no split Pix exclusivamente em pedidos pagos com sucesso.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-2 text-[11px] text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Custos fixos mensais:</span>
              <span className="font-bold text-emerald-400">R$ 0,00</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retenção no split Pix:</span>
              <span className="font-semibold text-zinc-200">Automática</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Transações não concluídas:</span>
              <span className="font-semibold text-zinc-200">Isentas de taxa</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ÁREA 2: SEGURANÇA, PREFERÊNCIAS & PREMIAÇÕES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Segurança (Apenas Trocar Senha) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
              <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">Segurança</h3>
                <p className="text-[11px] text-zinc-400">Credenciais de acesso à conta</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-[#18181C] border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-zinc-300" />
                  <span className="text-xs font-semibold text-white">Trocar senha</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Atualize sua senha de acesso periodicamente para manter sua conta e sua loja protegidas.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Button
              type="button"
              onClick={handleOpenPasswordModal}
              className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Alterar senha</span>
            </Button>
          </div>
        </div>

        {/* Card 2: Preferências (Somente Notificações do Navegador) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
              <Bell className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">Preferências</h3>
                <p className="text-[11px] text-zinc-400">Notificações do navegador</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* Notificações no Navegador */}
              <div className="p-3.5 rounded-xl bg-[#18181C] border border-white/5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block">
                      Notificações no Navegador
                    </span>
                    <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                      Alertas em tempo real sobre vendas
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleBrowserNotifications}
                    disabled={requestingPermission || browserPermission === "unsupported"}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      browserNotificationsEnabled ? "bg-red-600" : "bg-zinc-700"
                    } ${requestingPermission ? "opacity-50 cursor-wait" : ""}`}
                    role="switch"
                    aria-checked={browserNotificationsEnabled}
                    aria-label="Ativar ou desativar notificações do navegador"
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        browserNotificationsEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Status Explicativo e Contextual */}
                <div className="pt-2 border-t border-white/5 text-[11px] leading-relaxed">
                  {browserPermission === "unsupported" ? (
                    <div className="flex items-start gap-1.5 text-zinc-400">
                      <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span>Este navegador não possui suporte a notificações de área de trabalho.</span>
                    </div>
                  ) : browserPermission === "denied" ? (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Permissão bloqueada no navegador</span>
                      </div>
                      <p className="text-[10px] text-zinc-300">
                        Para reativar, clique no ícone de cadeado na barra de endereços do seu navegador e altere a permissão de Notificações para <strong>"Permitir"</strong>.
                      </p>
                    </div>
                  ) : browserPermission === "granted" && browserNotificationsEnabled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-emerald-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Ativas e autorizadas (Push PWA)
                        </span>
                      </div>
                      {vapidConfigured === false && (
                        <p className="text-[10px] text-amber-400/90 leading-tight">
                          Nota: Configure as chaves VAPID na Vercel para envio de alertas em segundo plano com o app fechado.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleSendTestNotification}
                        className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        Enviar notificação de teste
                      </button>
                    </div>
                  ) : browserPermission === "granted" && !browserNotificationsEnabled ? (
                    <div className="text-zinc-400">
                      Desativadas. O navegador já está autorizado; clique no interruptor para ativar os alertas push.
                    </div>
                  ) : (
                    <div className="text-amber-400/90 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>O navegador solicitará sua autorização ao ativar este recurso.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Som das Notificações */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-zinc-500" />
                      )}
                      <span>Som das notificações</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Reproduzir efeito sonoro oficial ao receber notificações com o painel aberto.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <a
                      href={getNotificationSoundUrl()}
                      download="webgran-notificacao.mp3"
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Baixar arquivo de áudio para definir como toque de notificação no Android"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Baixar Áudio (.mp3)</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleTestSound}
                      disabled={isPlayingSoundTest}
                      title="Testar som agora"
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isPlayingSoundTest ? "animate-bounce text-emerald-400" : ""}`} />
                      <span>{isPlayingSoundTest ? "Tocando..." : "Testar Som"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleSound}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 ${
                        soundEnabled ? "bg-emerald-500" : "bg-zinc-700"
                      }`}
                      role="switch"
                      aria-checked={soundEnabled}
                      aria-label="Ativar ou desativar som das notificações"
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          soundEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Guia Android / Notificações em Segundo Plano */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowAndroidSoundGuide(!showAndroidSoundGuide)}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center justify-between w-full transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>Como ativar o som personalizado no Android (PWA fechado ou em segundo plano)</span>
                    </span>
                    {showAndroidSoundGuide ? (
                      <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    )}
                  </button>

                  {showAndroidSoundGuide && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-zinc-300 space-y-2.5 leading-relaxed animate-in fade-in-50 duration-150">
                      <p className="font-semibold text-white">
                        Por que o Android requer esse ajuste para o som em segundo plano?
                      </p>
                      <p className="text-zinc-400">
                        Quando o WebGran está fechado, as notificações são entregues pelo sistema operacional via <strong>Canais de Notificação</strong>. Por segurança e padrão do Android, navegadores e WebAPKs não têm permissão para injetar arquivos MP3 arbitrários diretamente no motor de som nativo do sistema. No entanto, o Android permite que você atribua o som desejado ao canal da aplicação:
                      </p>
                      <div className="space-y-1.5 text-zinc-300 pt-0.5">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-red-500 shrink-0">1.</span>
                          <span>Clique no botão <strong>"Baixar Áudio (.mp3)"</strong> acima e salve o arquivo na pasta <em>Notifications</em> do seu celular.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-red-500 shrink-0">2.</span>
                          <span>Na tela inicial do Android, pressione e segure o ícone do <strong>WebGran</strong> &gt; toque no ícone de informação <strong>(i)</strong> &gt; <strong>Notificações</strong>.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-red-500 shrink-0">3.</span>
                          <span>Acesse <strong>Categorias de notificação</strong> &gt; toque na categoria do WebGran &gt; certifique-se de selecionar <strong>Alerta</strong> (não silencioso) &gt; toque em <strong>Som</strong> e escolha o arquivo baixado.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/5">
            Preferência salva localmente no seu dispositivo.
          </div>
        </div>

        {/* Card 3: Premiações (Em Breve) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5 relative">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="text-sm font-bold text-white">Premiações</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wide">
                Em breve
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Discrete placeholder items */}
              <div className="p-3.5 rounded-xl bg-[#18181C]/60 border border-dashed border-white/10 space-y-1.5 opacity-80">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-zinc-300">
                    Programa de Marcos & Conquistas
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Conquiste placas e benefícios exclusivos conforme o faturamento da sua loja cresce no WebGran.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#18181C]/60 border border-dashed border-white/10 space-y-1.5 opacity-80">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-300">
                    Clube de Vendedores WebGran
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Vantagens comerciais, suporte prioritário e recursos exclusivos em desenvolvimento.
                </p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>Recurso previsto para as próximas atualizações da plataforma.</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: TROCAR SENHA */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121214] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">Alterar senha de acesso</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Senha atual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="w-full bg-[#18181C] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full bg-[#18181C] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    className="w-full bg-[#18181C] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={changingPassword}
                  className="border-white/10 text-zinc-300 hover:bg-white/5 text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs py-2 px-5 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/20"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Atualizando...</span>
                    </>
                  ) : (
                    <span>Atualizar senha</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
