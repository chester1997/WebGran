"use client";

import { useRouter, useSearchParams } from "next/navigation";
import NewBotModal from "../components/NewBotModal";

export default function NewBotClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");

  const initialStep = stepParam === "3" ? 3 : stepParam === "2" ? 2 : 1;
  const initialBot = stepParam === "3" ? {
    numericId: "1234567890",
    username: "novoloja_bot",
    firstName: "Minha Loja VIP",
    photoUrl: null
  } : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <NewBotModal
        isOpen={true}
        initialStep={initialStep}
        initialValidatedBot={initialBot}
        onClose={() => router.push("/seller/bots")}
        onBotCreated={(botId) => router.push(`/seller/bots/${botId}`)}
      />
    </div>
  );
}
