"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Package, ArrowRight } from "lucide-react";
import { TopProductItem } from "@/lib/analytics/analytics-service";
import { DashboardEmptyState } from "./DashboardEmptyState";

interface SellerTopProductsCardProps {
  topProducts?: TopProductItem[];
  isPending?: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProductThumbnail({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (coverUrl && !hasError) {
    return (
      <img
        src={coverUrl}
        alt={title}
        onError={() => setHasError(true)}
        className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/10 bg-black/40"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[#3984FF] flex items-center justify-center shrink-0">
      <Package className="w-4 h-4" />
    </div>
  );
}

export function SellerTopProductsCard({
  topProducts = [],
  isPending = false,
}: SellerTopProductsCardProps) {
  const hasProducts = topProducts.length > 0;

  if (isPending) {
    return (
      <div className="rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 min-h-[340px] animate-pulse flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-32" />
          <div className="h-3 bg-white/[0.03] rounded w-20" />
        </div>
        <div className="space-y-3 my-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/[0.02] rounded-xl w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Produtos mais vendidos"
      className="group relative overflow-hidden rounded-2xl bg-[var(--seller-surface,#101218)] border border-white/[0.06] p-5 sm:p-6 shadow-none flex flex-col justify-between before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/25 before:to-transparent hover:-translate-y-0.5 hover:border-white/10 hover:shadow-xl transition-all duration-200 min-h-[340px]"
    >
      {/* Topo do Card */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#3984FF]" />
            <span>Top produtos</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Mais vendidos no período</p>
        </div>

        <Link
          href="/seller/products"
          className="text-xs font-medium text-[#3984FF] hover:text-[#60A5FA] flex items-center gap-1 transition-colors"
        >
          <span>Catálogo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {!hasProducts ? (
        <DashboardEmptyState
          icon={ShoppingBag}
          title="Nenhum produto vendido"
          description="Quando você realizar vendas de cursos, grupos ou combos, seus produtos mais populares aparecerão aqui."
          actionText="Gerenciar produtos"
          actionHref="/seller/products"
          className="my-auto"
        />
      ) : (
        <div className="space-y-2.5 my-auto">
          {topProducts.slice(0, 5).map((prod, idx) => (
            <div
              key={prod.id || idx}
              className="p-3 rounded-xl bg-[var(--seller-surface-raised,#151821)] border border-white/[0.04] hover:border-white/10 transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Indicador de Ranking */}
                <span className="text-xs font-bold text-zinc-500 w-4 text-center shrink-0 tabular-nums">
                  #{idx + 1}
                </span>

                <ProductThumbnail coverUrl={prod.coverUrl} title={prod.title} />

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-zinc-100 truncate">
                    {prod.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-0.5">
                    <span className="tabular-nums font-medium">
                      {prod.salesCount} {prod.salesCount === 1 ? "venda" : "vendas"}
                    </span>
                    {prod.percentage !== undefined && prod.percentage > 0 && (
                      <span className="text-zinc-500 font-mono text-[10px]">
                        ({prod.percentage}% do total)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Receita Gerada */}
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-white tabular-nums block">
                  {formatBRL(prod.revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

