"use client";

import React, { useState } from "react";
import { LifeBuoy, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSupportContactAction } from "./actions";

interface SupportContactFormProps {
  initialSupportContactUrl: string;
}

export function SupportContactForm({ initialSupportContactUrl }: SupportContactFormProps) {
  const [supportUrl, setSupportUrl] = useState(initialSupportContactUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setSupportUrl(initialSupportContactUrl || "");
  }, [initialSupportContactUrl]);

  const handleSave = async (urlToSave: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSaving(true);

    try {
      const res = await saveSupportContactAction(urlToSave);
      if (res?.success) {
        setSupportUrl(res.supportContactUrl ?? "");
        setSuccessMsg(
          res.supportContactUrl
            ? "Contato de suporte salvo com sucesso!"
            : "Contato de suporte removido com sucesso!"
        );
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar contato de suporte.");
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    await handleSave("");
  };

  return (
    <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white text-sm">Botão de suporte ao cliente</h3>
        </div>
        {supportUrl && (
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            Ativo
          </span>
        )}
      </div>

      <div className="space-y-2 text-xs text-zinc-400 bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
        <p className="leading-relaxed">
          Exiba o botão inline <span className="text-white font-semibold">🆘 SUPORTE</span> na mensagem de pagamento confirmado enviada pelo bot ao comprador no Telegram.
        </p>
        <div className="space-y-1.5 pt-1 text-[11px] text-zinc-400">
          <p>
            ℹ️ <strong className="text-zinc-200">Formatos aceitos:</strong> Link direto do Telegram (<span className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">https://t.me/seu_usuario</span>), username (<span className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">@seu_usuario</span>) ou link HTTPS seguro de atendimento (WhatsApp, helpdesk, etc.).
          </p>
          <p>
            🔒 <strong className="text-zinc-200">Segurança:</strong> Links sem protocolo HTTPS ou com formatos inválidos são bloqueados automaticamente. Se deixado em branco, o botão de suporte é omitido da mensagem sem afetar o botão de acesso.
          </p>
        </div>
      </div>

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
          value={supportUrl}
          onChange={(e) => setSupportUrl(e.target.value)}
          placeholder="Ex: https://t.me/seu_suporte ou @seu_suporte"
          className="flex-1 bg-[#1A1A1E] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600"
        />
        <div className="flex gap-2">
          {supportUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={isSaving}
              className="border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs h-[46px] px-3.5 rounded-lg font-medium"
              title="Remover contato de suporte"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={() => handleSave(supportUrl)}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 h-[46px]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
