import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Bot, RefreshCw, Send, ShieldAlert, KeyRound, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SellerBotPage() {
  await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <div>Loja não encontrada.</div>;
  }

  // Load bot configuration
  const bot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id)
  });

  return (
    <div className="space-y-8 fade-in max-w-4xl">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Meu Bot Telegram</h2>
        <p className="text-zinc-400 text-sm mt-1">Conecte e gerencie o robô que fará o atendimento e vendas no automático.</p>
      </div>

      {!bot ? (
        /* Empty State / Connect Bot */
        <div className="bg-[#121212] border border-white/5 rounded-3xl p-10 shadow-xl text-center flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50"></div>
          
          <div className="w-20 h-20 rounded-full bg-violet-500/10 flex items-center justify-center border border-violet-500/20 mb-6 relative">
            <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full"></div>
            <Bot className="w-10 h-10 text-violet-400 relative z-10" />
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-2">Conecte seu Robô</h3>
          <p className="text-zinc-400 max-w-md mx-auto mb-8">
            Para começar a vender, você precisa de um Bot. Crie um gratuitamente no <span className="text-white font-medium">@BotFather</span> do Telegram e cole o Token de Acesso abaixo.
          </p>

          <div className="w-full max-w-md bg-[#0A0A0A] p-6 rounded-2xl border border-white/5 shadow-inner text-left mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-zinc-500" /> Token de Acesso (API Token)
            </label>
            <input 
              type="password"
              placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrs..." 
              className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-mono"
            />
            <Button className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 shadow-lg shadow-violet-600/20">
              Conectar Agora
            </Button>
          </div>

          <a href="#" className="text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            Não sabe como criar? Veja o tutorial <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        /* Bot Connected Dashboard */
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Card: Bot Status */}
          <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-violet-600/10 blur-3xl rounded-full"></div>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                  <Bot className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{bot.displayName || "Robô Conectado"}</h3>
                  <p className="text-sm text-zinc-400">@{bot.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-400">Online</span>
              </div>
            </div>

            <div className="space-y-4 bg-[#0A0A0A] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Comandos processados hoje</span>
                <span className="text-sm font-bold text-white">142</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Última sincronização</span>
                <span className="text-sm font-bold text-white">Há 5 minutos</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <span className="text-sm text-zinc-500">Token</span>
                <span className="text-sm font-mono text-zinc-300 tracking-wider">••••••••••••••••</span>
              </div>
            </div>
          </div>

          {/* Card: Actions */}
          <div className="space-y-4">
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl hover:border-violet-500/30 transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-violet-600 transition-colors">
                  <RefreshCw className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Sincronizar Webhook</h4>
                  <p className="text-xs text-zinc-500 mt-1">Reconecta os servidores do Telegram ao WebGran.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 shadow-xl hover:border-blue-500/30 transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <Zap className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Configurar Menu Button</h4>
                  <p className="text-xs text-zinc-500 mt-1">Ajusta o botão esquerdo inferior no app do cliente.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#121212] border border-red-500/10 rounded-2xl p-6 shadow-xl hover:border-red-500/30 transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-600 transition-colors">
                  <ShieldAlert className="w-5 h-5 text-red-400 group-hover:text-white" />
                </div>
                <div>
                  <h4 className="text-red-400 font-medium group-hover:text-white transition-colors">Desconectar Bot</h4>
                  <p className="text-xs text-red-500/70 mt-1 group-hover:text-white/70 transition-colors">Interrompe as vendas imediatamente.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
