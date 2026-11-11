"use client";

import { useRouter, useSearchParams } from "next/navigation";
import NewBotModal, { NewBotFlow } from "../components/NewBotModal";

export default function NewBotClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const flowParam = searchParams.get("flow") as NewBotFlow | null;

  const initialStep = stepParam === "3" ? 3 : stepParam === "2.5" ? 2.5 : stepParam === "2" ? 2 : 1;
  const initialFlow: NewBotFlow = flowParam === "token" ? "token" : "telegram";
  const initialBot = stepParam === "3" ? {
    numericId: "1234567890",
    username: initialFlow === "telegram" ? "novocriadobot_bot" : "existente_bot",
    firstName: initialFlow === "telegram" ? "Novo Bot Telegram" : "Bot Existente VIP",
    photoUrl: null
  } : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <NewBotModal
        isOpen={true}
        initialStep={initialStep}
        initialFlow={initialFlow}
        initialValidatedBot={initialBot}
        onClose={() => router.push("/seller/bots")}
        onBotCreated={(botId) => router.push(`/seller/bots/${botId}`)}
      />
    </div>
  );
}
