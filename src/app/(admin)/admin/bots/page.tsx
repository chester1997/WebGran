import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import BotsClient from "./BotsClient";

export default async function AdminBotsPage() {
  await requireAdmin();

  const botsData = await db.query.telegramBots.findMany({
    with: {
      store: true
    },
    orderBy: [desc(telegramBots.createdAt)]
  });

  const formattedBots = botsData.map((b) => ({
    id: b.id,
    botId: b.botId,
    username: b.username,
    displayName: b.displayName,
    photoUrl: b.photoUrl,
    status: b.status,
    createdAt: new Date(b.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    storeName: b.store?.name || null,
    storeSlug: b.store?.slug || null
  }));

  return <BotsClient initialBots={formattedBots} />;
}
