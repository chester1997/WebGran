"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/analytics/timezone-utils";
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
  AlertTriangle,
  Clock,
  RefreshCw,
  Sliders,
  Percent,
  Coins,
  History,
  Bot,
  ArrowRight,
  TrendingUp,
  Tag,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { SellerItem, SellerStoreItem, SellerStoreBot } from "@/lib/commission/seller-admin-query";

export type { SellerItem };

export default function SellersClient({ initialSellers }: { initialSellers: SellerItem[] }) {
  const router = useRouter();
  const [sellers, setSellers] = useState<SellerItem[]>(initialSellers);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const [feeFilter, setFeeFilter] = useState<"all" | "DEFAULT" | "CUSTOM" | "EXEMPTION">("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isEditStoreOpen, setIsEditStoreOpen] = useState(false);
  const [isManageSubOpen, setIsManageSubOpen] = useState(false);
  const [isReleaseSubOpen, setIsReleaseSubOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isConfirmSuspendOpen, setIsConfirmSuspendOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Commission Modal State
  const [isManageCommissionOpen, setIsManageCommissionOpen] = useState(false);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionHistoryLoading, setCommissionHistoryLoading] = useState(false);
  const [commissionFeedback, setCommissionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [commissionConcurrencyAlert, setCommissionConcurrencyAlert] = useState<string | null>(null);
  const [commissionAuditHistory, setCommissionAuditHistory] = useState<any[]>([]);
  const [activeCommissionTab, setActiveCommissionTab] = useState<"config" | "history">("config");

  // Commission Form State
  const [commissionMode, setCommissionMode] = useState<"DEFAULT" | "CUSTOM" | "EXEMPTION">("DEFAULT");
  const [customFeeInput, setCustomFeeInput] = useState<number>(0.5);
  const [exemptionStartInput, setExemptionStartInput] = useState<string>("");
  const [exemptionEndInput, setExemptionEndInput] = useState<string>("");
  const [exemptionReasonInput, setExemptionReasonInput] = useState<string>("");
  const [changeReasonInput, setChangeReasonInput] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [currentEffectiveFeePreview, setCurrentEffectiveFeePreview] = useState<string>("R$ 0,50");

  // Selected Seller for action
  const [selectedSeller, setSelectedSeller] = useState<SellerItem | null>(null);

  // General Loading & Message state
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states for existing actions
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

  const handleCloseCommissionModal = () => {
    setIsManageCommissionOpen(false);
    setCommissionFeedback(null);
    setCommissionConcurrencyAlert(null);
    setChangeReasonInput("");
  };

  // Open Manage Commission Modal
  const handleOpenCommissionModal = async (seller: SellerItem) => {
    setSelectedSeller(seller);
    setIsManageCommissionOpen(true);
    setActiveCommissionTab("config");
    setCommissionFeedback(null);
    setCommissionConcurrencyAlert(null);
    setChangeReasonInput("");

    // Initial values from current seller state
    const source = seller.commission?.source || "PLATFORM_DEFAULT";
    const customFee = seller.commission?.customFeeCents !== null && seller.commission?.customFeeCents !== undefined
      ? seller.commission.customFeeCents / 100
      : 0.5;
    
    setCustomFeeInput(customFee);
    setCommissionMode(source === "EXEMPTION" ? "EXEMPTION" : source === "CUSTOM" ? "CUSTOM" : "DEFAULT");
    setCurrentVersion(seller.commission?.version ?? 0);
    setCurrentEffectiveFeePreview(seller.commission?.formattedFee || "R$ 0,50");

    if (seller.commission?.exemption) {
      const start = seller.commission.exemption.start ? new Date(seller.commission.exemption.start) : null;
      const end = seller.commission.exemption.end ? new Date(seller.commission.exemption.end) : null;
      setExemptionStartInput(start ? start.toISOString().slice(0, 16) : "");
      setExemptionEndInput(end ? end.toISOString().slice(0, 16) : "");
      setExemptionReasonInput(seller.commission.exemption.reason || "");
    } else {
      setExemptionStartInput("");
      setExemptionEndInput("");
      setExemptionReasonInput("");
    }

    // Fetch fresh details & audit history from API
    setCommissionHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/sellers/${seller.id}/commission`);
      if (res.ok) {
        const payload = await res.json();
        if (payload.success && payload.data) {
          const { effectiveFee, setting, history, version } = payload.data;
          setCommissionAuditHistory(history || []);
          const resolvedVersion = setting?.version ?? version ?? 0;
          setCurrentVersion(resolvedVersion);
          if (setting) {
            if (setting.customFeeCents !== null && setting.customFeeCents !== undefined) {
              setCustomFeeInput(setting.customFeeCents / 100);
            }
            if (setting.exemptionActive) {
              setCommissionMode("EXEMPTION");
              if (setting.exemptionStart) {
                setExemptionStartInput(new Date(setting.exemptionStart).toISOString().slice(0, 16));
              }
              if (setting.exemptionEnd) {
                setExemptionEndInput(new Date(setting.exemptionEnd).toISOString().slice(0, 16));
              }
              setExemptionReasonInput(setting.exemptionReason || "");
            } else if (setting.customFeeCents !== null) {
              setCommissionMode("CUSTOM");
            } else {
              setCommissionMode("DEFAULT");
            }
          } else {
            setCommissionMode("DEFAULT");
            setCustomFeeInput(0.5);
            setExemptionStartInput("");
            setExemptionEndInput("");
            setExemptionReasonInput("");
          }
          if (effectiveFee) {
            setCurrentEffectiveFeePreview(effectiveFee.formattedFee);
          }
        }
      }
    } catch (err) {
      console.warn("Could not load fresh commission details:", err);
    } finally {
      setCommissionHistoryLoading(false);
    }
  };

  // Submit commission updates with optimistic concurrency control
  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;

    if (!changeReasonInput.trim()) {
      setCommissionFeedback({
        type: "error",
        text: "A justificativa da alteração é obrigatória para o registro de auditoria.",
      });
      return;
    }

    if (commissionMode === "CUSTOM") {
      if (isNaN(customFeeInput) || customFeeInput < 0 || customFeeInput > 0.5) {
        setCommissionFeedback({
          type: "error",
          text: "A taxa personalizada deve estar entre R$ 0,00 e R$ 0,50 por venda.",
        });
        return;
      }
    }

    if (commissionMode === "EXEMPTION") {
      if (!exemptionStartInput || !exemptionEndInput) {
        setCommissionFeedback({
          type: "error",
          text: "As datas de início e término da isenção temporária são obrigatórias.",
        });
        return;
      }
      if (new Date(exemptionEndInput) <= new Date(exemptionStartInput)) {
        setCommissionFeedback({
          type: "error",
          text: "A data de término da isenção deve ser posterior à data de início.",
        });
        return;
      }
      if (!exemptionReasonInput.trim()) {
        setCommissionFeedback({
          type: "error",
          text: "A justificativa da isenção temporária é obrigatória.",
        });
        return;
      }
    }

    setCommissionLoading(true);
    setCommissionFeedback(null);
    setCommissionConcurrencyAlert(null);

    const payload: any = {
      mode: commissionMode,
      customFeeCents: commissionMode === "CUSTOM" ? Math.round(customFeeInput * 100) : (commissionMode === "DEFAULT" ? null : Math.round(customFeeInput * 100)),
      exemptionActive: commissionMode === "EXEMPTION",
      exemptionStart: commissionMode === "EXEMPTION" ? exemptionStartInput : null,
      exemptionEnd: commissionMode === "EXEMPTION" ? exemptionEndInput : null,
      exemptionReason: commissionMode === "EXEMPTION" ? exemptionReasonInput.trim() : null,
      expectedVersion: currentVersion,
      reason: changeReasonInput.trim(),
    };

    try {
      const res = await fetch(`/api/admin/sellers/${selectedSeller.id}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 || data.code === "CONCURRENCY_CONFLICT") {
        setCommissionConcurrencyAlert(
          "Outro administrador alterou a taxa deste vendedor concorrentemente. Os dados mais recentes foram recarregados. Por favor, revise os valores e tente novamente."
        );
        // Reload fresh state from server
        const freshRes = await fetch(`/api/admin/sellers/${selectedSeller.id}/commission`);
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          if (freshData.success && freshData.data) {
            const { setting, effectiveFee, history, version } = freshData.data;
            const updatedVersion = setting?.version ?? version ?? 0;
            setCurrentVersion(updatedVersion);
            setCommissionAuditHistory(history || []);
            if (setting) {
              if (setting.customFeeCents !== null && setting.customFeeCents !== undefined) {
                setCustomFeeInput(setting.customFeeCents / 100);
              }
              if (setting.exemptionActive) {
                setCommissionMode("EXEMPTION");
                if (setting.exemptionStart) {
                  setExemptionStartInput(new Date(setting.exemptionStart).toISOString().slice(0, 16));
                }
                if (setting.exemptionEnd) {
                  setExemptionEndInput(new Date(setting.exemptionEnd).toISOString().slice(0, 16));
                }
                setExemptionReasonInput(setting.exemptionReason || "");
              } else if (setting.customFeeCents !== null) {
                setCommissionMode("CUSTOM");
              } else {
                setCommissionMode("DEFAULT");
              }
            } else {
              setCommissionMode("DEFAULT");
              setCustomFeeInput(0.5);
              setExemptionStartInput("");
              setExemptionEndInput("");
              setExemptionReasonInput("");
            }
            if (effectiveFee) {
              setCurrentEffectiveFeePreview(effectiveFee.formattedFee);
            }
          }
        }
        await fetchSellers();
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar configuração de taxa.");
      }

      setCommissionFeedback({
        type: "success",
        text: "Taxa do vendedor atualizada com sucesso no livro de auditoria!",
      });

      if (data.data?.setting) {
        setCurrentVersion(data.data.setting.version);
      } else if (typeof data.data?.version === "number") {
        setCurrentVersion(data.data.version);
      }
      if (data.data?.effectiveFee) {
        setCurrentEffectiveFeePreview(data.data.effectiveFee.formattedFee);
      }

      // Reload audit history
      const histRes = await fetch(`/api/admin/sellers/${selectedSeller.id}/commission`);
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData.data?.history) {
          setCommissionAuditHistory(histData.data.history);
        }
        if (histData.data?.setting) {
          setCurrentVersion(histData.data.setting.version);
        } else if (typeof histData.data?.version === "number") {
          setCurrentVersion(histData.data.version);
        }
      }

      setChangeReasonInput("");
      await fetchSellers();
    } catch (err: any) {
      setCommissionFeedback({ type: "error", text: err.message });
    } finally {
      setCommissionLoading(false);
    }
  };

  // Filter sellers
  const filteredSellers = sellers.filter((s) => {
    const q = searchTerm.toLowerCase().trim();

    // Match seller name and email
    let matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q);

    // Match stores and telegram bots
    if (!matchesSearch && s.stores && s.stores.length > 0) {
      for (const st of s.stores) {
        if (st.name.toLowerCase().includes(q) || st.slug.toLowerCase().includes(q)) {
          matchesSearch = true;
          break;
        }
        if (st.bots && st.bots.length > 0) {
          for (const b of st.bots) {
            if (
              b.username.toLowerCase().includes(q) ||
              (b.displayName && b.displayName.toLowerCase().includes(q))
            ) {
              matchesSearch = true;
              break;
            }
          }
        }
        if (matchesSearch) break;
      }
    }

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && s.status === "active") ||
      (statusFilter === "pending" && s.status === "pending") ||
      (statusFilter === "suspended" && s.status === "suspended");

    const matchesFee =
      feeFilter === "all" ||
      (feeFilter === "DEFAULT" && s.commission?.source === "PLATFORM_DEFAULT") ||
      (feeFilter === "CUSTOM" && s.commission?.source === "CUSTOM") ||
      (feeFilter === "EXEMPTION" && s.commission?.source === "EXEMPTION");

    return matchesSearch && matchesStatus && matchesFee;
  });

  // KPI Calculations
  const totalSellers = sellers.length;
  const activeSellersCount = sellers.filter((s) => s.status === "active").length;
  const standardFeeCount = sellers.filter((s) => s.commission?.source === "PLATFORM_DEFAULT").length;
  const customFeeCount = sellers.filter((s) => s.commission?.source === "CUSTOM").length;
  const exemptionActiveCount = sellers.filter((s) => s.commission?.source === "EXEMPTION").length;

  const totalBotsConnected = sellers.reduce((acc, s) => {
    return acc + (s.stores || []).reduce((bAcc, st) => bAcc + (st.bots || []).length, 0);
  }, 0);

  // Actions Handlers (preserved existing)
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
        text: selectedSeller.status === "suspended" ? "Acesso reativado com sucesso!" : "Acesso suspenso com sucesso!",
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
      setFeedbackMsg({ type: "success", text: "Senha redefinida com sucesso!" });
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
        body: JSON.stringify({ action: "release_subscription", days: parseInt(releaseDaysInput, 10) || 30 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao liberar mensalidade.");
      }
      setFeedbackMsg({ type: "success", text: `Mensalidade liberada por ${releaseDaysInput} dias!` });
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
      setFeedbackMsg({ type: "success", text: data.message || "Vendedor excluído com sucesso!" });
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
    return formatBusinessDate(dateStr);
  };

  // Preview fee after exemption expires
  const feeAfterExemptionPreview =
    commissionMode === "CUSTOM"
      ? `R$ ${customFeeInput.toFixed(2).replace(".", ",")}`
      : "R$ 0,50 (Padrão da Plataforma)";

  return (
    <div className="space-y-8 pb-12 fade-in text-gray-100">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#111116] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Vendedores e Taxas
            </h1>
            <span className="px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              Super Admin WebGran
            </span>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Gestão completa de vendedores, lojas, bots, taxas individuais e auditoria
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs h-9 sm:h-10 px-3.5 sm:px-4 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Vendedor</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex-1 sm:flex-initial bg-[#16161D] border-white/[0.08] hover:bg-white/5 text-gray-300 hover:text-white rounded-xl text-xs h-9 sm:h-10 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
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
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Sellers */}
        <div className="bg-[#111116] p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Total Vendedores
            </span>
            <span className="text-2xl font-black text-white mt-1 block">{totalSellers}</span>
          </div>
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Sellers */}
        <div className="bg-[#111116] p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Vendedores Ativos
            </span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{activeSellersCount}</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Telegram Bots */}
        <div className="bg-[#111116] p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Bots Conectados
            </span>
            <span className="text-2xl font-black text-purple-400 mt-1 block">{totalBotsConnected}</span>
          </div>
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
        </div>

        {/* Custom Fees */}
        <div className="bg-[#111116] p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Taxa Personalizada
            </span>
            <span className="text-2xl font-black text-blue-400 mt-1 block">{customFeeCount}</span>
          </div>
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
        </div>

        {/* Active Exemptions */}
        <div className="bg-[#111116] p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Isenções Ativas
            </span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{exemptionActiveCount}</span>
          </div>
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Tag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-[#111116] p-4 rounded-2xl border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, loja, slug ou @bot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#16161D] border border-white/[0.08] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#16161D] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Todos ({sellers.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Ativos ({sellers.filter((s) => s.status === "active").length})
            </button>
            <button
              onClick={() => setStatusFilter("suspended")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                statusFilter === "suspended"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Suspensos ({sellers.filter((s) => s.status === "suspended").length})
            </button>
          </div>

          {/* Fee Filter */}
          <div className="flex items-center gap-1 bg-[#16161D] p-1 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setFeeFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                feeFilter === "all"
                  ? "bg-zinc-700 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Todas as Taxas
            </button>
            <button
              onClick={() => setFeeFilter("DEFAULT")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                feeFilter === "DEFAULT"
                  ? "bg-zinc-700 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Padrão ({standardFeeCount})
            </button>
            <button
              onClick={() => setFeeFilter("CUSTOM")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                feeFilter === "CUSTOM"
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Personalizada ({customFeeCount})
            </button>
            <button
              onClick={() => setFeeFilter("EXEMPTION")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                feeFilter === "EXEMPTION"
                  ? "bg-amber-600 text-white font-semibold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Isenção ({exemptionActiveCount})
            </button>
          </div>
        </div>
      </div>

      {/* SELLERS & FEES TABLE */}
      <div className="bg-[#111116] p-5 sm:p-6 rounded-2xl border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Vendedores e Configuração de Taxas</h2>
          <span className="text-xs text-gray-400">{filteredSellers.length} vendedor(es) listado(s)</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-gray-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Vendedor</th>
                <th className="pb-3 px-3">Lojas e Bots</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Taxa Efetiva</th>
                <th className="pb-3 px-3">Regra / Isenção</th>
                <th className="pb-3 px-3">Vendas</th>
                <th className="pb-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-xs">
              {filteredSellers.map((seller) => {
                const isExempt = seller.commission?.source === "EXEMPTION";
                const isCustom = seller.commission?.source === "CUSTOM";
                const isDefault = seller.commission?.source === "PLATFORM_DEFAULT";

                return (
                  <tr key={seller.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Vendedor */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
                          {seller.name[0]?.toUpperCase() || "V"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate max-w-[160px]">{seller.name}</p>
                          <div className="flex items-center gap-1.5 text-gray-400 text-[11px] mt-0.5 truncate max-w-[180px]">
                            <Mail className="w-3 h-3 text-gray-500 shrink-0" />
                            <span className="truncate">{seller.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Lojas & Bots */}
                    <td className="py-3.5 px-3">
                      {seller.stores && seller.stores.length > 0 ? (
                        <div className="space-y-1.5 max-w-[240px]">
                          {seller.stores.map((st) => (
                            <div key={st.id} className="text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-white/5 border border-white/[0.08] text-gray-200">
                                  <Store className="w-3 h-3 text-blue-400" />
                                  <span className="truncate max-w-[120px]">{st.name}</span>
                                </span>
                                <span className="font-mono text-[10px] text-gray-500">/{st.slug}</span>
                              </div>

                              {/* Bots under store */}
                              {st.bots && st.bots.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1 pl-1">
                                  {st.bots.map((b) => (
                                    <span
                                      key={b.id}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono"
                                    >
                                      <Bot className="w-2.5 h-2.5 text-purple-400" />
                                      @{b.username}
                                      {b.status === "active" ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      ) : (
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-500 italic pl-1 block">Nenhum bot conectado</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">Sem loja criada</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      {seller.status === "active" && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Ativo
                        </span>
                      )}
                      {seller.status === "pending" && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold inline-flex items-center gap-1">
                          Pendente
                        </span>
                      )}
                      {seller.status === "suspended" && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-semibold inline-flex items-center gap-1">
                          Suspenso
                        </span>
                      )}
                      {seller.status === "inactive" && (
                        <span className="px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[11px] font-semibold inline-flex items-center gap-1">
                          Inativo
                        </span>
                      )}
                    </td>

                    {/* Taxa Efetiva */}
                    <td className="py-3.5 px-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white">
                            {seller.commission?.formattedFee || "R$ 0,50"}
                          </span>
                          <span className="text-[10px] text-gray-400">/venda</span>
                        </div>
                        <div className="mt-1">
                          {isExempt ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Tag className="w-2.5 h-2.5" />
                              Isenção Ativa
                            </span>
                          ) : isCustom ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Sliders className="w-2.5 h-2.5" />
                              Personalizada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-gray-400 border border-white/[0.08]">
                              <Percent className="w-2.5 h-2.5 text-gray-500" />
                              Padrão Plataforma
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Regra / Término da Isenção */}
                    <td className="py-3.5 px-3 text-gray-300">
                      {isExempt && seller.commission?.exemption?.endFormatted ? (
                        <div>
                          <span className="text-amber-400 text-[11px] font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Até {seller.commission.exemption.endFormatted}
                          </span>
                          <span className="text-[10px] text-gray-500 block mt-0.5 truncate max-w-[150px]">
                            {seller.commission.exemption.reason || "Isenção temporária"}
                          </span>
                        </div>
                      ) : isCustom ? (
                        <div>
                          <span className="text-gray-300 text-[11px] font-medium">Configuração Direta</span>
                          <span className="text-[10px] text-gray-500 block mt-0.5">Versão v{seller.commission?.version ?? 1}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500">R$ 0,50 por venda Pix</span>
                      )}
                    </td>

                    {/* Vendas */}
                    <td className="py-3.5 px-3">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {seller.sales?.formattedVolume || "R$ 0,00"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {seller.sales?.paidOrdersCount || 0} pedidos pagos
                        </span>
                      </div>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Direct Button: Gerenciar Taxa */}
                        <Button
                          size="sm"
                          onClick={() => handleOpenCommissionModal(seller)}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold h-8 px-2.5 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                          <Coins className="w-3.5 h-3.5 text-blue-400" />
                          <span>Taxa</span>
                        </Button>

                        {/* Dropdown Menu for all preserved admin actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer inline-flex items-center justify-center transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-56 bg-[#16161D] border border-white/[0.08] shadow-2xl p-1 text-xs text-gray-300"
                          >
                            <DropdownMenuItem
                              onClick={() => handleOpenCommissionModal(seller)}
                              className="px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-blue-400 font-semibold focus:bg-white/5 focus:text-blue-300"
                            >
                              <Coins className="w-3.5 h-3.5 text-blue-400" />
                              Gerenciar Taxas & Isenções
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-white/[0.08] my-1" />

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

                            <DropdownMenuSeparator className="bg-white/[0.08] my-1" />

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
                                  Reativar acesso
                                </>
                              ) : (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                                  Suspender acesso
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

                            <DropdownMenuSeparator className="bg-white/[0.08] my-1" />

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
                      </div>
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
      {/* MODAL PRINCIPAL: GERENCIAR TAXAS & ISENÇÕES */}
      {/* ==================================================== */}
      {isManageCommissionOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar p-6 space-y-6 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold text-white">Gerenciar Taxa da Plataforma</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {currentVersion === 0 ? "v0 (Padrão)" : `v${currentVersion}`}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Vendedor: <strong className="text-white">{selectedSeller.name}</strong> ({selectedSeller.email})
                </p>
              </div>
              <button
                onClick={handleCloseCommissionModal}
                className="text-gray-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Fee Badge in Modal */}
            <div className="bg-[#16161D] p-3.5 rounded-xl border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider block">
                    Taxa Efetiva Atual em Vigor
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg font-black text-white">{currentEffectiveFeePreview}</span>
                    <span className="text-xs text-gray-400">por venda elegível Pix PushinPay</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Concurrency Alert */}
            {commissionConcurrencyAlert && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Aviso de Concorrência Detectado</p>
                  <p>{commissionConcurrencyAlert}</p>
                </div>
              </div>
            )}

            {/* Feedback Message */}
            {commissionFeedback && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  commissionFeedback.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  {commissionFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{commissionFeedback.text}</span>
                </div>
                <button
                  onClick={() => setCommissionFeedback(null)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tabs: Configuração vs Histórico */}
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveCommissionTab("config")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCommissionTab === "config"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configurar Taxa</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCommissionTab("history")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeCommissionTab === "history"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico de Auditoria ({commissionAuditHistory.length})</span>
              </button>
            </div>

            {/* TAB 1: CONFIGURAÇÃO */}
            {activeCommissionTab === "config" && (
              <form onSubmit={handleSaveCommission} className="space-y-5 text-xs">
                {/* Mode Selector */}
                <div className="space-y-2">
                  <label className="block text-gray-300 font-semibold uppercase tracking-wider text-[11px]">
                    Regra Aplicada ao Vendedor
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Mode 1: Default */}
                    <button
                      type="button"
                      onClick={() => setCommissionMode("DEFAULT")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        commissionMode === "DEFAULT"
                          ? "bg-blue-500/10 border-blue-500/40 text-white shadow-sm"
                          : "bg-[#16161D] border-white/[0.08] text-gray-400 hover:border-white/[0.2]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">Taxa Padrão</span>
                        {commissionMode === "DEFAULT" && <Check className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-gray-400">R$ 0,50 por venda (herdada da plataforma)</p>
                    </button>

                    {/* Mode 2: Custom */}
                    <button
                      type="button"
                      onClick={() => setCommissionMode("CUSTOM")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        commissionMode === "CUSTOM"
                          ? "bg-blue-500/10 border-blue-500/40 text-white shadow-sm"
                          : "bg-[#16161D] border-white/[0.08] text-gray-400 hover:border-white/[0.2]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">Taxa Personalizada</span>
                        {commissionMode === "CUSTOM" && <Check className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-gray-400">Valor fixo entre R$ 0,00 e R$ 0,50</p>
                    </button>

                    {/* Mode 3: Exemption */}
                    <button
                      type="button"
                      onClick={() => setCommissionMode("EXEMPTION")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        commissionMode === "EXEMPTION"
                          ? "bg-amber-500/10 border-amber-500/40 text-white shadow-sm"
                          : "bg-[#16161D] border-white/[0.08] text-gray-400 hover:border-white/[0.2]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-amber-400">Isenção Temporária</span>
                        {commissionMode === "EXEMPTION" && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-gray-400">R$ 0,00 com período de validade</p>
                    </button>
                  </div>
                </div>

                {/* Mode Details */}
                {commissionMode === "DEFAULT" && (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-gray-300 space-y-1.5">
                    <p className="font-semibold text-white">Comportamento da Taxa Padrão:</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      O vendedor não possuirá taxa individual configurada (`customFeeCents = null`). Ele seguirá
                      automaticamente o padrão global da plataforma (R$ 0,50 por venda Pix na PushinPay). Nenhuma
                      isenção temporária estará ativa.
                    </p>
                  </div>
                )}

                {commissionMode === "CUSTOM" && (
                  <div className="p-4 rounded-xl bg-[#16161D] border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-gray-300 font-semibold">Valor da Taxa por Venda</label>
                      <span className="text-base font-black text-blue-400">
                        R$ {customFeeInput.toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={customFeeInput}
                        onChange={(e) => setCustomFeeInput(parseFloat(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>R$ 0,00 (Gratuito)</span>
                        <span>R$ 0,25</span>
                        <span>R$ 0,50 (Máximo)</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Ou digite o valor exato (R$):</label>
                      <input
                        type="number"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={customFeeInput}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setCustomFeeInput(val);
                        }}
                        className="w-full bg-[#111116] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  </div>
                )}

                {commissionMode === "EXEMPTION" && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-gray-300 font-semibold block text-[11px]">
                          Data e Hora de Início (America/Recife)
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={exemptionStartInput}
                          onChange={(e) => setExemptionStartInput(e.target.value)}
                          className="w-full bg-[#111116] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-gray-300 font-semibold block text-[11px]">
                          Data e Hora de Término (America/Recife)
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={exemptionEndInput}
                          onChange={(e) => setExemptionEndInput(e.target.value)}
                          className="w-full bg-[#111116] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-300 font-semibold block text-[11px]">
                        Justificativa da Isenção (Obrigatória)
                      </label>
                      <input
                        type="text"
                        required
                        value={exemptionReasonInput}
                        onChange={(e) => setExemptionReasonInput(e.target.value)}
                        placeholder="Ex: Parceria comercial exclusiva Q4, vendedor VIP promocional"
                        className="w-full bg-[#111116] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Dynamic Preview */}
                    <div className="p-3 bg-[#111116] rounded-xl border border-white/[0.08] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Durante o período de isenção:</span>
                        <span className="font-bold text-emerald-400">R$ 0,00 (Isento)</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.05]">
                        <span className="text-gray-400">Após o término da isenção:</span>
                        <span className="font-bold text-white flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-blue-400" />
                          {feeAfterExemptionPreview}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mandatory Audit Reason */}
                <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                  <label className="block text-gray-300 font-semibold">
                    Justificativa da Alteração <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={changeReasonInput}
                    onChange={(e) => setChangeReasonInput(e.target.value)}
                    placeholder="Ex: Ajuste acordado via WhatsApp, correção de plano, promoção concedida"
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-gray-500 block">
                    Registrado de forma imutável no log de auditoria com seu usuário de super administrador.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseCommissionModal}
                    className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                  >
                    Fechar
                  </Button>
                  <Button
                    type="submit"
                    disabled={commissionLoading || !changeReasonInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    {commissionLoading ? "Gravando no Livro..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: HISTÓRICO DE AUDITORIA */}
            {activeCommissionTab === "history" && (
              <div className="space-y-4 text-xs">
                {commissionHistoryLoading ? (
                  <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Carregando trilha de auditoria...</span>
                  </div>
                ) : commissionAuditHistory.length > 0 ? (
                  <div className="space-y-3">
                    {commissionAuditHistory.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#16161D] p-3.5 rounded-xl border border-white/[0.08] space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-gray-400">
                            {formatBusinessDateTime(item.createdAt)}
                          </span>
                          <span className="text-gray-400">
                            Por: <strong className="text-white">{item.changedByName || item.changedByEmail || "Admin"}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-gray-400">
                            {item.previousFeeCents !== null ? `R$ ${(item.previousFeeCents / 100).toFixed(2)}` : "Padrão"}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-white font-bold">
                            {item.newFeeCents !== null ? `R$ ${(item.newFeeCents / 100).toFixed(2)}` : "Padrão"}
                          </span>

                          {item.newExemptionActive && (
                            <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans font-semibold">
                              Isenção Ativada
                            </span>
                          )}
                        </div>

                        <p className="text-gray-300 text-[11px] bg-[#111116] p-2 rounded-lg border border-white/[0.04]">
                          &ldquo;{item.reason}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    Nenhum registro de alteração de taxa encontrado para este vendedor.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: ADICIONAR VENDEDOR */}
      {/* ==================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
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
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.08]">
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
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-300 font-semibold">Status Inicial</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="30">30 Dias (Mensal)</option>
                    <option value="90">90 Dias (Trimestral)</option>
                    <option value="365">365 Dias (Anual)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">E-mail</label>
                <input
                  type="email"
                  required
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditUserOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Slug da Loja</label>
                <input
                  type="text"
                  required
                  value={editStoreForm.slug}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, slug: e.target.value })}
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-300 font-semibold">Status da Loja</label>
                <select
                  value={editStoreForm.status}
                  onChange={(e) => setEditStoreForm({ ...editStoreForm, status: e.target.value })}
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="active">🟢 Ativa</option>
                  <option value="suspended">🔴 Suspensa</option>
                  <option value="inactive">⚪ Inativa</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditStoreOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Gerenciar Mensalidade — {selectedSeller.name}
              </h3>
              <button onClick={() => setIsManageSubOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-[#16161D] p-4 rounded-xl border border-white/[0.08]">
                <div>
                  <span className="text-gray-400 block text-[11px]">Plano Contratado</span>
                  <span className="text-white font-bold text-sm block">
                    {selectedSeller.subscription?.planName || "WebGran SaaS"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Valor</span>
                  <span className="text-emerald-400 font-bold text-sm block">
                    R$ {(selectedSeller.subscription?.price || 0).toFixed(2).replace(".", ",")} / mês
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Status Assinatura</span>
                  <span className="font-bold block mt-0.5">
                    {selectedSeller.subscription?.status === "ACTIVE" ? (
                      <span className="text-emerald-400">🟢 ATIVA</span>
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
                <div className="bg-[#16161D] p-4 rounded-xl border border-white/[0.08] space-y-2">
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
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs h-10 px-4 flex items-center justify-center gap-2 cursor-pointer"
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
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500 text-xs font-semibold"
                >
                  <option value="30">30 Dias de Acesso (1 Mês)</option>
                  <option value="60">60 Dias de Acesso (2 Meses)</option>
                  <option value="90">90 Dias de Acesso (3 Meses)</option>
                  <option value="180">180 Dias de Acesso (6 Meses)</option>
                  <option value="365">365 Dias de Acesso (1 Ano)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReleaseSubOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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
                  className="w-full bg-[#16161D] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !resetPasswordInput}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50"
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
          <div className="bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmSuspendOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleToggleSuspend}
                  disabled={loading}
                  className={`font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50 ${
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
          <div className="bg-[#111116] border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="bg-[#16161D] border-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs h-10 px-4 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleDeleteSeller}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-xs h-10 px-5 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-red-600/20"
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
