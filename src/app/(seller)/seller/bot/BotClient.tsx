"use client";

import { useActionState } from "react";
import { connectTelegramBot, disconnectTelegramBot } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectBotForm() {
  const [state, formAction, isPending] = useActionState(connectTelegramBot, { success: false, error: null });

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="token">Token do Bot (fornecido pelo @BotFather)</Label>
        <Input 
          id="token" 
          name="token" 
          placeholder="1234567890:AAH_..." 
          required 
          disabled={isPending}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Conectando..." : "Conectar Bot"}
      </Button>
    </form>
  );
}

export function DisconnectBotButton() {
  return (
    <Button 
      variant="outline" 
      className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={async () => {
        if(confirm("Tem certeza que deseja desconectar este bot? A loja deixará de funcionar no Telegram.")) {
          await disconnectTelegramBot();
        }
      }}
    >
      Desconectar Bot
    </Button>
  );
}
