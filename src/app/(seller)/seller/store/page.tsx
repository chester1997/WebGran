import { connection } from "next/server";
import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { stores, telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotSettingsModal } from "./BotSettingsModal";
import { BotCard } from "./BotCard";
import { SupportContactForm } from "./SupportContactForm";
import SellerPageHeader from "@/components/layout/SellerPageHeader";

import SetupStoreClient from "../SetupStoreClient";

export default async function SellerStorePage() {
  await connection();
  const user = await requireSeller();
  const store = await getCurrentStore();

  if (!store) {
    return <SetupStoreClient />;
  }

  // Load bots with notification recipients
  const bots = await db.query.telegramBots.findMany({
    where: eq(telegramBots.storeId, store.id),
    with: {
      notificationRecipients: true,
    },
  });

  const enrichedBots = bots.map((bot) => {
    const recipients = (bot as any).notificationRecipients || [];
    const activeRecipients = recipients.filter((r: any) => r.status === "active");
    const hasBlocked = recipients.some((r: any) => r.status === "blocked") || bot.status === "invalid_token";
    let notificationStatus: "active" | "disconnected" | "reconnect" = "disconnected";
    if (hasBlocked) {
      notificationStatus = "reconnect";
    } else if (activeRecipients.length > 0) {
      notificationStatus = "active";
    }
    return {
      ...bot,
      notificationStatus,
      notificationRecipients: recipients,
    };
  });

  return (
    <div className="space-y-6 fade-in w-full">
      {/* Header Padronizado */}
      <SellerPageHeader
        title="Bots Telegram"
        badge={
          <span className="px-2 py-0.5 rounded-full text-xs font-sans font-medium tabular-nums bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25">
            {bots.length} {bots.length === 1 ? "bot" : "bots"}
          </span>
        }
        subtitle={`Plano BUSINESS — ${bots.length}/5 bots conectados à sua loja.`}
        actions={<BotSettingsModal store={store} triggerText="+ Adicionar bot" />}
      />

      <div className="space-y-6">
        
        {/* Bots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {enrichedBots.map((bot) => (
            <BotCard key={bot.id} store={store} bot={bot} />
          ))}

          {/* Add Bot Card (Empty State Trigger) */}
          <BotSettingsModal store={store} triggerText="Adicionar bot" isCard={true} />
        </div>

        {/* Contato de Suporte ao Cliente */}
        <SupportContactForm initialSupportContactUrl={store.supportValue || ""} />

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
