import { redirect } from "next/navigation";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function MiniAppRootPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  
  // Try to find botId from query params
  const botId = resolvedParams.b as string;
  
  // Also try tgWebAppStartParam which might be passed by Telegram
  const tgStartParam = resolvedParams.tgWebAppStartParam as string;
  
  const targetId = botId || tgStartParam;

  if (!targetId) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <h1>Loja não especificada. Por favor, acesse pelo bot correto.</h1>
      </div>
    );
  }

  const bot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.id, targetId),
    with: {
      store: true
    }
  });

  if (!bot || !bot.store) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <h1>Loja ou Bot não encontrado.</h1>
      </div>
    );
  }

  redirect(`/miniapp/${bot.store.slug}`);
}
