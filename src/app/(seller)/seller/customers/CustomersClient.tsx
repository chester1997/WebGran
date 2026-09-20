"use client";

import { useState } from "react";
import { 
  Search, 
  Users, 
  UserCheck, 
  Send, 
  X, 
  ExternalLink, 
  Calendar, 
  Globe, 
  Hash, 
  User, 
  CheckCircle2 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomerItem {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  newThisMonth: number;
  withUsername: number;
}

interface Props {
  customers: CustomerItem[];
  stats: Stats;
}

export default function CustomersClient({ customers, stats }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  const queryLower = searchQuery.toLowerCase().trim();

  const filteredCustomers = customers.filter((c) => {
    if (!queryLower) return true;
    const fullName = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
    const username = (c.username || "").toLowerCase();
    const telegramId = (c.telegramUserId || "").toLowerCase();
    return fullName.includes(queryLower) || username.includes(queryLower) || telegramId.includes(queryLower);
  });

  return (
    <div className="space-y-8 fade-in w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Users className="w-7 h-7 text-red-500" />
          Clientes
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          Gerencie a base de usuários do seu Mini App no Telegram.
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Total de Clientes</span>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-[11px] text-zinc-500">Usuários cadastrados no Mini App</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-red-500" />
          </div>
        </div>

        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Novos Este Mês</span>
            <p className="text-2xl font-bold text-white">{stats.newThisMonth}</p>
            <p className="text-[11px] text-emerald-400 font-medium">Cadastros nos últimos 30 dias</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Com @Username</span>
            <p className="text-2xl font-bold text-white">{stats.withUsername}</p>
            <p className="text-[11px] text-zinc-500">
              {stats.total > 0 ? `${Math.round((stats.withUsername / stats.total) * 100)}% da base` : "0% da base"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Send className="w-6 h-6 text-red-400" />
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-[#121214] border border-white/5 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, @username ou ID..." 
            className="w-full bg-[#18181C] border border-white/10 rounded-xl py-2.5 pl-10 pr-9 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-xs text-zinc-400 flex items-center gap-2 self-end sm:self-auto font-mono">
          <span>Exibindo:</span>
          <span className="bg-red-500/10 text-red-400 px-2.5 py-1 rounded-lg border border-red-500/20 font-bold">
            {filteredCustomers.length} cliente{filteredCustomers.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-zinc-400 text-[11px] font-semibold uppercase tracking-wider bg-[#18181C]">
                <th className="py-4 pl-6">Cliente</th>
                <th className="py-4">Username Telegram</th>
                <th className="py-4">Telegram ID</th>
                <th className="py-4">Idioma</th>
                <th className="py-4">Data Cadastro</th>
                <th className="py-4 text-right pr-6">Ações</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-white/5">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-800/40 flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                        <Users className="w-8 h-8 text-zinc-500" />
                      </div>
                      <p className="text-zinc-300 font-semibold text-sm mb-1">Nenhum cliente encontrado</p>
                      <p className="text-zinc-500 text-xs max-w-xs">
                        {searchQuery ? "Nenhum resultado corresponde à sua busca." : "Quando os usuários interagirem com seu Mini App no Telegram, eles aparecerão aqui automaticamente."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const initial = (c.firstName?.[0] || c.username?.[0] || 'U').toUpperCase();
                  const fullName = `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Usuário Telegram";

                  return (
                    <tr key={c.id} className="group hover:bg-white/[0.02] transition-colors">
                      {/* Customer Name & Avatar */}
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          {c.photoUrl ? (
                            <img src={c.photoUrl} alt={fullName} className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 font-bold shrink-0 text-xs">
                              {initial}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-semibold">{fullName}</p>
                            <p className="text-zinc-500 text-[10px] font-mono">ID: {c.telegramUserId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-4">
                        {c.username ? (
                          <a 
                            href={`https://t.me/${c.username}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors font-semibold bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20"
                          >
                            <span>@{c.username}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        ) : (
                          <span className="text-zinc-600 font-mono">-</span>
                        )}
                      </td>

                      {/* Telegram ID */}
                      <td className="py-4 text-zinc-300 font-mono text-xs">
                        {c.telegramUserId}
                      </td>

                      {/* Language Code */}
                      <td className="py-4">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400 uppercase">
                          {c.languageCode || 'pt-br'}
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td className="py-4 text-zinc-400">
                        {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right pr-6">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCustomer(c)}
                          className="bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10 text-xs px-3 py-1 rounded-lg cursor-pointer"
                        >
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-red-500/30 bg-red-500/10 flex items-center justify-center shrink-0">
                {selectedCustomer.photoUrl ? (
                  <img src={selectedCustomer.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-red-400">
                    {(selectedCustomer.firstName?.[0] || 'U').toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                {selectedCustomer.username ? (
                  <p className="text-xs text-red-400 font-semibold">@{selectedCustomer.username}</p>
                ) : (
                  <p className="text-xs text-zinc-500">Sem @username público</p>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-[#18181C] rounded-xl border border-white/5">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-red-400" /> ID do Telegram
                </span>
                <span className="font-mono text-white font-bold">{selectedCustomer.telegramUserId}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#18181C] rounded-xl border border-white/5">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-red-400" /> Idioma
                </span>
                <span className="font-mono text-white font-semibold uppercase">{selectedCustomer.languageCode || 'pt-br'}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#18181C] rounded-xl border border-white/5">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-red-400" /> Data de Cadastro
                </span>
                <span className="text-white font-medium">
                  {new Date(selectedCustomer.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center gap-3">
              {selectedCustomer.username && (
                <a
                  href={`https://t.me/${selectedCustomer.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Abrir Conversa no Telegram</span>
                </a>
              )}
              <Button
                variant="outline"
                onClick={() => setSelectedCustomer(null)}
                className="bg-white/5 hover:bg-white/10 text-white border-white/10 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
