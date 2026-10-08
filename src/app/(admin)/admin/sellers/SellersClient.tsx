"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, 
  Building2, 
  Search, 
  Calendar, 
  ShieldCheck, 
  Mail, 
  Plus, 
  MoreVertical, 
  UserPen, 
  Store, 
  CreditCard, 
  Unlock, 
  PauseCircle, 
  PlayCircle, 
  Key, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  ExternalLink,
  Sliders
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface SellerItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  status: string; // 'active' | 'pending' | 'suspended' | 'inactive'
  store: {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
  } | null;
  subscription: {
    id: string;
    planName: string;
    price: number;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    isExpired: boolean;
  } | null;
  latestInvoice: {
    id: string;
    amount: number;
    status: string;
    provider: string;
    externalId: string | null;
    paidAt: string | null;
    dueDate: string | null;
  } | null;
}

export default function SellersClient({ initialSellers }: { initialSellers: SellerItem[] }) {
  const router = useRouter();
  const [sellers, setSellers] = useState<SellerItem[]>(initialSellers);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const [activeMenuSellerId, setActiveMenuSellerId] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isEditStoreOpen, setIsEditStoreOpen] = useState(false);
  const [isManageSubOpen, setIsManageSubOpen] = useState(false);
  const [isReleaseSubOpen, setIsReleaseSubOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isConfirmSuspendOpen, setIsConfirmSuspendOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Selected Seller for action
  const [selectedSeller, setSelectedSeller] = useState<SellerItem | null>(null);

  // Loading & Message state
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    storeName: "",
    storeSlug: "",
    status: "active",
    daysActive: "30",
  });

  const [editUserForm, setEditUserForm] = useState({ name: "", email: "" });
  const [editStoreForm, setEditStoreForm] = useState({ name: "", slug: "", status: "active" });
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [releaseDaysInput, setReleaseDaysInput] = useState("30");

  const fetchSellers = async () => {
    try {
      const res = await fetch("/api/admin/sellers");
      if (res.ok) {
        const data = await res.json();
        if (data.sellers) {
          setSellers(data.sellers);
        }
      }
    } catch (e) {
      console.error("Error refreshing sellers:", e);
    }
  };

  const handleRefresh = async () => {
    await fetchSellers();
    router.refresh();
  };

  // Filter sellers
  const filteredSellers = sellers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.store && s.store.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.store && s.store.slug.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && s.status === "active") ||
      (statusFilter === "pending" && s.status === "pending") ||
      (statusFilter === "suspended" && s.status === "suspended");

    return matchesSearch && matchesStatus;
  });

  // KPI Calculations
  const totalSellers = sellers.length;
  const activeSellersCount = sellers.filter((s) => s.status === "active").length;
  const activeSubsCount = sellers.filter(
    (s) => s.subscription && (s.subscription.status === "ACTIVE" || s.subscription.status === "TRIAL") && !s.subscription.isExpired
  ).length;
  const pendingSubsCount = sellers.filter(
    (s) => s.status === "pending" || (s.subscription && (s.subscription.status === "PAST_DUE" || s.subscription.status === "EXPIRED"))
  ).length;
  const sellersWithStores = sellers.filter((s) => s.store !== null).length;
  const totalStoresOwned = sellersWithStores;

  // Actions Handlers
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao criar vendedor.");
      }
      setFeedbackMsg({ type: "success", text: "Vendedor e loja cadastrados com sucesso!" });
      setIsAddModalOpen(false);
      setAddForm({ name: "", email: "", password: "", storeName: "", storeSlug: "", status: "active", daysActive: "30" });
      await handleRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_user", ...editUserForm }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao atualizar usuário.");
      }
      setFeedbackMsg({ type: "success", text: "Dados do usuário atualizados com sucesso!" });
      setIsEditUserOpen(false);
      await handleRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_store", ...editStoreForm }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao atualizar loja.");
      }
      setFeedbackMsg({ type: "success", text: "Dados da loja atualizados com sucesso!" });
      setIsEditStoreOpen(false);
      await handleRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspend = async () => {
    if (!selectedSeller) return;
    setLoading(true);
    setFeedbackMsg(null);
    const nextAction = selectedSeller.status === "suspended" ? "reactivate" : "suspend";
    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextAction }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao alterar status do vendedor.");
      }
      setFeedbackMsg({
        type: "success",
        text: nextAction === "suspend" ? "Vendedor suspenso com sucesso!" : "Acesso do vendedor reativado!",
      });
      setIsConfirmSuspendOpen(false);
      await handleRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", newPassword: resetPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao redefinir senha.");
      }
      setFeedbackMsg({ type: "success", text: "Nova senha redefinida com sucesso!" });
      setIsResetPasswordOpen(false);
      setResetPasswordInput("");
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release_subscription", daysToExtend: Number(releaseDaysInput) || 30 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao liberar mensalidade.");
      }
      setFeedbackMsg({ type: "success", text: data.message || "Mensalidade liberada com sucesso!" });
      setIsReleaseSubOpen(false);
      await handleRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeller = async () => {
    if (!selectedSeller) return;
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao excluir vendedor.");
      }
      setFeedbackMsg({ type: "success", text: data.message });
      setIsConfirmDeleteOpen(false);
      await handleRefresh();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8 pb-10 fade-in">
      {/* HEADER & METRICS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141416] p-4 sm:p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">Vendedores Globais</h1>
            <span className="px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              Painel Super Admin
            </span>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Gestão completa, auditoria, mensalidades e permissões dos lojistas da plataforma
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-9 sm:h-10 px-3.5 sm:px-4 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Vendedor</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex-1 sm:flex-initial bg-[#18181B] border-[#27272A] hover:bg-white/5 text-gray-300 hover:text-white rounded-xl text-xs h-9 sm:h-10 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Total Vendedores</span>
            <span className="text-2xl font-black text-white mt-1 block">{totalSellers}</span>
          </div>
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Vendedores Ativos</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{activeSellersCount}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Mensalidades Ativas</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{activeSubsCount}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Mensal. Pendentes</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{pendingSubsCount}</span>
          </div>
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Com Loja</span>
            <span className="text-2xl font-black text-purple-400 mt-1 block">{sellersWithStores}</span>
          </div>
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Lojas Criadas</span>
            <span className="text-2xl font-black text-purple-400 mt-1 block">{totalStoresOwned}</span>
          </div>
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Store className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-[#141416] p-4 rounded-2xl border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, loja ou slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#18181B] p-1 rounded-xl border border-[#27272A] text-xs">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              statusFilter === "all" ? "bg-blue-600 text-white font-semibold shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Todos ({sellers.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              statusFilter === "active" ? "bg-emerald-600 text-white font-semibold shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Ativos ({sellers.filter((s) => s.status === "active").length})
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              statusFilter === "pending" ? "bg-amber-600 text-white font-semibold shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Pendentes ({sellers.filter((s) => s.status === "pending").length})
          </button>
          <button
            onClick={() => setStatusFilter("suspended")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              statusFilter === "suspended" ? "bg-red-600 text-white font-semibold shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Suspensos ({sellers.filter((s) => s.status === "suspended").length})
          </button>
        </div>
      </div>

      {/* SELLERS TABLE */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Lista de Vendedores</h2>
          <span className="text-xs text-gray-400">{filteredSellers.length} vendedor(es) exibido(s)</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-gray-400 text-xs font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Vendedor</th>
                <th className="pb-3 px-3">E-mail</th>
                <th className="pb-3 px-3">Loja Vinculada</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Mensalidade</th>
                <th className="pb-3 px-3">Registro</th>
                <th className="pb-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/50 text-xs">
              {filteredSellers.map((seller) => {
                const isSubActive =
                  seller.subscription &&
                  (seller.subscription.status === "ACTIVE" || seller.subscription.status === "TRIAL") &&
                  !seller.subscription.isExpired;

                return (
                  <tr key={seller.id} className="hover:bg-[#18181B]/60 transition-colors">
                    {/* Vendedor */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
                          {seller.name[0]?.toUpperCase() || "V"}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{seller.name}</p>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Lojista</span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-3 text-gray-300 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="truncate max-w-[180px]">{seller.email}</span>
                      </div>
                    </td>

                    {/* Loja */}
                    <td className="py-3.5 px-3">
                      {seller.store ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            <Building2 className="w-3 h-3" />
                            {seller.store.name}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5 font-mono">
                            /{seller.store.slug}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">Sem loja criada</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      {seller.status === "active" && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          🟢 Ativo
                        </span>
                      )}
                      {seller.status === "pending" && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold inline-flex items-center gap-1">
                          🟡 Mensalidade pendente
                        </span>
                      )}
                      {seller.status === "suspended" && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold inline-flex items-center gap-1">
                          🔴 Suspenso
                        </span>
                      )}
                      {seller.status === "inactive" && (
                        <span className="px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[11px] font-bold inline-flex items-center gap-1">
                          ⚪ Inativo
                        </span>
                      )}
                    </td>

                    {/* Mensalidade */}
                    <td className="py-3.5 px-3 text-gray-300">
                      {seller.subscription ? (
                        <div>
                          {isSubActive ? (
                            <span className="text-emerald-400 font-semibold block text-[11px]">
                              Ativa {seller.subscription.currentPeriodEnd ? `(vence ${formatDate(seller.subscription.currentPeriodEnd)})` : ''}
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold block text-[11px]">
                              Pendente {seller.subscription.currentPeriodEnd ? `(venceu ${formatDate(seller.subscription.currentPeriodEnd)})` : ''}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500">
                            {seller.subscription.planName} (R$ {seller.subscription.price.toFixed(2)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">Sem assinatura</span>
                      )}
                    </td>

                    {/* Registro */}
                    <td className="py-3.5 px-3 text-gray-400 font-medium">
                      <div className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span>{formatDate(seller.createdAt)}</span>
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer inline-flex items-center justify-center transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-[#18181C] border border-[#27272A] shadow-2xl p-1 text-xs text-gray-300">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setEditUserForm({ name: seller.name, email: seller.email });
                              setIsEditUserOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-gray-200 focus:bg-white/5 focus:text-white"
                          >
                            <UserPen className="w-3.5 h-3.5 text-blue-400" />
                            Editar usuário
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setEditStoreForm({
                                name: seller.store?.name || "",
                                slug: seller.store?.slug || "",
                                status: seller.store?.status || "active",
                              });
                              setIsEditStoreOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-gray-200 focus:bg-white/5 focus:text-white"
                          >
                            <Store className="w-3.5 h-3.5 text-purple-400" />
                            Gerenciar loja
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setIsManageSubOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-gray-200 focus:bg-white/5 focus:text-white"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                            Gerenciar mensalidade
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setIsReleaseSubOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-emerald-400 font-semibold focus:bg-white/5 focus:text-emerald-300"
                          >
                            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                            Liberar mensalidade
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              router.push(`/admin/sellers/${seller.id}/entitlements`);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-red-400 font-semibold focus:bg-white/5 focus:text-red-300"
                          >
                            <Sliders className="w-3.5 h-3.5 text-red-400" />
                            Recursos & Overrides
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="bg-[#27272A]/60 my-1" />

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setIsConfirmSuspendOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-amber-400 font-semibold focus:bg-white/5 focus:text-amber-300"
                          >
                            {seller.status === "suspended" ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                                ▶️ Reativar acesso
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                                ⏸️ Suspender acesso
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setResetPasswordInput("");
                              setIsResetPasswordOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-gray-200 focus:bg-white/5 focus:text-white"
                          >
                            <Key className="w-3.5 h-3.5 text-blue-400" />
                            Redefinir senha
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="bg-[#27272A]/60 my-1" />

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSeller(seller);
                              setIsConfirmDeleteOpen(true);
                            }}
                            className="px-3 py-2 hover:bg-red-500/10 cursor-pointer flex items-center gap-2 text-red-400 font-bold focus:bg-red-500/20 focus:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            Excluir vendedor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}

              {filteredSellers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 text-xs">
                    Nenhum vendedor encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL 1: ADICIONAR VENDEDOR */}
      {/* ==================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Cadastrar Novo Vendedor
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSeller} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">Nome do Vendedor</label>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">E-mail</label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="joao@exemplo.com"
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Senha Inicial</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#27272A]">
                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">Nome da Loja</label>
                  <input
                    type="text"
                    required
                    value={addForm.storeName}
                    onChange={(e) => {
                      const name = e.target.value;
                      const autoSlug = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
                      setAddForm({ ...addForm, storeName: name, storeSlug: addForm.storeSlug ? addForm.storeSlug : autoSlug });
                    }}
                    placeholder="Ex: Minha Loja VIP"
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">Slug da Loja</label>
                  <input
                    type="text"
                    required
                    value={addForm.storeSlug}
                    onChange={(e) => setAddForm({ ...addForm, storeSlug: e.target.value })}
                    placeholder="minha-loja-vip"
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">Status Inicial</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">🟢 Ativo</option>
                    <option value="suspended">🔴 Suspenso</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">Acesso Inicial (Dias)</label>
                  <select
                    value={addForm.daysActive}
                    onChange={(e) => setAddForm({ ...addForm, daysActive: e.target.value })}
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="3">3 Dias (Trial)</option>
                    <option value="30">30 Dias (Mensal)</option>
                    <option value="90">90 Dias (Trimestral)</option>
                    <option value="365">365 Dias (Anual)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Criando..." : "Criar Vendedor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: EDITAR USUÁRIO */}
      {/* ==================================================== */}
      {isEditUserOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPen className="w-5 h-5 text-blue-400" />
                Editar Dados do Vendedor
              </h3>
              <button onClick={() => setIsEditUserOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">E-mail</label>
                <input
                  type="email"
                  required
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditUserOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: GERENCIAR LOJA */}
      {/* ==================================================== */}
      {isEditStoreOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Gerenciar Loja
              </h3>
              <button onClick={() => setIsEditStoreOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStore} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Nome da Loja</label>
                <input
                  type="text"
                  required
                  value={editStoreForm.name}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, name: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Slug da Loja</label>
                <input
                  type="text"
                  required
                  value={editStoreForm.slug}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, slug: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Status da Loja</label>
                <select
                  value={editStoreForm.status}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, status: e.target.value })}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="active">🟢 Ativa</option>
                  <option value="suspended">🔴 Suspensa</option>
                  <option value="inactive">⚪ Inativa</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditStoreOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: GERENCIAR MENSALIDADE */}
      {/* ==================================================== */}
      {isManageSubOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Gerenciar Mensalidade — {selectedSeller.name}
              </h3>
              <button onClick={() => setIsManageSubOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-[#18181B] p-4 rounded-xl border border-[#27272A]">
                <div>
                  <span className="text-gray-400 block text-[11px]">Plano Contratado</span>
                  <span className="text-white font-bold text-sm block">
                    {selectedSeller.subscription?.planName || "WebGran SaaS"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Valor</span>
                  <span className="text-emerald-400 font-bold text-sm block">
                    R$ {(selectedSeller.subscription?.price || 89.90).toFixed(2)} / mês
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Status Assinatura</span>
                  <span className="font-bold block mt-0.5">
                    {selectedSeller.subscription?.status === "ACTIVE" ? (
                      <span className="text-emerald-400">🟢 ATIVA</span>
                    ) : selectedSeller.subscription?.status === "TRIAL" ? (
                      <span className="text-blue-400">🔵 TRIAL</span>
                    ) : (
                      <span className="text-amber-400">🟡 {selectedSeller.subscription?.status || "PENDENTE"}</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Próximo Vencimento</span>
                  <span className="text-white font-mono font-bold block mt-0.5">
                    {formatDate(selectedSeller.subscription?.currentPeriodEnd || null)}
                  </span>
                </div>
              </div>

              {selectedSeller.latestInvoice && (
                <div className="bg-[#18181B] p-4 rounded-xl border border-[#27272A] space-y-2">
                  <h4 className="font-bold text-gray-300 flex items-center justify-between">
                    <span>Última Cobrança</span>
                    <span className="text-[10px] text-gray-400 font-mono">ID: {selectedSeller.latestInvoice.id.slice(0, 8)}...</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500 block">Valor</span>
                      <span className="text-white font-semibold">R$ {selectedSeller.latestInvoice.amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Status PIX</span>
                      <span className="text-amber-400 font-semibold">{selectedSeller.latestInvoice.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Pago em</span>
                      <span className="text-gray-300">{formatDate(selectedSeller.latestInvoice.paidAt)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setIsManageSubOpen(false);
                    setIsReleaseSubOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-10 px-4 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  Liberar Acesso Manualmente
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 5: LIBERAR MENSALIDADE */}
      {/* ==================================================== */}
      {isReleaseSubOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-400" />
                Liberar Mensalidade Manualmente
              </h3>
              <button onClick={() => setIsReleaseSubOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReleaseSubscription} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 leading-relaxed">
                Você está liberando manualmente o acesso para o vendedor <strong>{selectedSeller.name}</strong>.
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Período da Liberação</label>
                <select
                  value={releaseDaysInput}
                  onChange={(e) => setReleaseDaysInput(e.target.value)}
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-xs font-semibold"
                >
                  <option value="30">30 Dias de Acesso (1 Mês)</option>
                  <option value="60">60 Dias de Acesso (2 Meses)</option>
                  <option value="90">90 Dias de Acesso (3 Meses)</option>
                  <option value="180">180 Dias de Acesso (6 Meses)</option>
                  <option value="365">365 Dias de Acesso (1 Ano)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReleaseSubOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Liberando..." : "Confirmar Liberação"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 6: REDEFINIR SENHA */}
      {/* ==================================================== */}
      {isResetPasswordOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-400" />
                Redefinir Senha do Vendedor
              </h3>
              <button onClick={() => setIsResetPasswordOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <p className="text-gray-400 leading-relaxed">
                Digite a nova senha para o vendedor <strong>{selectedSeller.name}</strong> ({selectedSeller.email}).
              </p>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Nova Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !resetPasswordInput}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Redefinindo..." : "Redefinir Senha"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 7: CONFIRMAR SUSPENDER / REATIVAR */}
      {/* ==================================================== */}
      {isConfirmSuspendOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#27272A] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {selectedSeller.status === "suspended" ? (
                  <>
                    <PlayCircle className="w-5 h-5 text-emerald-400" />
                    Reativar Acesso do Vendedor
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-5 h-5 text-amber-400" />
                    Suspender Acesso do Vendedor
                  </>
                )}
              </h3>
              <button onClick={() => setIsConfirmSuspendOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-gray-300 leading-relaxed">
                {selectedSeller.status === "suspended" ? (
                  <>
                    Deseja reativar o acesso do vendedor <strong>{selectedSeller.name}</strong>? A loja e as vendas serão reativadas imediatamente.
                  </>
                ) : (
                  <>
                    Tem certeza de que deseja suspender o acesso do vendedor <strong>{selectedSeller.name}</strong>? O vendedor e seus clientes não conseguirão realizar novas compras até que o acesso seja liberado. Nenhum dado ou pedido será excluído.
                  </>
                )}
              </p>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmSuspendOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleToggleSuspend}
                  disabled={loading}
                  className={`font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedSeller.status === "suspended"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-amber-600 hover:bg-amber-500 text-white"
                  }`}
                >
                  {loading ? "Processando..." : selectedSeller.status === "suspended" ? "Reativar Acesso" : "Suspender Acesso"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 8: CONFIRMAR EXCLUSÃO */}
      {/* ==================================================== */}
      {isConfirmDeleteOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Excluir Vendedor?
              </h3>
              <button onClick={() => setIsConfirmDeleteOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 leading-relaxed space-y-1">
                <p className="font-bold">⚠️ Atenção: Ação de Alto Impacto!</p>
                <p>
                  Esta ação afetará a conta do vendedor <strong>{selectedSeller.name}</strong> e sua loja vinculada.
                </p>
                <p className="text-[11px] text-gray-400 pt-1">
                  Se a loja possuir pedidos pagos ou histórico financeiro, o sistema realizará uma desativação segura (Soft Delete) para manter intactos todos os dados de auditoria e financeiro histórico.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="bg-[#18181B] border-[#27272A] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleDeleteSeller}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-red-600/20"
                >
                  {loading ? "Excluindo..." : "Confirmar Exclusão"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
