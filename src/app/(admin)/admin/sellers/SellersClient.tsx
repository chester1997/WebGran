"use client";

import { useState } from "react";
import { Users, Building2, Search, Calendar, ShieldCheck, Mail } from "lucide-react";

interface SellerItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  storesCount: number;
  storeNames: string[];
}

export default function SellersClient({ initialSellers }: { initialSellers: SellerItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSellers = initialSellers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSellers = initialSellers.length;
  const sellersWithStores = initialSellers.filter((s) => s.storesCount > 0).length;
  const totalStoresOwned = initialSellers.reduce((acc, curr) => acc + curr.storesCount, 0);

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER & METRICS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Vendedores Globais</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              Lojistas WebGran
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Gestão e acompanhamento de todos os vendedores cadastrados na plataforma
          </p>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total de Vendedores</span>
            <span className="text-3xl font-black text-white mt-1 block">{totalSellers}</span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Vendedores com Loja</span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">{sellersWithStores}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total de Lojas Criadas</span>
            <span className="text-3xl font-black text-purple-400 mt-1 block">{totalStoresOwned}</span>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SELLERS TABLE */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Lista de Vendedores</h2>
          <span className="text-xs text-gray-400">{filteredSellers.length} vendedor(es) encontrado(s)</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-gray-400 text-xs font-semibold">
                <th className="pb-3 px-3">Vendedor</th>
                <th className="pb-3 px-3">E-mail</th>
                <th className="pb-3 px-3">Lojas Vinculadas</th>
                <th className="pb-3 px-3 text-right">Data de Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/50 text-xs">
              {filteredSellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-[#18181B]/60 transition-colors">
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
                  <td className="py-3.5 px-3 text-gray-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-500" />
                      <span>{seller.email}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    {seller.storesCount > 0 ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Building2 className="w-3 h-3" />
                          {seller.storesCount} loja(s)
                        </span>
                        {seller.storeNames.length > 0 && (
                          <span className="text-[10px] text-gray-400 block mt-0.5 truncate max-w-[200px]">
                            {seller.storeNames.join(", ")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500 italic">Sem loja criada</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right text-gray-400 font-medium">
                    <div className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{seller.createdAt}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSellers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500 text-xs">
                    Nenhum vendedor encontrado para a busca especificada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
