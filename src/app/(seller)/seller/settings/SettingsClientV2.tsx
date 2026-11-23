"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SellerPageHeader from "@/components/layout/SellerPageHeader";
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
  ArrowRight,
  Pencil,
  X,
  Receipt,
  Wallet,
  Ban,
  Smartphone,
  ChevronDown
} from "lucide-react";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  getNotificationSoundPreferences,
  saveNotificationSoundPreferences,
  playCommissionChime,
  unlockAudioSystem,
  unlockAudioContext
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

export default function SettingsClientV2({
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
  const [soundVolume, setSoundVolume] = useState<number>(80);
  const [soundId, setSoundId] = useState<string>("commission");
  const [isIosDevice, setIsIosDevice] = useState<boolean>(false);
  const [isPlayingSoundTest, setIsPlayingSoundTest] = useState<boolean>(false);

  useEffect(() => {
    const prefs = getNotificationSoundPreferences(sellerProfile.id);
    setSoundEnabled(prefs.enabled);
    setSoundVolume(prefs.volume);
    setSoundId(prefs.soundId);

    if (typeof navigator !== "undefined") {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
      setIsIosDevice(isIos);
    }
  }, [sellerProfile.id]);

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
        let reg = await navigator.serviceWorker.getRegistration().catch(() => null);
        if (!reg) {
          reg = await navigator.serviceWorker.register("/sw.js").catch(() => null);
        }
        if (reg) {
          reg.update().catch(() => null);
        }
        const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;

        const savedPref = localStorage.getItem("webgran_browser_notifications");

        if (currentPerm === "granted" && sub) {
          // Se o dispositivo possui inscrição no PushManager, assegura que está registrada no servidor para este usuário
          if (!statusRes?.hasActiveSubscription) {
            try {
              const subJson = sub.toJSON();
              const rawKey = sub.getKey ? sub.getKey("p256dh") : null;
              const rawAuth = sub.getKey ? sub.getKey("auth") : null;
              const p256dh = subJson.keys?.p256dh || (rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : "");
              const auth = subJson.keys?.auth || (rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : "");
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
  const cleanStr = (base64String || "").trim().replace(/^["']|["']$/g, "");
  const padding = "=".repeat((4 - (cleanStr.length % 4)) % 4);
  const base64 = (cleanStr + padding).replace(/-/g, "+").replace(/_/g, "/");
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
        let reg = await navigator.serviceWorker.getRegistration().catch(() => null);
        if (!reg) {
          reg = await navigator.serviceWorker.ready.catch(() => null);
        }
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

      // 2. Registrar PushManager no Service Worker (garantindo que o SW está ativo)
      let reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js").catch(() => null);
      }
      if (!reg) {
        throw new Error("Não foi possível inicializar o Service Worker no seu navegador.");
      }

      // Aguarda SW estar pronto com timeout defensivo
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);

      const convertedKey = urlBase64ToUint8Array(publicKey);
      let sub = await reg.pushManager.getSubscription().catch(() => null);

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      // 3. Extrair chaves criptográficas (formato padrão W3C toJSON com fallback)
      const subJson = sub.toJSON ? sub.toJSON() : null;
      const rawKey = sub.getKey ? sub.getKey("p256dh") : null;
      const rawAuth = sub.getKey ? sub.getKey("auth") : null;
      const p256dh = subJson?.keys?.p256dh || (rawKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey)))) : "");
      const auth = subJson?.keys?.auth || (rawAuth ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth)))) : "");

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

      // Desbloqueia o áudio imediatamente no gesto do usuário
      await unlockAudioContext();
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

          const resolvedIcon = testPayload.icon.startsWith("http")
            ? testPayload.icon
            : new URL(testPayload.icon, window.location.origin).href;
          const resolvedBadge = testPayload.badge.startsWith("http")
            ? testPayload.badge
            : new URL(testPayload.badge, window.location.origin).href;

          let shownViaSw = false;
          if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready.catch(() => null);
            if (reg && "showNotification" in reg) {
              await reg.showNotification(testPayload.title, {
                body: testPayload.body,
                icon: resolvedIcon,
                badge: resolvedBadge,
                data: testPayload.data,
                tag: `${testPayload.tag}-${Date.now()}`,
              });
              shownViaSw = true;
            }
          }

          if (!shownViaSw) {
            new Notification(testPayload.title, {
              body: testPayload.body,
              icon: resolvedIcon,
              badge: resolvedBadge,
              data: testPayload.data,
              tag: `${testPayload.tag}-${Date.now()}`,
            });
          }

          showToast("Notificação local exibida (configuração VAPID pendente no servidor).");
        } catch {
          alert(data?.message || "Erro ao disparar teste de notificação.");
        }
      } else {
        showToast(data.message || `Notificação push enviada para ${data.details?.sentCount || 1} dispositivo(s)!`);
      }

      // Desbloquear áudio e reproduzir comissão com garantia (force: true e ID dinâmico)
      await unlockAudioContext();
      await playCommissionChime({ force: true, eventId: `test-notification-${Date.now()}` });
    } catch (err: any) {
      console.error("Erro ao disparar notificação de teste:", err);
      showToast("Erro ao contatar o servidor para envio de teste.");
    }
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveNotificationSoundPreferences({ enabled: next }, sellerProfile.id);
    if (next) {
      await unlockAudioSystem();
      playCommissionChime({ force: true, volume: soundVolume, eventId: `toggle-sound-${Date.now()}` }).catch(() => {});
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setSoundVolume(newVol);
    saveNotificationSoundPreferences({ volume: newVol }, sellerProfile.id);
  };

  const handleSoundIdChange = (newSoundId: string) => {
    setSoundId(newSoundId);
    saveNotificationSoundPreferences({ soundId: newSoundId }, sellerProfile.id);
  };

  const handleTestSound = async () => {
    setIsPlayingSoundTest(true);
    try {
      await unlockAudioSystem();
      const played = await playCommissionChime({
        force: true,
        volume: soundVolume,
        eventId: `manual-test-chime-${Date.now()}`,
      });
      if (!played) {
        showToast("Áudio bloqueado pelo navegador. Toque na tela para liberar.");
      }
    } catch {
      showToast("Áudio bloqueado pelo navegador. Toque na tela para liberar.");
    } finally {
      setTimeout(() => setIsPlayingSoundTest(false), 1200);
    }
  };

  const displayedAvatar = avatarPreview || avatarUrl;
  const firstLetter = (name || sellerProfile.email || "V").charAt(0).toUpperCase();

  // ---------------------------------------------------------------------------
  // Redesign V2: estado só de interface (edição inline do nome)
  // ---------------------------------------------------------------------------
  const [editingName, setEditingName] = useState(false);
  const avatarDirty = Boolean(avatarPreview) || avatarUrl !== sellerProfile.avatarUrl;

  const handleCancelName = () => {
    setName(sellerProfile.name);
    setEditingName(false);
  };

  const handleCancelAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setSelectedAvatarFile(null);
    setAvatarUrl(sellerProfile.avatarUrl);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitProfile = async (e: React.FormEvent) => {
    if (!name.trim()) {
      e.preventDefault();
      setErrorMessage("O nome do vendedor é obrigatório.");
      return;
    }
    await handleSaveProfile(e);
    setEditingName(false);
  };

  const notificationStatus = (() => {
    if (browserPermission === "unsupported") return { text: "Este navegador não suporta notificações.", tone: "muted" as const };
    if (browserPermission === "denied") return { text: "Bloqueadas no navegador. Libere no cadeado da barra de endereços.", tone: "danger" as const };
    if (browserPermission === "granted" && browserNotificationsEnabled) return { text: "Ativas neste dispositivo.", tone: "ok" as const };
    if (browserPermission === "granted") return { text: "Desligadas. Ative para receber alertas de venda.", tone: "muted" as const };
    return { text: "O navegador vai pedir sua autorização ao ativar.", tone: "muted" as const };
  })();

  return (
    <div className="w-full min-w-0 pb-12 space-y-5">
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#151619] border border-white/10 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-medium animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <SellerPageHeader
        title="Meu Perfil"
        subtitle="Seus dados, segurança e preferências na WebGran."
      />

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-300 px-4 py-3 rounded-xl text-[13px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-300/70 hover:text-red-200" aria-label="Fechar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        id="avatar-file-input-v2"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleAvatarFileSelect}
        className="hidden"
      />

      {/* ================= PERFIL ================= */}
      <form onSubmit={submitProfile} className={`${CARD} grid grid-cols-1 md:grid-cols-[260px_1fr] overflow-hidden`}>
        {/* Coluna da foto */}
        <div className="flex flex-col items-center justify-center text-center gap-3 px-6 py-8 border-b md:border-b-0 md:border-r border-white/[0.07]">
          <div className="relative">
            <div className="w-[116px] h-[116px] rounded-full p-[3px] bg-gradient-to-br from-[#3984FF] via-[#1d4ed8] to-[#0b1220]">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#0d0e12] flex items-center justify-center">
                {displayedAvatar ? (
                  <img src={displayedAvatar} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white">{firstLetter}</span>
                )}
              </div>
            </div>
            <label
              htmlFor="avatar-file-input-v2"
              title="Trocar foto"
              className="absolute bottom-0.5 right-0.5 w-9 h-9 rounded-full bg-[#1b1c21] border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-[#25262c] cursor-pointer transition-colors"
            >
              <Pencil className="w-4 h-4" />
              <span className="sr-only">Trocar foto</span>
            </label>
          </div>

          <div className="min-w-0 max-w-full">
            <p className="text-[16px] font-semibold text-white truncate">{sellerProfile.name}</p>
            <p className="text-[13px] text-zinc-500 truncate">{sellerProfile.email}</p>
          </div>

          {avatarDirty ? (
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3984FF] hover:bg-[#2f74e6] text-white text-[12px] font-semibold disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salvar foto
              </button>
              <button
                type="button"
                onClick={handleCancelAvatar}
                disabled={savingProfile}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/[0.05] text-[12px] font-medium"
              >
                Cancelar
              </button>
            </div>
          ) : displayedAvatar ? (
            <button type="button" onClick={handleRemoveAvatar} className="text-[12px] text-zinc-500 hover:text-red-400 transition-colors">
              Remover foto
            </button>
          ) : (
            <p className="text-[11.5px] text-zinc-600">JPG, PNG ou WEBP · até 10MB</p>
          )}
        </div>

        {/* Coluna dos dados */}
        <div className="px-6 sm:px-7 divide-y divide-white/[0.07]">
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-zinc-500">Nome de exibição</p>
              {editingName ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleCancelName();
                  }}
                  placeholder="Seu nome ou da sua marca"
                  className="mt-1.5 w-full max-w-sm bg-[#0d0e12] border border-white/10 focus:border-[#3984FF] rounded-lg px-3 py-2 text-[15px] text-white outline-none transition-colors"
                />
              ) : (
                <p className="mt-0.5 text-[15px] font-semibold text-white truncate">{sellerProfile.name}</p>
              )}
            </div>
            {editingName ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3984FF] hover:bg-[#2f74e6] text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar
                </button>
                <button type="button" onClick={handleCancelName} className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-[13px] font-medium">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300 hover:text-white transition-colors"
              >
                <Pencil className="w-4 h-4 text-zinc-500" />
                Editar
              </button>
            )}
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-500">E-mail</p>
              <p className="mt-0.5 text-[15px] font-semibold text-white truncate">{sellerProfile.email}</p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/10 text-[11.5px] font-medium text-zinc-400">
              <Lock className="w-3 h-3" />
              Usado no login
            </span>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-500">ID da conta</p>
              <p className="mt-0.5 text-[14px] font-mono text-zinc-200 truncate">{sellerProfile.id}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-500" />}
              {copiedId ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className="py-4">
            <p className="text-[13px] text-zinc-500">Conta criada em</p>
            <p className="mt-0.5 text-[15px] font-semibold text-white">{formatCreatedAt(sellerProfile.createdAt)}</p>
          </div>
        </div>
      </form>

      {/* ================= PLANO E TAXAS ================= */}
      <section className={CARD}>
        <SectionHeader title="Plano e taxas" subtitle="Sem mensalidade: você só paga quando vende." />
        <div className="px-6 sm:px-7 divide-y divide-white/[0.07]">
          <Row icon={<Percent className="w-[18px] h-[18px]" />} title="Taxa por venda" description="Cobrada só em vendas aprovadas.">
            {transactionFee.isAvailable ? (
              <span className="text-[15px] font-semibold text-white tabular-nums">
                {transactionFee.formattedFee}
                <span className="text-[12.5px] font-normal text-zinc-500"> / venda</span>
              </span>
            ) : (
              <span className="text-[13px] text-amber-400">Indisponível no momento</span>
            )}
          </Row>
          <Row icon={<Wallet className="w-[18px] h-[18px]" />} title="Mensalidade" description="Sem adesão e sem assinatura.">
            <span className="text-[15px] font-semibold text-emerald-400 tabular-nums">R$ 0,00</span>
          </Row>
          <Row icon={<Receipt className="w-[18px] h-[18px]" />} title="Como a taxa é cobrada" description="Descontada automaticamente no split do Pix.">
            <span className="text-[13.5px] font-medium text-zinc-200">Automática</span>
          </Row>
          <Row icon={<Ban className="w-[18px] h-[18px]" />} title="Vendas não concluídas" description="Pix expirado ou cancelado.">
            <span className="text-[13.5px] font-medium text-zinc-200">Sem taxa</span>
          </Row>
        </div>
      </section>

      {/* ================= SEGURANÇA ================= */}
      <section className={CARD}>
        <SectionHeader title="Segurança" subtitle="Acesso à sua conta." />
        <div className="px-6 sm:px-7 divide-y divide-white/[0.07]">
          <Row icon={<KeyRound className="w-[18px] h-[18px]" />} title="Senha" description="Troque de tempos em tempos para manter a loja protegida.">
            <button
              type="button"
              onClick={handleOpenPasswordModal}
              className="px-3.5 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.07] text-[13px] font-semibold text-zinc-100 transition-colors"
            >
              Alterar senha
            </button>
          </Row>
        </div>
      </section>

      {/* ================= NOTIFICAÇÕES ================= */}
      <section className={CARD}>
        <SectionHeader title="Notificações" subtitle="Como o painel avisa você das vendas." />
        <div className="px-6 sm:px-7 divide-y divide-white/[0.07]">
          <Row
            icon={<Bell className="w-[18px] h-[18px]" />}
            title="Notificações no navegador"
            description={
              <span
                className={
                  notificationStatus.tone === "ok"
                    ? "text-emerald-400"
                    : notificationStatus.tone === "danger"
                      ? "text-red-400"
                      : undefined
                }
              >
                {notificationStatus.text}
                {browserPermission === "granted" && browserNotificationsEnabled && (
                  <>
                    {" "}
                    <button type="button" onClick={handleSendTestNotification} className="text-zinc-400 hover:text-white underline underline-offset-2">
                      Enviar teste
                    </button>
                  </>
                )}
                {vapidConfigured === false && browserNotificationsEnabled && (
                  <span className="block text-amber-400/90">Chaves VAPID pendentes na Vercel para envio em segundo plano.</span>
                )}
              </span>
            }
          >
            <Toggle
              checked={browserNotificationsEnabled}
              onChange={handleToggleBrowserNotifications}
              disabled={requestingPermission || browserPermission === "unsupported"}
              busy={requestingPermission}
              label="Notificações no navegador"
            />
          </Row>

          <Row
            icon={soundEnabled ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px]" />}
            title="Som ao receber venda"
            description="Toca uma caixa registradora quando uma venda é aprovada com o painel aberto."
          >
            <Toggle checked={soundEnabled} onChange={handleToggleSound} label="Som ao receber venda" />
          </Row>

          {soundEnabled && (
            <Row
              icon={<Volume2 className="w-[18px] h-[18px]" />}
              title="Volume"
              description={isIosDevice ? "No iPhone, use também os botões do aparelho." : "Caixa Registradora (padrão WebGran)."}
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soundVolume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  style={{ background: `linear-gradient(to right, #3984FF ${soundVolume}%, #3f3f46 ${soundVolume}%)` }}
                  className="w-24 sm:w-32 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                  aria-label="Volume do som de venda"
                />
                <span className="w-9 text-right text-[13px] text-zinc-400 tabular-nums">{soundVolume}%</span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  disabled={isPlayingSoundTest}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.07] text-[12.5px] font-semibold text-zinc-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {isPlayingSoundTest ? "Tocando..." : "Testar"}
                </button>
              </div>
            </Row>
          )}

          <details className="group py-4">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-3.5">
                <span className={ICON_TILE}>
                  <Smartphone className="w-[18px] h-[18px]" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-white">Som com o app fechado</span>
                  <span className="block text-[13px] text-zinc-500">Como trocar o toque no celular.</span>
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 sm:ml-[54px] text-[13px] text-zinc-400 leading-relaxed space-y-2">
              {isIosDevice ? (
                <p>
                  No iPhone, abra <span className="text-zinc-200">Ajustes › Notificações › WebGran</span> e ligue <span className="text-zinc-200">Sons</span>. Com o app fechado, o iOS usa o toque padrão do sistema.
                </p>
              ) : (
                <p>
                  No Android, abra <span className="text-zinc-200">Configurações › Apps › WebGran › Notificações</span> e escolha o toque que preferir.
                </p>
              )}
              <p>
                Quer ouvir mesmo com a tela apagada?{" "}
                <Link href="/seller/store#notifications" className="text-[#60a5fa] hover:text-[#93c5fd] font-medium inline-flex items-center gap-1">
                  Avisos de venda no Telegram <ArrowRight className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* ================= PREMIAÇÕES ================= */}
      <section className={CARD}>
        <div className="px-6 sm:px-7">
          <Row icon={<Trophy className="w-[18px] h-[18px]" />} title="Premiações" description="Placas e benefícios conforme seu faturamento cresce.">
            <span className="px-2.5 py-0.5 rounded-full border border-amber-500/30 text-amber-400 text-[11.5px] font-semibold">Em breve</span>
          </Row>
        </div>
      </section>

      {/* ================= MODAL: TROCAR SENHA ================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141519] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07]">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Alterar senha</h3>
                <p className="text-[13px] text-zinc-500">Use pelo menos 6 caracteres.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="px-6 py-5 space-y-4">
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/25 text-red-300 px-3.5 py-2.5 rounded-lg text-[13px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              <PasswordField label="Senha atual" value={currentPassword} onChange={setCurrentPassword} visible={showCurrentPassword} onToggle={() => setShowCurrentPassword(!showCurrentPassword)} placeholder="Digite sua senha atual" />
              <PasswordField label="Nova senha" value={newPassword} onChange={setNewPassword} visible={showNewPassword} onToggle={() => setShowNewPassword(!showNewPassword)} placeholder="Mínimo de 6 caracteres" />
              <PasswordField label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} placeholder="Repita a nova senha" />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={changingPassword}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-zinc-300 hover:bg-white/[0.05]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3984FF] hover:bg-[#2f74e6] text-white text-[13px] font-semibold disabled:opacity-60"
                >
                  {changingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {changingPassword ? "Salvando..." : "Salvar nova senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Peças visuais do Redesign V2
// -----------------------------------------------------------------------------
const CARD = "bg-[#141519] border border-white/[0.08] rounded-[16px]";
const ICON_TILE = "w-10 h-10 shrink-0 rounded-[10px] border border-white/[0.09] bg-white/[0.02] flex items-center justify-center text-zinc-300";

/** "16 de set. de 2026, 21:07" no fuso de Recife. */
export function formatCreatedAt(dateStr?: string | null): string {
  if (!dateStr) return "Indisponível";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-6 sm:px-7 pt-5 pb-4 border-b border-white/[0.07]">
      <h2 className="text-[16px] font-semibold text-white">{title}</h2>
      <p className="text-[13px] text-zinc-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function Row({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3.5 min-w-0">
        <span className={ICON_TILE}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-white">{title}</p>
          <div className="text-[13px] text-zinc-500 leading-snug">{description}</div>
        </div>
      </div>
      {children && <div className="shrink-0 pl-[54px] sm:pl-0">{children}</div>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  busy,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-[#3984FF]" : "bg-zinc-700"
      } ${busy ? "cursor-wait" : "cursor-pointer"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-zinc-300 mb-1.5">{label}</span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full bg-[#0d0e12] border border-white/10 focus:border-[#3984FF] rounded-lg px-3.5 py-2.5 pr-10 text-[14px] text-white outline-none transition-colors placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </span>
    </label>
  );
}
