import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Store as StoreIcon, Globe, Bot, Bell, ExternalLink, Copy, HelpCircle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotSettingsModal } from "./BotSettingsModal";
import { BotCard } from "./BotCard";
import { TelegramNotificationForm } from "./TelegramNotificationForm";

import SetupStoreClient from "../SetupStoreClient";

export default async function SellerStorePage() {
  await connection();
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
        <TelegramNotificationForm initialTelegramId={store.telegramNotificationId || ""} />

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
