"use client";

import { useState, useMemo } from "react";
import {
  UserCheck,
  AtSign,
  Store,
  Search,
  Calendar,
  Copy,
  Check,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Users
} from "lucide-react";

export interface CustomerItem {
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
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredCustomers = useMemo(() => {
    return initialCustomers.filter((c) => {
      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      const term = searchTerm.toLowerCase();

      return (
        fullName.includes(term) ||
        (c.username && c.username.toLowerCase().includes(term)) ||
        c.telegramUserId.includes(term) ||
        (c.storeName && c.storeName.toLowerCase().includes(term))
      );
    });
  }, [initialCustomers, searchTerm]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const totalCustomers = initialCustomers.length;
  const customersWithUsername = initialCustomers.filter((c) => c.username).length;
  const storesWithCustomers = new Set(initialCustomers.filter((c) => c.storeName).map((c) => c.storeName)).size;

  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12 text-zinc-100 fade-in">
      {/* ==================================================== */}
      {/* 1. HEADER (Integrado ao fundo, sem caixa card) */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Clientes Telegram (Globais)
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Consumidores da Rede
            </span>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Base consolidada de compradores e usuários que interagiram com os bots do Telegram
          </p>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. SUMMARY KPI CARDS */}
      {/* ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total de Clientes */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-blue-500/30 shadow-lg shadow-blue-500/5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Total de Clientes
            </span>
            <div className="p-2 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {totalCustomers.toLocaleString("pt-BR")}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Compradores únicos cadastrados
          </span>
        </div>

        {/* Com @Username */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Com @Username Público
            </span>
            <div className="p-2 rounded-xl border bg-white/5 border-white/[0.08] text-zinc-300 shrink-0">
              <AtSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {customersWithUsername.toLocaleString("pt-BR")}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Possuem identificador no Telegram
          </span>
        </div>

        {/* Lojas com Atendimento */}
        <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/[0.08] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider truncate">
              Lojas com Atendimento
            </span>
            <div className="p-2 rounded-xl border bg-white/5 border-white/[0.08] text-zinc-300 shrink-0">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight block">
            {storesWithCustomers}
          </span>
          <span className="text-[10px] text-zinc-500 block truncate pt-0.5">
            Lojas com clientes registrados
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. TOOLBAR: SEARCH & COUNT */}
      {/* ==================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#0F1014] rounded-2xl border border-white/[0.08]">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por nome, @username, ID Telegram ou loja..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 bg-[#15171D] border border-white/[0.08] focus:border-blue-500 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-[11px] text-zinc-400 whitespace-nowrap">
          {filteredCustomers.length} cliente(s) encontrado(s)
        </span>
      </div>

      {/* ==================================================== */}
      {/* 4. CUSTOMERS TABLE */}
      {/* ==================================================== */}
      <div className="bg-[#0F1014] rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Lista de Clientes ({filteredCustomers.length})
          </h2>
          <span className="text-[11px] text-zinc-500 font-mono">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-400 text-[11px] font-semibold uppercase tracking-wider bg-white/[0.02]">
                <th className="py-3 px-4">Cliente Telegram</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Telegram ID</th>
                <th className="py-3 px-4">Loja Vínculo</th>
                <th className="py-3 px-4 text-right">Data de Entrada</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {paginatedCustomers.map((cust) => (
                <tr
                  key={cust.id}
                  onClick={() => setSelectedCustomer(cust)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  {/* Avatar & Nome */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0 overflow-hidden">
                        {cust.photoUrl ? (
                          <img
                            src={cust.photoUrl}
                            alt={cust.firstName || "Cliente"}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          (cust.firstName?.[0] || "C").toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-xs truncate max-w-[140px] sm:max-w-[180px]">
                          {cust.firstName ? `${cust.firstName} ${cust.lastName || ""}`.trim() : "Cliente Telegram"}
                        </p>
                        <span className="text-[10px] text-zinc-500 block truncate">Consumidor</span>
                      </div>
                    </div>
                  </td>

                  {/* Username */}
                  <td className="py-3 px-4 font-semibold text-blue-400">
                    {cust.username ? (
                      `@${cust.username}`
                    ) : (
                      <span className="text-zinc-600 font-normal italic">-</span>
                    )}
                  </td>

                  {/* Telegram User ID */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(cust.telegramUserId, e)}
                      title="Clique para copiar Telegram ID"
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-300 bg-[#15171D] hover:bg-white/10 px-2 py-1 rounded-lg border border-white/[0.08] transition-colors"
                    >
                      <span>{cust.telegramUserId}</span>
                      {copiedId === cust.telegramUserId ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                      )}
                    </button>
                  </td>

                  {/* Loja */}
                  <td className="py-3 px-4">
                    {cust.storeName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-zinc-300 border border-white/[0.08]">
                        <Store className="w-3 h-3 text-zinc-500" />
                        <span className="truncate max-w-[140px]">{cust.storeName}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600 italic">Desconhecida</span>
                    )}
                  </td>

                  {/* Data */}
                  <td className="py-3 px-4 text-right text-zinc-400 font-mono text-[11px]">
                    <div className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-600" />
                      <span>{cust.createdAt}</span>
                    </div>
                  </td>

                  {/* Ações */}
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomer(cust);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-600/20 text-zinc-400 hover:text-blue-300 transition-colors cursor-pointer"
                      title="Ver Detalhes do Cliente"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="w-8 h-8 text-zinc-600" />
                      <p className="text-xs text-zinc-400 font-medium">
                        Nenhum cliente encontrado para a busca especificada.
                      </p>
                      {searchTerm && (
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setCurrentPage(1);
                          }}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                        >
                          Limpar busca
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 border-t border-white/[0.06] text-xs">
            <span className="text-zinc-500 text-[11px]">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
              {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} de {filteredCustomers.length} clientes
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-[#15171D] border border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-mono text-zinc-300">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-[#15171D] border border-white/[0.08] text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Próxima página"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. CUSTOMER DETAILS MODAL */}
      {/* ==================================================== */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCustomer(null)}
          />

          <div className="relative w-full max-w-md bg-[#0F1014] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#0F1014]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Perfil do Cliente Telegram</h3>
                  <p className="text-[11px] text-zinc-400">Dados cadastrados na interação via bot</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Profile Card */}
              <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#15171D] border border-white/[0.06]">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-base shrink-0 overflow-hidden">
                  {selectedCustomer.photoUrl ? (
                    <img
                      src={selectedCustomer.photoUrl}
                      alt={selectedCustomer.firstName || "Cliente"}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    (selectedCustomer.firstName?.[0] || "C").toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-white block truncate">
                    {selectedCustomer.firstName ? `${selectedCustomer.firstName} ${selectedCustomer.lastName || ""}`.trim() : "Cliente Telegram"}
                  </span>
                  {selectedCustomer.username ? (
                    <span className="text-xs text-blue-400 block font-medium">@{selectedCustomer.username}</span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 block italic">Sem username público</span>
                  )}
                </div>
              </div>

              {/* Information Grid */}
              <div className="space-y-2.5">
                {/* Telegram ID */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Telegram User ID:</span>
                  <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                    <span>{selectedCustomer.telegramUserId}</span>
                    <button
                      onClick={() => handleCopyId(selectedCustomer.telegramUserId)}
                      className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                      title="Copiar ID"
                    >
                      {copiedId === selectedCustomer.telegramUserId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Loja Vínculo */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Loja de Origem:</span>
                  <span className="font-semibold text-white">
                    {selectedCustomer.storeName || "Desconhecida"}
                  </span>
                </div>

                {/* Data de Entrada */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-zinc-400">Data de Registro:</span>
                  <span className="font-mono text-zinc-200">{selectedCustomer.createdAt}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-5 py-3 border-t border-white/[0.08] bg-[#0F1014]">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
