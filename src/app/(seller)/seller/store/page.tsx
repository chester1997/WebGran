export const instant = false;
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Store as StoreIcon, Globe, Bot, Bell, ExternalLink, Copy, HelpCircle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotSettingsModal } from "./BotSettingsModal";
import { BotCard } from "./BotCard";

import SetupStoreClient from "../SetupStoreClient";

export default async function SellerStorePage() {
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
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
            <BotCard key={bot.id} store={store} bot={bot} />
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
