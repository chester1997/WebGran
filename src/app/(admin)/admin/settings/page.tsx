import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { themes, subscriptionPlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { 
  Settings, 
  CreditCard, 
  Palette, 
  ShieldCheck, 
  Building2, 
  ArrowRight,
  Lock,
  Zap
} from "lucide-react";

export default async function AdminSettingsPage() {
  const user = await requireAdmin();

  // Buscar tema padrão
  const defaultTheme = await db.query.themes.findFirst({
    where: eq(themes.isDefault, true)
  });

  // Buscar plano WebGran
  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.slug, "webgran")
  });

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Configurações Globais</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">
              SaaS Admin
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Parâmetros globais da plataforma WebGran e integrações ativas
          </p>
        </div>
      </div>

      {/* SETTINGS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: ASSINATURA WEBGRAN SAAS */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Plano de Assinatura SaaS</h3>
                <p className="text-xs text-gray-400">Valor único cobrado aos lojistas pelo uso da plataforma</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Nome do Plano</span>
                <span className="text-sm font-bold text-white">{plan?.name || "WebGran"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400 font-medium">Preço Fixo</span>
                <span className="text-base font-black text-emerald-400">R$ {Number(plan?.price || 89.90).toFixed(2)} / mês</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400 font-medium">Frequência</span>
                <span className="text-xs font-semibold text-gray-300">Mensal (PIX Cora)</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 bg-[#18181B]/50 p-3 rounded-xl border border-[#27272A]">
            💡 O valor do plano é centralizado no banco de dados e aplicado a todas as cobranças geradas aos vendedores.
          </div>
        </div>

        {/* CARD 2: TEMA PADRÃO DO SISTEMA */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Tema Padrão do Sistema</h3>
                <p className="text-xs text-gray-400">Layout automático atribuído às novas lojas criadas</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Tema Ativo</span>
                <span className="text-sm font-bold text-purple-400">{defaultTheme?.name || "Nenhum selecionado"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400 font-medium">Identificador</span>
                <span className="text-xs font-mono text-gray-300">slug: {defaultTheme?.slug || "default"}</span>
              </div>
            </div>
          </div>

          <Link
            href="/admin/themes"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-bold text-purple-400 hover:text-purple-300 transition-all"
          >
            Gerenciar Temas na aba Temas
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* CARD 3: INTEGRAÇÃO CORA BANK */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Integração Banco Cora</h3>
                <p className="text-xs text-gray-400">Processamento de faturas PIX e webhooks de pagamento</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Provider</span>
                <span className="text-xs font-bold text-white">Cora Bank PIX</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Webhook Status</span>
                <span className="text-xs font-bold text-emerald-400">Ativo / Idempotente</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Endpoint Webhook</span>
                <span className="text-[10px] font-mono text-gray-400">/api/billing/cora/webhook</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 bg-[#18181B]/50 p-3 rounded-xl border border-[#27272A]">
            ✓ Cobranças PIX com validação server-side e confirmação instantânea.
          </div>
        </div>

        {/* CARD 4: PERFIL ADMINISTRATIVO SUPREMO */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Segurança e Perfil Admin</h3>
                <p className="text-xs text-gray-400">Credenciais de acesso ao painel de controle supremo</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Administrador</span>
                <span className="text-xs font-bold text-white">{user.name || "Administrador Supremo"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">E-mail</span>
                <span className="text-xs font-mono text-gray-300">{user.email}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272A] pt-2">
                <span className="text-xs text-gray-400">Perfil</span>
                <span className="text-xs font-bold text-red-400 uppercase">SUPER_ADMIN</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 bg-[#18181B]/50 p-3 rounded-xl border border-[#27272A] flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span>Apenas contas com papel super_admin podem modificar configurações globais.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
