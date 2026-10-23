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
  Clock,
  Calendar,
  ShieldCheck,
  KeyRound,
  Bell,
  Trophy,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateSellerProfileAction,
  changePasswordAction,
  saveSellerNotificationPreferenceAction
} from "./actions";

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
  createdAt?: string | null;
  lastLoginAt?: string | null;
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
  storeTelegramNotificationId: string | null;
  transactionFee: TransactionFeeData;
  sellerProfile: SellerProfile;
}

/**
 * Formata data no padrÃ£o brasileiro com fuso horÃ¡rio America/Recife
 */
function formatDateRecife(dateStr?: string | null): string {
  if (!dateStr) return "IndisponÃ­vel";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "IndisponÃ­vel";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Recife",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return "IndisponÃ­vel";
  }
}

export default function SettingsClient({
  storeName,
  storeId,
  storeTelegramNotificationId,
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

  // Notifications State
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(
    Boolean(storeTelegramNotificationId && storeTelegramNotificationId.trim())
  );
  const [telegramId, setTelegramId] = useState(storeTelegramNotificationId || "");
  const [isEditingTelegramId, setIsEditingTelegramId] = useState(false);
  const [telegramInputVal, setTelegramInputVal] = useState(storeTelegramNotificationId || "");
  const [savingNotification, setSavingNotification] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  // Browser Notifications State
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("webgran_browser_notifications");
      if (saved === "true" && "Notification" in window && Notification.permission === "granted") {
        setBrowserNotificationsEnabled(true);
      }
      if ("Notification" in window) {
        setBrowserPermission(Notification.permission);
      }
    }
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
      setErrorMessage("A imagem selecionada excede o tamanho mÃ¡ximo de 10MB.");
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
      setErrorMessage("O nome do vendedor Ã© obrigatÃ³rio.");
      return;
    }

    setSavingProfile(true);
    setErrorMessage(null);

    try {
      let finalAvatarUrl = avatarUrl;

      // If a new file was chosen, upload it through the optimized CDN pipeline
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
      setPasswordError("Todos os campos sÃ£o obrigatÃ³rios.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter no mÃ­nimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmaÃ§Ã£o da nova senha nÃ£o confere.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("A nova senha nÃ£o pode ser igual Ã  senha atual.");
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

  const handleToggleTelegramNotifications = async () => {
    setNotificationError(null);

    // If currently enabled, toggling off disables notifications
    if (telegramNotificationsEnabled) {
      setSavingNotification(true);
      try {
        await saveSellerNotificationPreferenceAction({ telegramNotificationId: null });
        setTelegramNotificationsEnabled(false);
        setTelegramId("");
        setTelegramInputVal("");
        setIsEditingTelegramId(false);
        showToast("NotificaÃ§Ãµes de vendas no Telegram desativadas.");
        router.refresh();
      } catch (err: any) {
        setNotificationError(err?.message || "Erro ao desativar notificaÃ§Ãµes.");
      } finally {
        setSavingNotification(false);
      }
    } else {
      // Toggling on: if we already have an ID, save it; otherwise open the input
      if (telegramId && telegramId.trim()) {
        setSavingNotification(true);
        try {
          await saveSellerNotificationPreferenceAction({ telegramNotificationId: telegramId });
          setTelegramNotificationsEnabled(true);
          showToast("NotificaÃ§Ãµes de vendas no Telegram ativadas.");
          router.refresh();
        } catch (err: any) {
          setNotificationError(err?.message || "Erro ao ativar notificaÃ§Ãµes.");
        } finally {
          setSavingNotification(false);
        }
      } else {
        setIsEditingTelegramId(true);
      }
    }
  };

  const handleSaveTelegramId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = telegramInputVal.trim();
    if (!cleanId) {
      setNotificationError("Informe o seu Telegram ID (somente nÃºmeros).");
      return;
    }

    if (!/^-?\d+$/.test(cleanId)) {
      setNotificationError("O Telegram ID deve conter apenas nÃºmeros (ex: 123456789).");
      return;
    }

    setSavingNotification(true);
    setNotificationError(null);

    try {
      const res = await saveSellerNotificationPreferenceAction({ telegramNotificationId: cleanId });
      setTelegramId(res.telegramNotificationId || cleanId);
      setTelegramNotificationsEnabled(true);
      setIsEditingTelegramId(false);
      showToast("Telegram ID salvo e notificaÃ§Ãµes ativadas com sucesso!");
      router.refresh();
    } catch (err: any) {
      setNotificationError(err?.message || "Erro ao salvar Telegram ID.");
    } finally {
      setSavingNotification(false);
    }
  };

  const handleToggleBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Seu navegador nÃ£o suporta notificaÃ§Ãµes de Ã¡rea de trabalho.");
      return;
    }

    if (browserNotificationsEnabled) {
      setBrowserNotificationsEnabled(false);
      localStorage.setItem("webgran_browser_notifications", "false");
      showToast("NotificaÃ§Ãµes do navegador desativadas.");
    } else {
      if (Notification.permission === "granted") {
        setBrowserNotificationsEnabled(true);
        localStorage.setItem("webgran_browser_notifications", "true");
        showToast("NotificaÃ§Ãµes do navegador ativadas.");
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        setBrowserPermission(permission);
        if (permission === "granted") {
          setBrowserNotificationsEnabled(true);
          localStorage.setItem("webgran_browser_notifications", "true");
          showToast("NotificaÃ§Ãµes do navegador ativadas com sucesso!");
        } else {
          setBrowserNotificationsEnabled(false);
          localStorage.setItem("webgran_browser_notifications", "false");
        }
      } else {
        alert("As notificaÃ§Ãµes estÃ£o bloqueadas nas configuraÃ§Ãµes do seu navegador. Por favor, libere a permissÃ£o para ativÃ¡-las.");
      }
    }
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
          Gerencie as suas informaÃ§Ãµes de vendedor, seguranÃ§a e preferÃªncias na plataforma WebGran.
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
      {/* ÃREA 1: PERFIL DO VENDEDOR & DESTAQUE DE TAXA POR TRANSAÃ‡ÃƒO */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Principal: Perfil do Vendedor (2 Colunas no Desktop) */}
        <div className="lg:col-span-2 bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <div className="border-b border-white/5 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-red-500" />
                  InformaÃ§Ãµes da Conta
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dados de identificaÃ§Ã£o do vendedor cadastrado na plataforma.
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
                    Formatos aceitos: JPG, PNG ou WEBP. Tamanho mÃ¡ximo: 10MB.
                  </p>

                  {avatarPreview && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Sparkles className="w-3 h-3" />
                      PrÃ©via carregada. Clique em "Salvar alteraÃ§Ãµes" para confirmar.
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
                    O e-mail Ã© utilizado para login no sistema e nÃ£o pode ser alterado diretamente.
                  </p>
                </div>
              </div>

              {/* Metadata Info Chips: Membro desde & Ãšltimo acesso */}
              <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#18181C] border border-white/5">
                  <Calendar className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Membro desde:</span>
                    <span className="text-white font-semibold">
                      {formatDateRecife(sellerProfile.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#18181C] border border-white/5">
                  <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-zinc-400 block text-[11px]">Ãšltimo acesso:</span>
                    <span className="text-zinc-400 font-medium italic">
                      NÃ£o registrado
                    </span>
                  </div>
                  <div title="O registro de histÃ³rico de logins nÃ£o estÃ¡ ativado no banco de dados.">
                    <Info className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar alteraÃ§Ãµes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Card de Destaque: Taxa por TransaÃ§Ã£o (1 Coluna no Desktop) */}
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
                Taxa por transaÃ§Ã£o
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
                  Taxa temporariamente indisponÃ­vel no servidor.
                </div>
              )}

              <p className="text-xs text-emerald-400/90 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Taxa aplicada em cada transaÃ§Ã£o aprovada
              </p>

              <p className="text-xs text-zinc-400 leading-relaxed pt-2">
                VocÃª nÃ£o paga taxa de adesÃ£o ou assinatura mensal pelo uso do painel e bots. A taxa Ã© retida automaticamente no split Pix exclusivamente em pedidos pagos com sucesso.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-2 text-[11px] text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Custos fixos mensais:</span>
              <span className="font-bold text-emerald-400">R$ 0,00</span>
            </div>
            <div className="flex items-center justify-between">
              <span>RetenÃ§Ã£o no split Pix:</span>
              <span className="font-semibold text-zinc-200">AutomÃ¡tica</span>
            </div>
            <div className="flex items-center justify-between">
              <span>TransaÃ§Ãµes nÃ£o concluÃ­das:</span>
              <span className="font-semibold text-zinc-200">Isentas de taxa</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ÃREA 2: SEGURANÃ‡A, PREFERÃŠNCIAS & PREMIAÃ‡Ã•ES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: SeguranÃ§a (Apenas Trocar Senha) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
              <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">SeguranÃ§a</h3>
                <p className="text-[11px] text-zinc-400">Credenciais de acesso Ã  conta</p>
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

        {/* Card 2: PreferÃªncias (Apenas NotificaÃ§Ãµes) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
              <Bell className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">PreferÃªncias</h3>
                <p className="text-[11px] text-zinc-400">Canais e alertas de notificaÃ§Ã£o</p>
              </div>
            </div>

            {notificationError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{notificationError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* NotificaÃ§Ãµes de Vendas no Telegram */}
              <div className="p-3.5 rounded-xl bg-[#18181C] border border-white/5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block">
                      Alertas no Telegram
                    </span>
                    <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                      Avisos de vendas confirmadas
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleTelegramNotifications}
                    disabled={savingNotification}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      telegramNotificationsEnabled ? "bg-red-600" : "bg-zinc-700"
                    } ${savingNotification ? "opacity-50 cursor-not-allowed" : ""}`}
                    role="switch"
                    aria-checked={telegramNotificationsEnabled}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        telegramNotificationsEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Telegram ID Status / Edit */}
                {telegramNotificationsEnabled && (
                  <div className="pt-2 border-t border-white/5">
                    {isEditingTelegramId ? (
                      <form onSubmit={handleSaveTelegramId} className="space-y-2 mt-1">
                        <input
                          type="text"
                          value={telegramInputVal}
                          onChange={(e) => setTelegramInputVal(e.target.value)}
                          placeholder="Ex: 123456789"
                          className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingTelegramId(false);
                              setTelegramInputVal(telegramId);
                            }}
                            className="px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingNotification}
                            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold flex items-center gap-1"
                          >
                            {savingNotification ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span>Salvar</span>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-zinc-300">
                          ID: {telegramId || "NÃ£o configurado"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTelegramInputVal(telegramId);
                            setIsEditingTelegramId(true);
                          }}
                          className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                        >
                          Alterar ID
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* NotificaÃ§Ãµes no Navegador (Web Push / Alertas) */}
              <div className="p-3.5 rounded-xl bg-[#18181C] border border-white/5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block">
                      Alertas no Navegador
                    </span>
                    <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                      Sons e avisos em tempo real
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleBrowserNotifications}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      browserNotificationsEnabled ? "bg-red-600" : "bg-zinc-700"
                    }`}
                    role="switch"
                    aria-checked={browserNotificationsEnabled}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        browserNotificationsEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="text-[11px] text-zinc-400 pt-1">
                  Status: {browserPermission === "granted" ? (
                    <span className="text-emerald-400 font-semibold">Autorizado no navegador</span>
                  ) : browserPermission === "denied" ? (
                    <span className="text-rose-400 font-semibold">Bloqueado no navegador</span>
                  ) : (
                    <span>PadrÃ£o do navegador</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 pt-2">
            PreferÃªncias salvas de forma persistente na sua conta.
          </div>
        </div>

        {/* Card 3: PremiaÃ§Ãµes (Em Breve) */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-5 relative">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="text-sm font-bold text-white">PremiaÃ§Ãµes</h3>
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
                  Conquiste placas e benefÃ­cios exclusivos conforme o faturamento da sua loja cresce no WebGran.
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
                  Vantagens comerciais, suporte prioritÃ¡rio e recursos exclusivos em desenvolvimento.
                </p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 pt-2 border-t border-white/5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>Recurso previsto para as prÃ³ximas atualizaÃ§Ãµes da plataforma.</span>
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
                âœ•
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
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
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
                    placeholder="MÃ­nimo de 6 caracteres"
                    className="w-full bg-[#18181C] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
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
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
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
