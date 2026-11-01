"use client";

import React from "react";
import Link from "next/link";
import { Check, ArrowRight, CreditCard, Package, Bot, Bell } from "lucide-react";

export interface SellerSetupChecklistData {
  hasPaymentGateway: boolean;
  hasProducts: boolean;
  hasBot: boolean;
  hasSaleNotifications: boolean;
  firstBotWithoutNotificationsId?: string | null;
}

interface SellerSetupChecklistProps {
  checklist?: SellerSetupChecklistData | null;
  isPending?: boolean;
}

export function SellerSetupChecklist({
  checklist,
  isPending = false,
}: SellerSetupChecklistProps) {
  if (isPending) {
    return (
      <div 
        aria-busy="true"
        aria-label="Carregando próximos passos"
        className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6 animate-pulse motion-reduce:animate-none"
      >
        <div className="h-4 w-40 bg-white/10 rounded mb-2" />
        <div className="h-3 w-64 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-16 bg-white/[0.03] rounded-[8px]" />
          <div className="h-16 bg-white/[0.03] rounded-[8px]" />
          <div className="h-16 bg-white/[0.03] rounded-[8px]" />
          <div className="h-16 bg-white/[0.03] rounded-[8px]" />
        </div>
      </div>
    );
  }

  if (!checklist) return null;

  const {
    hasPaymentGateway = false,
    hasProducts = false,
    hasBot = false,
    hasSaleNotifications = false,
    firstBotWithoutNotificationsId = null,
  } = checklist;

  // Se todos os 4 passos foram concluídos, o checklist some completamente
  const allCompleted = hasPaymentGateway && hasProducts && hasBot && hasSaleNotifications;
  if (allCompleted) return null;

  // Link para ativar avisos de venda
  const notificationsHref = hasBot
    ? firstBotWithoutNotificationsId
      ? `/seller/store?bot=${firstBotWithoutNotificationsId}#bot-${firstBotWithoutNotificationsId}`
      : "/seller/store#notifications"
    : "/seller/store";

  const steps = [
    {
      id: "payment",
      title: "Conectar pagamento",
      description: "Mercado Pago ou PushinPay",
      completed: hasPaymentGateway,
      href: "/seller/recebimentos",
      cta: "Conectar",
      icon: CreditCard,
    },
    {
      id: "product",
      title: "Criar o primeiro produto",
      description: "Cadastre seu catálogo de venda",
      completed: hasProducts,
      href: "/seller/products",
      cta: "Cadastrar",
      icon: Package,
    },
    {
      id: "bot",
      title: "Conectar o bot",
      description: "Vincule o bot do Telegram",
      completed: hasBot,
      href: "/seller/store",
      cta: "Conectar",
      icon: Bot,
    },
    {
      id: "notifications",
      title: "Ativar avisos de venda",
      description: "Receba alertas no Telegram",
      completed: hasSaleNotifications,
      href: notificationsHref,
      cta: "Ativar",
      icon: Bell,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <section
      aria-label="Checklist de primeiros passos"
      className="bg-[var(--seller-surface,#12141A)] border border-[var(--seller-border,rgba(255,255,255,0.05))] rounded-[12px] p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">Próximos passos</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Complete a configuração da sua loja para receber vendas e pagamentos
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-sans tabular-nums text-zinc-300 font-medium">
            {completedCount} de {steps.length} concluídos
          </span>
          <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.id}
              className={`p-3.5 rounded-[8px] border transition-all flex flex-col justify-between gap-3 ${
                step.completed
                  ? "bg-white/[0.02] border-white/[0.04] opacity-80"
                  : "bg-[var(--seller-surface-raised,#181A20)] border-[var(--seller-border,rgba(255,255,255,0.08))] hover:border-emerald-500/30"
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    step.completed
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "border border-zinc-600 text-zinc-400"
                  }`}
                >
                  {step.completed ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <Icon className="w-3 h-3 text-zinc-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-medium leading-tight truncate ${
                      step.completed ? "text-zinc-400 line-through" : "text-zinc-200"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between border-t border-white/[0.03]">
                {step.completed ? (
                  <span className="text-[11px] text-emerald-400 font-medium">Concluído</span>
                ) : (
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors group focus:outline-none focus:ring-1 focus:ring-emerald-400/50 rounded"
                  >
                    <span>{step.cta}</span>
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
