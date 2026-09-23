"use client";

import { useState } from "react";
import { 
  Ticket, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar,
  Percent,
  DollarSign,
  TrendingUp,
  Tag,
  Loader2,
  Copy,
  Check
} from "lucide-react";
import { 
  createCouponAction, 
  toggleCouponStatusAction, 
  deleteCouponAction 
} from "./actions";

interface CouponItem {
  id: string;
  storeId: string;
  code: string;
  discountType: string;
  discountValue: string;
  minOrderValue: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | string | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export default function CouponsClient({ initialCoupons }: { initialCoupons: CouponItem[] }) {
  const [couponsList, setCouponsList] = useState<CouponItem[]>(initialCoupons);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal Form State
  const [formCode, setFormCode] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formMinOrderValue, setFormMinOrderValue] = useState("");
  const [formMaxUses, setFormMaxUses] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");

  const resetForm = () => {
    setFormCode("");
    setFormDiscountType("percentage");
    setFormDiscountValue("");
    setFormMinOrderValue("");
    setFormMaxUses("");
    setFormExpiresAt("");
    setErrorMessage(null);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const val = parseFloat(formDiscountValue.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      setErrorMessage("Informe um valor de desconto válido e maior que zero.");
      return;
    }

    if (formDiscountType === "percentage" && val > 100) {
      setErrorMessage("Desconto percentual não pode ultrapassar 100%.");
      return;
    }

    setIsLoading(true);
    try {
      const minVal = formMinOrderValue ? parseFloat(formMinOrderValue.replace(",", ".")) : 0;
      const maxUsesVal = formMaxUses ? parseInt(formMaxUses, 10) : null;

      await createCouponAction({
        code: formCode,
        discountType: formDiscountType,
        discountValue: val,
        minOrderValue: isNaN(minVal) ? 0 : minVal,
        maxUses: maxUsesVal && !isNaN(maxUsesVal) ? maxUsesVal : null,
        expiresAt: formExpiresAt || null,
      });

      setSuccessMessage("Cupom criado com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsModalOpen(false);
      resetForm();
      // Refresh page or state update
      window.location.reload();
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao criar cupom. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (coupon: CouponItem) => {
    try {
      await toggleCouponStatusAction(coupon.id, coupon.status);
      setCouponsList((prev) =>
        prev.map((c) =>
          c.id === coupon.id
            ? { ...c, status: c.status === "active" ? "inactive" : "active" }
            : c
        )
      );
    } catch (err: any) {
      alert("Erro ao alterar status do cupom");
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom?")) return;

    try {
      await deleteCouponAction(couponId);
      setCouponsList((prev) => prev.filter((c) => c.id !== couponId));
    } catch (err: any) {
      alert("Erro ao excluir cupom");
    }
  };

  const totalActive = couponsList.filter((c) => c.status === "active").length;
  const totalUsed = couponsList.reduce((acc, c) => acc + (c.usedCount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notifications */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0F0F12] border border-white/5 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Cupons de Desconto</h1>
              <p className="text-xs text-zinc-400">Crie e gerencie códigos promocionais para seus clientes resgatarem no carrinho</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 hover:shadow-red-500/40 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Criar Novo Cupom</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-medium">Total de Cupons</span>
            <p className="text-2xl font-black text-white">{couponsList.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-zinc-800/60 border border-white/5 flex items-center justify-center text-zinc-400">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-medium">Cupons Ativos</span>
            <p className="text-2xl font-black text-emerald-400">{totalActive}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0F0F12] border border-white/5 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-medium">Total de Resgates</span>
            <p className="text-2xl font-black text-amber-400">{totalUsed}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Coupons List Table / Cards */}
      <div className="bg-[#0F0F12] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        {couponsList.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center mx-auto text-zinc-500">
              <Ticket className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Nenhum cupom cadastrado</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Crie seu primeiro cupom de desconto para impulsionar suas vendas e atrair novos clientes no Telegram.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeiro Cupom</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 bg-[#141418] text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                  <th className="py-4 px-6">Código do Cupom</th>
                  <th className="py-4 px-4">Desconto</th>
                  <th className="py-4 px-4">Pedido Mínimo</th>
                  <th className="py-4 px-4">Uso / Limite</th>
                  <th className="py-4 px-4">Validade</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {couponsList.map((coupon) => {
                  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                  const isLimitReached = coupon.maxUses && coupon.usedCount >= coupon.maxUses;
                  const discountFormatted =
                    coupon.discountType === "percentage"
                      ? `${parseFloat(coupon.discountValue)}% OFF`
                      : `R$ ${parseFloat(coupon.discountValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} OFF`;

                  const minOrderFormatted =
                    coupon.minOrderValue && parseFloat(coupon.minOrderValue) > 0
                      ? `R$ ${parseFloat(coupon.minOrderValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "Sem mínimo";

                  return (
                    <tr key={coupon.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Code */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm tracking-wider text-white bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-xl flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-red-500" />
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            className="p-1 text-zinc-500 hover:text-white transition-colors"
                            title="Copiar Código"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Discount */}
                      <td className="py-4 px-4">
                        <span className="font-extrabold text-white text-sm">
                          {discountFormatted}
                        </span>
                      </td>

                      {/* Min Order */}
                      <td className="py-4 px-4 text-zinc-300">
                        {minOrderFormatted}
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-white">
                            {coupon.usedCount}
                          </span>
                          <span className="text-zinc-500">
                            {coupon.maxUses ? ` / ${coupon.maxUses}` : " (Sem limite)"}
                          </span>
                        </div>
                      </td>

                      {/* Expiration */}
                      <td className="py-4 px-4">
                        {coupon.expiresAt ? (
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span className={isExpired ? "text-red-400 font-semibold" : ""}>
                              {new Date(coupon.expiresAt).toLocaleDateString("pt-BR")}
                            </span>
                            {isExpired && (
                              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
                                Expirado
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-500">Indeterminado</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(coupon)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            coupon.status === "active" && !isExpired && !isLimitReached
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              coupon.status === "active" && !isExpired && !isLimitReached
                                ? "bg-emerald-400 animate-pulse"
                                : "bg-zinc-500"
                            }`}
                          />
                          {coupon.status === "active" && !isExpired && !isLimitReached
                            ? "Ativo"
                            : "Inativo"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(coupon.id)}
                          className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                          title="Excluir Cupom"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE COUPON MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#121216] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Criar Novo Cupom</h3>
                  <p className="text-xs text-zinc-400">Configure as regras do código promocional</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white p-2 rounded-xl transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-2xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              {/* Code Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">
                  Código do Cupom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="EX: DESCONTO10, NATAL20"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-[#1A1A20] border border-white/10 text-white text-xs uppercase tracking-wider font-mono placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {/* Discount Type Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormDiscountType("percentage")}
                  className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    formDiscountType === "percentage"
                      ? "bg-red-500/10 border-red-500/40 text-red-400 shadow-md shadow-red-500/10"
                      : "bg-[#1A1A20] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>Porcentagem (%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormDiscountType("fixed")}
                  className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    formDiscountType === "fixed"
                      ? "bg-red-500/10 border-red-500/40 text-red-400 shadow-md shadow-red-500/10"
                      : "bg-[#1A1A20] border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Valor Fixo (R$)</span>
                </button>
              </div>

              {/* Discount Value */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">
                  {formDiscountType === "percentage" ? "Porcentagem de Desconto (%)" : "Valor do Desconto (R$)"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={formDiscountType === "percentage" ? "100" : undefined}
                    required
                    placeholder={formDiscountType === "percentage" ? "Ex: 15" : "Ex: 20.00"}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1A1A20] border border-white/10 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                    {formDiscountType === "percentage" ? "%" : "R$"}
                  </div>
                </div>
              </div>

              {/* Min Order & Max Uses in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">
                    Pedido Mínimo (R$) <span className="text-zinc-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 50.00"
                    value={formMinOrderValue}
                    onChange={(e) => setFormMinOrderValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1A1A20] border border-white/10 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">
                    Limite de Usos <span className="text-zinc-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 100"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1A1A20] border border-white/10 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </div>

              {/* Expiration Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">
                  Data de Validade <span className="text-zinc-500 font-normal">(Opcional)</span>
                </label>
                <input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#1A1A20] border border-white/10 text-white text-xs focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#18181C] hover:bg-white/10 text-zinc-300 text-xs font-bold border border-white/5 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Cupom</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
