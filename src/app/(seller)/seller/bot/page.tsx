import { getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramBots } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConnectBotForm, DisconnectBotButton } from "./BotClient";

export default async function BotPage() {
  const store = await getCurrentStore();
  let bot = null;

  if (store) {
    const result = await db.query.telegramBots.findFirst({
      where: eq(telegramBots.storeId, store.id)
    });
    bot = result || null;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold tracking-tight">Meu Bot</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Status do Bot
            {bot ? <Badge className="bg-green-600">Conectado</Badge> : <Badge variant="destructive">Desconectado</Badge>}
          </CardTitle>
          <CardDescription>
            Conecte seu bot do Telegram via @BotFather para receber os acessos dos seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bot ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome (Display Name)</Label>
                  <p className="font-medium">{bot.displayName || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Username</Label>
                  <p className="font-medium">@{bot.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bot ID</Label>
                  <p className="font-medium">{bot.botId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Loja Vinculada</Label>
                  <p className="font-medium">{store?.name || "-"}</p>
                </div>
              </div>
              <DisconnectBotButton />
            </div>
          ) : (
            <ConnectBotForm />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
