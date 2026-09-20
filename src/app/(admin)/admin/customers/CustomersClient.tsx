"use client";

import { useState } from "react";
import { UserCheck, AtSign, Store, Search, Calendar, MessageSquare } from "lucide-react";

interface CustomerItem {
  id: string;
  telegramUserId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  createdAt: string;
  storeName: string | null;
}

export default function CustomersClient({ initialCustomers }: { initialCustomers: CustomerItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCustomers = initialCustomers.filter((c) => {
    const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    return (
      fullName.includes(searchLower) ||
      (c.username && c.username.toLowerCase().includes(searchLower)) ||
      c.telegramUserId.includes(searchLower) ||
      (c.storeName && c.storeName.toLowerCase().includes(searchLower))
    );
  });

  const totalCustomers = initialCustomers.length;
  const customersWithUsername = initialCustomers.filter((c) => c.username).length;
  const storesWithCustomers = new Set(initialCustomers.filter((c) => c.storeName).map((c) => c.storeName)).size;

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Clientes Telegram (Globais)</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full">
              Consumidores
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Base consolidada de clientes que interagiram com os bots do Telegram
          </p>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, @username ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total de Clientes</span>
            <span className="text-3xl font-black text-white mt-1 block">{totalCustomers}</span>
          </div>
          <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Com Username</span>
            <span className="text-3xl font-black text-sky-400 mt-1 block">{customersWithUsername}</span>
          </div>
          <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
            <AtSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Lojas com Atendimento</span>
            <span className="text-3xl font-black text-purple-400 mt-1 block">{storesWithCustomers}</span>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Store className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Lista de Clientes</h2>
          <span className="text-xs text-gray-400">{filteredCustomers.length} cliente(s) encontrado(s)</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-gray-400 text-xs font-semibold">
                <th className="pb-3 px-3">Cliente Telegram</th>
                <th className="pb-3 px-3">Username</th>
                <th className="pb-3 px-3">Telegram ID</th>
                <th className="pb-3 px-3">Loja Vínculo</th>
                <th className="pb-3 px-3 text-right">Data de Entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/50 text-xs">
              {filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-[#18181B]/60 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs flex-shrink-0">
                        {cust.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cust.photoUrl} alt={cust.firstName || "Cliente"} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          (cust.firstName?.[0] || "C").toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">
                          {cust.firstName ? `${cust.firstName} ${cust.lastName || ""}` : "Cliente Telegram"}
                        </p>
                        <span className="text-[10px] text-gray-400">Usuário Final</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-sky-400">
                    {cust.username ? `@${cust.username}` : <span className="text-gray-500 font-normal italic">-</span>}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-[11px] text-gray-300">
                    <span className="bg-[#18181B] px-2 py-0.5 rounded border border-[#27272A]">
                      {cust.telegramUserId}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    {cust.storeName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Store className="w-3 h-3" />
                        {cust.storeName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500 italic">Desconhecida</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right text-gray-400 font-medium">
                    <div className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{cust.createdAt}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 text-xs">
                    Nenhum cliente encontrado para a busca especificada.
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
