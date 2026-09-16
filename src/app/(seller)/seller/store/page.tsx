import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Store as StoreIcon, Globe, Bot, Bell, ExternalLink, Copy, HelpCircle, Info, Trash2 } from "lucide-react";
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

  // Load bots (now an array as the UI suggests multiple bots side-by-side)
  const bots = await db.query.telegramBots.findMany({
    where: eq(telegramBots.storeId, store.id)
  });

  const domain = "https://webgran.com"; // placeholder
  const storeUrl = `${domain}/s/${store.slug}`;

  return (
    <div className="space-y-6 fade-in w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Bots Telegram</h2>
          <p className="text-zinc-400 text-sm mt-1">Plano BUSINESS — {bots.length}/5 bots</p>
        </div>
        <BotSettingsModal store={store} triggerText="+ Adicionar bot" />
      </div>

      <div className="space-y-6">
        
        {/* Bots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <div key={bot.id} className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col">
              {/* Card Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#1A1A1E] overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
                  {store.logoUrl ? (
                    <img src={store.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  ) : (
                    <Bot className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-base uppercase leading-tight truncate">{store.name}</h3>
                  <p className="text-zinc-400 text-sm truncate">@{bot.username}</p>
                </div>
              </div>

              {/* Separator */}
              <div className="h-1 bg-blue-600 rounded-full w-full mb-5 shadow-[0_0_10px_rgba(139,92,246,0.3)]"></div>

              {/* Telegram Link Block */}
              <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-400">Link do Bot no Telegram</span>
                </div>
                <p className="text-sm font-medium text-white mb-3 truncate">https://t.me/{bot.username}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-9">
                    <Copy className="w-3 h-3 mr-2" /> Copiar link
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-9">
                    <ExternalLink className="w-3 h-3 mr-2" /> Abrir no Telegram
                  </Button>
                </div>
              </div>

              {/* Mini App Link Block */}
              <div className="bg-[#1A1A1E] border border-white/5 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-400">Loja deste bot (fora do Telegram)</span>
                </div>
                <p className="text-sm font-medium text-white mb-3 truncate">https://{domain}/miniapp?b={bot.id}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-9">
                    <Copy className="w-3 h-3 mr-2" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 h-9">
                    <ExternalLink className="w-3 h-3 mr-2" /> Abrir loja
                  </Button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-2 mt-auto">
                <BotSettingsModal 
                  store={store} 
                  bot={bot} 
                  triggerText="Editar" 
                  className="flex-1 bg-transparent border border-white/10 hover:bg-white/5 text-white"
                />
                <Button variant="outline" size="icon" className="shrink-0 bg-transparent border-white/10 text-zinc-400 hover:text-white h-9 w-9">
                  <Info className="w-4 h-4" />
                </Button>
                <Button variant="destructive" size="icon" className="shrink-0 bg-red-500 hover:bg-red-600 text-white border-transparent h-9 w-9">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add Bot Card (Empty State Trigger) */}
          <BotSettingsModal store={store} triggerText="Adicionar bot" isCard={true} />
        </div>

        {/* Notificações de Venda */}
        <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-5 h-5 text-zinc-400" />
            <h3 className="font-bold text-white text-sm">Notificações de venda</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            Receba uma mensagem no Telegram cada vez que um cliente efetuar uma compra. Para descobrir seu ID, envie <span className="text-blue-400 font-mono bg-blue-500/10 px-1 rounded">/start</span> para @userinfobot.
          </p>
          
          <div className="flex gap-3">
            <input 
              type="text" 
              placeholder="Seu Telegram ID (ex: 123456789)"
              className="flex-1 bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
            />
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
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
              <p>Copie o token gerado e cole acima</p>
            </div>
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">4.</span>
              <p>Personalize o nome e logo do seu bot</p>
            </div>
            <div className="flex gap-3">
              <span className="font-bold text-zinc-500">5.</span>
              <p>Compartilhe o link do mini app com seus clientes</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
