import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function MiniAppRootPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  
  const rawParam = (resolvedParams.b || resolvedParams.tgWebAppStartParam || resolvedParams.startapp || "") as string;

  let botId: string | null = null;
  let productSlug: string | null = null;

  if (rawParam) {
    if (rawParam.includes("_p_")) {
      const parts = rawParam.split("_p_");
      botId = parts[0].replace(/^b_/, "");
      productSlug = parts[1];
    } else if (rawParam.startsWith("p_") || rawParam.startsWith("prod_")) {
      productSlug = rawParam.replace(/^(p_|prod_)/, "");
    } else {
      botId = rawParam.replace(/^b_/, "");
    }
  }

  const bot = await db.query.telegramBots.findFirst({
    where: botId 
      ? (bots, { eq, or }) => or(eq(bots.id, botId!), eq(bots.botId, botId!))
      : undefined,
    with: {
      store: true
    }
  });

  if (!bot || !bot.store) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <h1 className="text-white font-bold">Loja ou Bot não encontrado.</h1>
      </div>
    );
  }

  const targetPath = productSlug
    ? `/miniapp/${bot.store.slug}/product/${productSlug}`
    : `/miniapp/${bot.store.slug}`;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var target = ${JSON.stringify(targetPath)} + window.location.search + window.location.hash;
            window.location.replace(target);
          })();
        `,
      }}
    />
  );
}
