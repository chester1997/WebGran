import { Suspense } from "react";
import { connection } from "next/server";
import { requireOwnerAccount } from "@/lib/bots/owner-guard";
import NewBotClient from "./NewBotClient";

export default async function NewBotPage() {
  await connection();
  // Proteção exclusiva da conta proprietária
  await requireOwnerAccount();

  return (
    <Suspense fallback={<div className="p-8 text-zinc-400 text-sm">Carregando assistente de conexão...</div>}>
      <NewBotClient />
    </Suspense>
  );
}
