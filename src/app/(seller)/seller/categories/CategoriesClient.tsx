"use client";

import React, { useState } from "react";
import { Tags, Search, GripVertical, Image as ImageIcon } from "lucide-react";
import { NewCategoryModal } from "./NewCategoryModal";
import { CategoryActionsMenu } from "./CategoryActionsMenu";
import { CategoryStyleToggle } from "./CategoryStyleToggle";
import SellerPageHeader from "@/components/layout/SellerPageHeader";

interface CategoriesClientProps {
  allCategories: any[];
  serializedProducts: any[];
  initialStyle: "IMAGE" | "ICON";
  hideHeader?: boolean;
}

export default function CategoriesClient({
  allCategories,
  serializedProducts,
  initialStyle,
  hideHeader = false,
}: CategoriesClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredCategories = allCategories.filter((cat) => {
    const matchesSearch =
      cat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && cat.status === "active") ||
      (statusFilter === "inactive" && cat.status !== "active");
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 fade-in w-full pb-16">
      {!hideHeader && (
        <SellerPageHeader
          title="Categorias"
          badge={
            <span className="px-2 py-0.5 rounded-full text-xs font-sans font-medium tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25">
              {allCategories.length} {allCategories.length === 1 ? "categoria" : "categorias"}
            </span>
          }
          subtitle="Organize seus produtos e facilite a navegação no Mini App."
          actions={<NewCategoryModal storeProducts={serializedProducts} />}
        />
      )}

      {hideHeader && (
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Categorias do Catálogo</h3>
            <p className="text-xs text-zinc-400">Organize os produtos e facilite a navegação no Mini App.</p>
          </div>
          <NewCategoryModal storeProducts={serializedProducts} />
        </div>
      )}

      {/* Category Display Style Selector */}
      <CategoryStyleToggle initialStyle={initialStyle} />

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#171717] p-3 sm:p-4 border border-white/[0.08] rounded-2xl shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar categoria..."
            className="w-full bg-[#111215] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#3984FF] focus:ring-1 focus:ring-[#3984FF] transition-all placeholder:text-zinc-600 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#111215] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#3984FF] appearance-none min-w-[120px] cursor-pointer"
          >
            <option value="all">Todos Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      {/* Categories List — Desktop Table (>= md) & Mobile Cards (< md) */}
      <div className="bg-[#171717] border border-white/[0.08] rounded-2xl shadow-xl relative min-h-[260px] overflow-hidden">
        {filteredCategories.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                <Tags className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-zinc-300 font-medium text-base mb-1">Nenhuma categoria encontrada</p>
              <p className="text-zinc-600 text-sm max-w-sm mb-6">Você precisa de categorias para organizar seus produtos na vitrine da loja.</p>
              <NewCategoryModal isCard storeProducts={serializedProducts} />
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar rounded-2xl min-h-[240px] pb-28">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 text-xs font-medium uppercase tracking-wider bg-white/[0.01]">
                    <th className="w-12 py-4 pl-4 text-center">Pos</th>
                    <th className="py-4 pl-4">Categoria</th>
                    <th className="py-4">URL (Slug)</th>
                    <th className="py-4">Status</th>
                    <th className="py-4">Produtos</th>
                    <th className="py-4 text-right pr-6">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {filteredCategories.map((cat) => {
                    const productCount = serializedProducts.filter((p: any) => p.categoryId === cat.id).length;
                    return (
                      <tr key={cat.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 pl-4 text-center">
                          <button className="text-zinc-600 hover:text-white cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-white/5">
                            <GripVertical className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="py-4 pl-4">
                          <div className="flex items-center gap-3">
                            {cat.imageUrl ? (
                              <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 rounded-lg object-contain bg-[#1A1A1E] border border-white/10 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5 shrink-0">
                                <ImageIcon className="w-4 h-4 text-zinc-600" />
                              </div>
                            )}
                            <div>
                              <p className="text-zinc-200 font-medium">{cat.name || "Sem nome"}</p>
                              <p className="text-zinc-500 text-xs truncate max-w-[200px]">{cat.description || "Sem descrição"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-zinc-500 font-mono text-xs">/{cat.slug}</td>
                        <td className="py-4">
                          {cat.status === 'active' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                              <span className="text-emerald-400 text-xs font-medium">Ativa</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                              <span className="text-zinc-500 text-xs font-medium">Inativa</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-zinc-400 font-medium">
                          <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-white font-bold">
                            {productCount} {productCount === 1 ? "produto" : "produtos"}
                          </span>
                        </td>
                        <td className="py-4 text-right pr-6 relative">
                          <CategoryActionsMenu category={cat} storeProducts={serializedProducts} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="block md:hidden space-y-3 p-3">
              {filteredCategories.map((cat) => {
                const productCount = serializedProducts.filter((p: any) => p.categoryId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="bg-[#18181C] border border-white/5 rounded-xl p-3.5 space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.name || "Categoria"} className="w-10 h-10 rounded-lg object-contain bg-[#121214] border border-white/10 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-white/5 shrink-0">
                            <ImageIcon className="w-4 h-4 text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{cat.name || "Sem nome"}</p>
                          <p className="text-zinc-500 font-mono text-[11px] truncate">/{cat.slug}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 relative">
                        <CategoryActionsMenu category={cat} storeProducts={serializedProducts} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      {cat.status === 'active' ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-emerald-400 font-medium text-[11px]">Ativa</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                          <span className="text-zinc-500 font-medium text-[11px]">Inativa</span>
                        </div>
                      )}

                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[11px] text-zinc-300 font-medium">
                        {productCount} {productCount === 1 ? "produto" : "produtos"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

