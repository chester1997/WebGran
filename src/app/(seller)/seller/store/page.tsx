import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Store as StoreIcon, Globe, Bot, Bell, ExternalLink, Copy, HelpCircle, ArrowRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotSettingsModal } from "./BotSettingsModal";

export default async function SellerStorePage() {
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <StoreIcon className="w-16 h-16 text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Loja não encontrada</h2>
        <p className="text-zinc-400 max-w-md">Ocorreu um problema ao localizar os dados da sua loja.</p>
      </div>
    );
  }

  // Load bot
  const bot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.storeId, store.id)
  });

  const domain = "https://webgran.com"; // placeholder
  const storeUrl = `${domain}/s/${store.slug}`;

  return (
    <div className="space-y-6 fade-in max-w-[1200px] w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Sua Loja & Bot</h2>
          <p className="text-zinc-400 text-sm mt-1">Plano BUSINESS — 1/1 bot disponível</p>
        </div>
        <BotSettingsModal store={store} bot={bot} />
      </div>

      <div className="space-y-6">
        
        {/* Loja Geral Link */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-white text-sm">Loja Geral (sem bot)</h3>
              <p className="text-xs text-zinc-500">Link único da sua loja web — funciona sem Telegram, exibe todos os produtos.</p>
            </div>
          </div>
          
          <div className="bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-zinc-300 truncate font-mono">{storeUrl}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:text-white hover:bg-white/5">
              <Copy className="w-4 h-4 mr-2" /> Copiar
            </Button>
            <Button variant="outline" className="bg-[#1A1A1E] border-white/5 text-zinc-300 hover:text-white hover:bg-white/5">
              <ExternalLink className="w-4 h-4 mr-2" /> Abrir
            </Button>
          </div>
        </div>

        {/* Bot Conectado */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 flex items-center gap-4 border-b border-white/5 bg-gradient-to-r from-violet-600/10 to-transparent">
            <div className="w-14 h-14 rounded-xl bg-[#1A1A1E] border border-white/10 flex items-center justify-center shrink-0">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Bot className="w-7 h-7 text-violet-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-lg tracking-tight uppercase">{store.name}</h3>
              <p className="text-sm text-violet-400 font-medium">@{bot ? bot.username : "Nenhum bot conectado"}</p>
            </div>
          </div>
          
          {bot ? (
            <div className="p-6 grid gap-6 md:grid-cols-2">
              {/* Bot Link */}
              <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Link do Bot no Telegram</span>
                </div>
                <div className="text-sm text-white font-mono bg-[#121214] p-3 rounded-lg mb-4 truncate border border-white/5">
                  https://t.me/{bot.username}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" className="bg-[#121214] border-white/5 hover:bg-white/5">
                    <Copy className="w-3 h-3 mr-2" /> Copiar link
                  </Button>
                  <Button variant="outline" size="sm" className="bg-[#121214] border-white/5 hover:bg-white/5">
                    <ExternalLink className="w-3 h-3 mr-2" /> Abrir no Telegram
                  </Button>
                </div>
              </div>

              {/* Mini App Link */}
              <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Loja deste bot (Mini App)</span>
                </div>
                <div className="text-sm text-white font-mono bg-[#121214] p-3 rounded-lg mb-4 truncate border border-white/5">
                  https://t.me/{bot.username}/app
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" className="bg-[#121214] border-white/5 hover:bg-white/5">
                    <Copy className="w-3 h-3 mr-2" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" className="bg-[#121214] border-white/5 hover:bg-white/5">
                    <ExternalLink className="w-3 h-3 mr-2" /> Abrir loja
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 border border-white/5">
                <Bot className="w-8 h-8 text-zinc-500" />
              </div>
              <h4 className="text-zinc-200 font-bold mb-2">Nenhum Bot Conectado</h4>
              <p className="text-zinc-500 text-sm mb-6 max-w-sm">Para vender dentro do Telegram automaticamente, você precisa vincular um bot criado no BotFather.</p>
              <BotSettingsModal store={store} bot={bot} triggerText="Conectar Agora" />
            </div>
          )}
        </div>

        {/* Notificações de Venda */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Notificações de venda</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            Receba uma mensagem no Telegram cada vez que um cliente efetuar uma compra. Para descobrir seu ID, envie <span className="text-violet-400 font-mono bg-violet-500/10 px-1 rounded">/start</span> para @userinfobot.
          </p>
          
          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder="Seu Telegram ID (ex: 123456789)"
              className="flex-1 bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-zinc-600"
            />
            <Button className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-6">
              Salvar
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Como criar um bot</h3>
          </div>
          
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">1.</span>
              <p>Abra o Telegram e procure por <span className="text-white font-semibold">@BotFather</span></p>
            </div>
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">2.</span>
              <p>Envie o comando <span className="text-white font-mono bg-white/5 px-1 rounded">/newbot</span> e siga as instruções</p>
            </div>
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">3.</span>
              <p>Copie o token gerado (parece com <span className="text-zinc-500 font-mono">123456:ABC-DEF...</span>)</p>
            </div>
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">4.</span>
              <p>Clique no botão "Adicionar bot" no topo desta página e cole o token.</p>
            </div>
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">5.</span>
              <p>Personalize o nome e logo para deixar com a cara da sua loja.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
