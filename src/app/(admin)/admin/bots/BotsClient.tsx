"use client";

import { useState } from "react";
import { Bot, Store, Search, CheckCircle2, XCircle, Calendar } from "lucide-react";

interface BotItem {
  id: string;
  botId: string;
  username: string;
  displayName: string | null;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  storeName: string | null;
  storeSlug: string | null;
}

export default function BotsClient({ initialBots }: { initialBots: BotItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredBots = initialBots.filter(
    (b) =>
      (b.displayName && b.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      b.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.storeName && b.storeName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalBots = initialBots.length;
  const activeBots = initialBots.filter((b) => b.status === "active").length;
  const storesWithBot = new Set(initialBots.filter((b) => b.storeName).map((b) => b.storeName)).size;

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Bots Conectados</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full">
              Telegram Bots
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Monitoramento de todos os bots do Telegram ativos e vinculados a lojas
          </p>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por bot, @username ou loja..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total de Bots</span>
            <span className="text-3xl font-black text-white mt-1 block">{totalBots}</span>
          </div>
          <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
            <Bot className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Bots Ativos</span>
            <span className="text-3xl font-black text-emerald-400 mt-1 block">{activeBots}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141416] p-5 rounded-2xl border border-[#27272A] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Lojas com Bot</span>
            <span className="text-3xl font-black text-purple-400 mt-1 block">{storesWithBot}</span>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Store className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* BOTS TABLE */}
      <div className="bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Lista de Bots</h2>
          <span className="text-xs text-gray-400">{filteredBots.length} bot(s) encontrado(s)</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272A] text-gray-400 text-xs font-semibold">
                <th className="pb-3 px-3">Bot</th>
                <th className="pb-3 px-3">Username</th>
                <th className="pb-3 px-3">Loja Vinculada</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Data de Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/50 text-xs">
              {filteredBots.map((bot) => (
                <tr key={bot.id} className="hover:bg-[#18181B]/60 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-xs flex-shrink-0">
                        {bot.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bot.photoUrl} alt={bot.username} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{bot.displayName || "Bot Telegram"}</p>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {bot.botId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-teal-400">
                    @{bot.username}
                  </td>
                  <td className="py-3.5 px-3">
                    {bot.storeName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Store className="w-3 h-3" />
                        {bot.storeName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500 italic">Sem loja</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3">
                    {bot.status === "active" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        <XCircle className="w-2.5 h-2.5" />
                        {bot.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right text-gray-400 font-medium">
                    <div className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span>{bot.createdAt}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBots.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 text-xs">
                    Nenhum bot encontrado para a busca especificada.
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
