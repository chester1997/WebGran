"use client";

import { useState, useTransition } from "react";
import { Check, Upload, Plus, Trash2, Loader2, Sparkles, MessageSquare, Send } from "lucide-react";
import { updateWelcomeSettingsAction } from "./actions";
import { parseSupportConfig } from "@/lib/support/support-helper";

interface WelcomeClientProps {
  initialSettings: {
    welcomeMessage: string;
    welcomeBanners: string[];
    supportType: string;
    supportValue: string;
  };
}

export default function WelcomeClient({ initialSettings }: WelcomeClientProps) {
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage || "");
  const [banners, setBanners] = useState<string[]>(
    initialSettings.welcomeBanners.length > 0 ? initialSettings.welcomeBanners : [""]
  );
  const [supportType, setSupportType] = useState(initialSettings.supportType || "telegram");
  const [supportValue, setSupportValue] = useState(initialSettings.supportValue || "");

  const [isUploading, setIsUploading] = useState(false);

  const supportParsed = parseSupportConfig(supportType, supportValue);

  const handleBannerChange = (index: number, val: string) => {
    const updated = [...banners];
    updated[index] = val;
    setBanners(updated);
  };

  const addBannerField = () => {
    if (banners.length < 5) {
      setBanners([...banners, ""]);
    }
  };

  const removeBannerField = (index: number) => {
    if (banners.length === 1) {
      setBanners([""]);
    } else {
      setBanners(banners.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    setSaveError(null);
    startTransition(async () => {
      try {
        const cleanBanners = banners.map(b => b.trim()).filter(Boolean);
        await updateWelcomeSettingsAction({
          welcomeMessage,
          welcomeBanners: cleanBanners,
          supportType,
          supportValue,
        });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } catch (err: unknown) {
        console.error("Error saving welcome settings:", err);
        setSaveError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Boas-vindas
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Mensagem e banners exibidos no Mini App e no bot
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 shrink-0"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Salvo com sucesso!</span>
              </>
            ) : (
              <span>Salvar alterações</span>
            )}
          </button>
          {saveError && (
            <span className="text-xs text-red-400 font-medium">{saveError}</span>
          )}
        </div>
      </div>

      {/* Card 1: Banner de boas-vindas */}
      <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl relative overflow-hidden">
        <div>
          <h2 className="text-base font-semibold text-white">Banner de boas-vindas</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Imagem enviada junto com a mensagem de boas-vindas do seu bot no Telegram.
          </p>
        </div>

        <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Este banner será enviado automaticamente junto com a mensagem de boas-vindas do seu bot no Telegram.</span>
        </div>

        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div key={index} className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium flex items-center justify-between">
                <span>Banner {index + 1} {index === 0 && "(Principal)"}</span>
                {banners.length > 1 && (
                  <button
                    onClick={() => removeBannerField(index)}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                )}
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={banner}
                  onChange={(e) => handleBannerChange(index, e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="flex-1 bg-[#16161A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/60 transition-all font-mono"
                />

                <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-300 font-medium flex items-center gap-2 transition-all shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      setIsUploading(true);
                      const formData = new FormData();
                      formData.append("file", file);

                      try {
                        const res = await fetch("/api/upload", {
                          method: "POST",
                          body: formData,
                        });
                        const data = await res.json();
                        if (data.url) {
                          handleBannerChange(index, data.url);
                        }
                      } catch (err) {
                        console.error("Upload error:", err);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  />
                </label>
              </div>

              {banner && (
                <div className="relative aspect-video max-w-sm rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  <img
                    src={banner}
                    alt={`Preview Banner ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          {banners.length < 5 && (
            <button
              onClick={addBannerField}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 py-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar outro banner (máximo 5)</span>
            </button>
          )}

          <div className="pt-2 flex items-center gap-2 text-xs text-zinc-500 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <span>💡</span>
            <span>Dimensão recomendada: <strong>1280x720 pixels</strong> (proporção 16:9). Apenas imagens (JPG, PNG, WebP).</span>
          </div>
        </div>
      </div>

      {/* Card 2: Mensagem de boas-vindas */}
      <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div>
          <h2 className="text-base font-semibold text-white">Mensagem de boas-vindas no bot</h2>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
            <span>Mensagem</span>
          </label>

          <textarea
            rows={7}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Aqui você encontra uma seleção de Mini Dramas para escolher e assistir do seu jeito. 🍎&#10;&#10;🗣 Explore nosso catálogo&#10;🎭 Escolha seu Mini Drama&#10;🛒 Faça seu pedido&#10;▶ Receba seu acesso&#10;&#10;💬 Ficou com alguma dúvida? Nossa equipe está à disposição para ajudar. 🆘"
            className="w-full bg-[#16161A] border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/60 transition-all font-sans leading-relaxed custom-scrollbar resize-y"
          />

          <p className="text-xs text-zinc-500">
            Enviada quando o cliente iniciar ou mandar mensagem ao bot. Use <code className="bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded font-mono">{`{nome}`}</code> para incluir o primeiro nome do cliente automaticamente.
          </p>

          <div className="pt-2 flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <span className="text-base">📷</span>
            <span>Quando houver um banner configurado acima, ele será enviado em <strong>uma única mensagem com esta legenda</strong>.</span>
          </div>
        </div>
      </div>

      {/* Card 3: Botao de suporte no Mini App */}
      <div className="bg-[#0F0F12] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-400" />
            <span>Botão de suporte no Mini App</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Exibe um botão fixo de suporte no mini app dos seus clientes. Deixe vazio para desativar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium block">Tipo</label>
            <select
              value={supportType}
              onChange={(e) => setSupportType(e.target.value)}
              className="w-full bg-[#16161A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/60 transition-all"
            >
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="link">Link Externo</option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium block">
              {supportType === "whatsapp"
                ? "Número do WhatsApp (com DDI e DDD)"
                : supportType === "link"
                ? "URL de Suporte (HTTPS)"
                : "Usuário do Telegram (@username ou sem @)"}
            </label>
            <input
              type="text"
              value={supportValue}
              onChange={(e) => setSupportValue(e.target.value)}
              placeholder={
                supportType === "whatsapp"
                  ? "5511999999999"
                  : supportType === "link"
                  ? "https://suporte.exemplo.com"
                  : "Hexafiretv"
              }
              className="w-full bg-[#16161A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/60 transition-all"
            />
          </div>
        </div>

        {/* Dynamic Help Text & Live Validation */}
        <div className="space-y-2 pt-1">
          <p className="text-xs text-zinc-400">
            {supportType === "whatsapp"
              ? "Informe o telefone completo com código do país e DDD (ex: 5511999999999). Espaços, hífens e parênteses serão removidos automaticamente."
              : supportType === "link"
              ? "Informe a URL completa do seu suporte (ex: https://suporte.seusite.com). Protocolos perigosos não são permitidos."
              : "Informe o username do Telegram com ou sem @ (ex: @Hexafiretv ou Hexafiretv). O link abrirá diretamente a conversa no aplicativo."}
          </p>

          {supportValue.trim() && (
            supportParsed.isValid ? (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Configuração válida! Destino:{" "}
                  <strong className="underline underline-offset-2">{supportParsed.url}</strong>
                </span>
              </div>
            ) : (
              <div className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                <span>⚠️ {supportParsed.errorMessage}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
