"use client";

import { useState, useTransition } from "react";
import { Check, Upload, Plus, Trash2, Loader2, Sparkles, MessageSquare, Send } from "lucide-react";
import { updateWelcomeSettingsAction } from "./actions";

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

  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage || "");
  const [banners, setBanners] = useState<string[]>(
    initialSettings.welcomeBanners.length > 0 ? initialSettings.welcomeBanners : [""]
  );
  const [supportType, setSupportType] = useState(initialSettings.supportType || "telegram");
  const [supportValue, setSupportValue] = useState(initialSettings.supportValue || "");

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
      } catch (err) {
        console.error("Error saving welcome settings:", err);
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
      </div>      {/* Card 1: Banner de boas-vindas */}
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
          {banners.slice(0, 1).map((bannerUrl, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 font-medium block">
                  Banner de boas-vindas
                </label>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-medium border border-blue-500/30">
                  📷 Enviado no Bot Telegram
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={(e) => handleBannerChange(0, e.target.value)}
                    placeholder="https://i.ibb.co/..."
                    className="w-full bg-[#16161A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/60 transition-all pr-10"
                  />
                  {bannerUrl.trim() !== "" && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = async (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
                            const res = await uploadOptimizedImage(file, "banners", {
                              maxWidth: 1200,
                              maxHeight: 540,
                              quality: 0.85,
                              format: "image/webp",
                            });
                            handleBannerChange(0, res.url);
                          } catch (err: any) {
                            alert(err.message || "Erro ao fazer upload da imagem para o Bunny CDN.");
                          }
                        }
                      };
                      input.click();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1C1C22] hover:bg-[#25252E] text-zinc-300 text-xs font-medium rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-colors shrink-0 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2: Mensagem de boas-vindas no bot */}
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
            <label className="text-xs text-zinc-400 font-medium block">Usuário (@username ou sem @)</label>
            <input
              type="text"
              value={supportValue}
              onChange={(e) => setSupportValue(e.target.value)}
              placeholder="suporte"
              className="w-full bg-[#16161A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/60 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
