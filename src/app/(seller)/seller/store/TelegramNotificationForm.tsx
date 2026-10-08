"use client";

import React, { useState } from "react";
import { Bell, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveTelegramNotificationIdAction } from "./actions";

interface TelegramNotificationFormProps {
  initialTelegramId: string;
}

export function TelegramNotificationForm({ initialTelegramId }: TelegramNotificationFormProps) {
  const [telegramId, setTelegramId] = useState(initialTelegramId || "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSaving(true);

    try {
      const res = await saveTelegramNotificationIdAction(telegramId);
      if (res?.success) {
        setSuccessMsg("Telegram ID salvo com sucesso!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar Telegram ID.");
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-zinc-400" />
        <h3 className="font-bold text-white text-sm">Notificações de venda</h3>
      </div>
      <p className="text-xs text-zinc-500">
        Receba uma mensagem no Telegram cada vez que um cliente efetuar uma compra. Para descobrir seu ID, envie{" "}
        <span className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">/start</span> para{" "}
        <span className="text-white font-medium">@userinfobot</span>.
      </p>

      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <input
          type="text"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          placeholder="Seu Telegram ID (ex: 123456789)"
          className="flex-1 bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
        />
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 h-[46px]"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
