"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Unlink, 
  Camera, 
  Trash2, 
  Loader2, 
  Save, 
  Check, 
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateSellerProfileAction } from "./actions";

interface ConnectionInfo {
  id: string;
  status: string;
  providerEmail: string | null;
  providerUserId: string | null;
  updatedAt: string | null;
}

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Props {
  storeName: string;
  sellerProfile: SellerProfile;
  connection: ConnectionInfo | null;
}

export default function SettingsClient({ storeName, sellerProfile, connection }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"perfil" | "recebimento">("perfil");

  // Profile Form States
  const [name, setName] = useState(sellerProfile.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(sellerProfile.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment Disconnect State
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const isConnected = connection?.status === "active";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Por favor, selecione uma imagem no formato JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("A imagem selecionada excede o tamanho máximo de 5MB.");
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("O nome do vendedor é obrigatório.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await updateSellerProfileAction({
        name: name.trim(),
        avatarUrl: avatarUrl
      });
      showToast("Perfil atualizado com sucesso.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/payments/mercadopago/connect";
  };

  const handleDisconnect = async () => {
    if (!confirm("Deseja realmente desconectar sua conta do Mercado Pago? Suas vendas no Telegram serão pausadas até que reconecte.")) {
      return;
    }

    setLoadingDisconnect(true);
    try {
      const res = await fetch("/api/payments/mercadopago/disconnect", { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Falha ao desconectar conta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de conexão ao tentar desconectar.");
    } finally {
      setLoadingDisconnect(false);
    }
  };

  const firstLetter = (name || sellerProfile.email || "V").charAt(0).toUpperCase();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <User className="w-7 h-7 text-red-500" />
          Perfil do vendedor
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Gerencie as informações da sua conta.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("perfil")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "perfil"
              ? "border-red-500 text-white bg-red-500/10 rounded-t-xl"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <User className="w-4 h-4" />
          Perfil do Vendedor
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recebimento")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "recebimento"
              ? "border-red-500 text-white bg-red-500/10 rounded-t-xl"
              : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Forma de Recebimento
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab: Profile */}
      {activeTab === "perfil" && (
        <form onSubmit={handleSaveProfile} className="bg-[#0F0F12] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-[#16161C] flex items-center justify-center shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Foto do Vendedor" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white uppercase">{firstLetter}</span>
                )}
              </div>

              <label 
                htmlFor="avatar-upload" 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer text-white text-[11px] font-semibold gap-1"
                title="Alterar foto"
              >
                <Camera className="w-5 h-5 text-white" />
                <span>Alterar</span>
              </label>

              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleAvatarChange} 
                className="hidden" 
              />
            </div>

            <div className="space-y-2 text-center sm:text-left min-w-0">
              <h3 className="text-base font-bold text-white">Foto de perfil</h3>
              <p className="text-xs text-zinc-400">
                Formatos aceitos: JPG, PNG ou WEBP. Tamanho máximo: 5MB.
              </p>
              <div className="flex items-center gap-3 pt-1 justify-center sm:justify-start">
                <label
                  htmlFor="avatar-upload"
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer transition-all border border-white/10"
                >
                  Alterar foto
                </label>
                {avatarUrl && (
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

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Nome do vendedor
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo ou apelido"
                className="w-full bg-[#18181C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                E-mail da conta
              </label>
              <input
                type="email"
                value={sellerProfile.email}
                disabled
                className="w-full bg-[#141418] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed select-none"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                O e-mail é utilizado para login no sistema e não pode ser alterado diretamente.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
            >
              {saving ? (
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
      )}

      {/* Tab: Recebimento (Mercado Pago Integration) */}
      {activeTab === "recebimento" && (
        <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">Integração Mercado Pago</h3>
                {isConnected ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Pendente
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Conecte sua conta do Mercado Pago para receber pagamentos via PIX e Cartão de Crédito.
              </p>
            </div>

            {isConnected ? (
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={loadingDisconnect}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 text-xs gap-2 shrink-0 cursor-pointer"
              >
                <Unlink className="w-4 h-4" />
                {loadingDisconnect ? "Desconectando..." : "Desconectar Conta"}
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-2 shrink-0 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Conectar Mercado Pago
              </Button>
            )}
          </div>

          {isConnected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#16161C] p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider">Conta Conectada</span>
                <p className="text-sm font-semibold text-white">{connection?.providerEmail || "Email não informado"}</p>
              </div>
              <div className="bg-[#16161C] p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider">ID Mercado Pago</span>
                <p className="text-sm font-semibold text-white">{connection?.providerUserId || "N/A"}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
