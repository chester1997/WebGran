"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Sparkles, Loader2, Rocket, ArrowRight } from "lucide-react";

export default function SetupStoreClient() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setError("Por favor, informe o nome da sua loja.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/seller/store/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: storeName.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao criar loja.");
      }

      // Reload page to refresh store context
      router.refresh();
      window.location.href = "/seller";
    } catch (err: any) {
      setError(err.message || "Erro ao criar loja. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-[#121214] border border-white/10 rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl relative overflow-hidden text-center">
        {/* Glowing Background Effect */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-red-600/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-600/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mx-auto text-white shadow-xl">
          <Store className="w-8 h-8 text-emerald-400" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Configuração Inicial da Loja
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">Configure sua Loja</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Sua conta ainda não possui uma loja ativa vinculada no banco de dados. Informe o nome da sua loja abaixo para criá-la instantaneamente.
          </p>
        </div>

        <form onSubmit={handleCreateStore} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Nome da sua Loja
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Minha Loja Oficial"
              className="w-full bg-[#18181C] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Criando sua loja no banco...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Criar Minha Loja</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
