"use client";

import { useState, useTransition } from "react";
import { Check, Upload, Trash2, Loader2, Sparkles, MessageSquare, Send } from "lucide-react";
import { updateWelcomeSettingsAction } from "./actions";
import { parseSupportConfig } from "@/lib/support/support-helper";
import SellerPageHeader from "@/components/layout/SellerPageHeader";

interface WelcomeClientProps {
  initialSettings: {
    welcomeMessage: string;
    welcomeBanners: string[];
    supportType: string;
    supportValue: string;
  };
  hideHeader?: boolean;
}

export default function WelcomeClient({ initialSettings, hideHeader }: WelcomeClientProps) {
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage || "");
  const [banners, setBanners] = useState<string[]>(
    initialSettings.welcomeBanners.length > 0 ? [initialSettings.welcomeBanners[0]] : [""]
  );
  const [savedBanners, setSavedBanners] = useState<string[]>(
    initialSettings.welcomeBanners || []
  );
  const [supportType, setSupportType] = useState(initialSettings.supportType || "telegram");
  const [supportValue, setSupportValue] = useState(initialSettings.supportValue || "");

  const [isUploading, setIsUploading] = useState(false);

  const supportParsed = parseSupportConfig(supportType, supportValue);

  const handleBannerChange = (val: string) => {
    setBanners([val]);
  };

  const handleRemoveBanner = () => {
    const bannerUrl = (banners[0] || "").trim();
    const isSaved = bannerUrl !== "" && savedBanners.includes(bannerUrl);

    if (isSaved && typeof window !== "undefined") {
      const confirmed = window.confirm("Deseja remover este banner?");
      if (!confirmed) {
        return;
      }
    }

    setBanners([""]);
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
        setSavedBanners(cleanBanners);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } catch (err: unknown) {
        console.error("Error saving welcome settings:", err);
        setSaveError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
      }
    });
  };

  const currentBanner = banners[0] || "";

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header Padronizado */}
      {!hideHeader ? (
        <SellerPageHeader
          title="Boas-vindas"
          subtitle="Mensagem e banner exibidos no Mini App e no bot."
          actions={
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer h-9"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
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
          }
        />
      ) : (
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-bold text-white">Mensagem de Boas-vindas</h3>
            <p className="text-xs text-zinc-400">Configure o texto e banner automáticos enviados pelo seu bot.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 bg-[#3984FF] hover:bg-[#2563EB] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer h-9"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
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
      )}

      {/* Grid: 2 Colunas Balanceadas no Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Mensagem do Bot & Suporte (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card Mensagem de Boas-vindas */}
          <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#3984FF]/10 text-[#3984FF] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Mensagem de Boas-vindas no Bot</h2>
                  <p className="text-xs text-zinc-400">Enviada automaticamente quando o cliente inicia ou conversa com o bot</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-zinc-300 font-medium flex items-center justify-between">
                <span>Texto da Mensagem</span>
                <span className="text-[11px] text-zinc-500 font-mono">Suporta Markdown e Emojis</span>
              </label>

              <textarea
                rows={9}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Aqui você encontra uma seleção de produtos para escolher do seu jeito. 🍎&#10;&#10;🗣 Explore nosso catálogo&#10;🎭 Escolha seu produto&#10;🛒 Faça seu pedido&#10;▶ Receba seu acesso&#10;&#10;💬 Ficou com alguma dúvida? Nossa equipe está à disposição para ajudar. 🆘"
                className="w-full bg-[#111215] border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#3984FF] transition-all font-sans leading-relaxed custom-scrollbar resize-y"
              />

              <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                <span className="text-[#3984FF] font-bold">Variável dinâmica:</span>
                <span>Use <code className="bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/20 px-1.5 py-0.5 rounded font-mono text-xs">{`{nome}`}</code> para incluir o primeiro nome do cliente automaticamente.</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                <span className="text-base">📷</span>
                <span>Quando houver um banner configurado ao lado, ele será enviado em <strong>uma única mensagem com esta legenda</strong>.</span>
              </div>
            </div>
          </div>

          {/* Card Botão de Suporte no Mini App */}
          <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Botão de Suporte no Mini App</h2>
                  <p className="text-xs text-zinc-400">Exibe um botão fixo de atendimento na vitrine dos clientes</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium block">Tipo</label>
                <select
                  value={supportType}
                  onChange={(e) => setSupportType(e.target.value)}
                  className="w-full bg-[#111215] border border-white/10 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-[#3984FF] transition-all"
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
                  className="w-full bg-[#111215] border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#3984FF] transition-all"
                />
              </div>
            </div>

            {/* Dynamic Help Text & Live Validation */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {supportType === "whatsapp"
                  ? "Informe o telefone completo com DDI e DDD (ex: 5511999999999). Espaços e caracteres são formatados automaticamente."
                  : supportType === "link"
                  ? "Informe a URL completa do seu suporte (ex: https://suporte.seusite.com)."
                  : "Informe o username do Telegram com ou sem @ (ex: @Hexafiretv). O link abrirá o chat diretamente."}
              </p>

              {supportValue.trim() && (
                supportParsed.isValid ? (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Configuração válida:{" "}
                      <strong className="underline underline-offset-2 break-all">{supportParsed.url}</strong>
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

        {/* Coluna Direita: Banner de Boas-vindas & Preview (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#171717] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#3984FF]/10 text-[#3984FF] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Banner de Boas-vindas</h2>
                  <p className="text-xs text-zinc-400">Imagem enviada junto com o texto no Telegram</p>
                </div>
              </div>

              {currentBanner.trim() !== "" && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  title="Remover banner"
                  aria-label="Remover banner"
                  className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentBanner}
                  onChange={(e) => handleBannerChange(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="flex-1 bg-[#111215] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#3984FF] transition-all font-mono"
                />

                <label className="cursor-pointer bg-white/5 hover:bg-[#3984FF]/10 hover:text-[#3984FF] border border-white/10 hover:border-[#3984FF]/30 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 font-semibold flex items-center gap-1.5 transition-all shrink-0">
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3984FF]" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{isUploading ? "Enviando..." : "Upload"}</span>
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
                          handleBannerChange(data.url);
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

              {/* Preview 16:9 */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black/40 group flex items-center justify-center">
                {currentBanner ? (
                  <>
                    <img
                      src={currentBanner}
                      alt="Preview Banner de boas-vindas"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      title="Remover banner"
                      aria-label="Remover banner"
                      className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-rose-600 text-zinc-200 hover:text-white border border-white/10 hover:border-rose-500/50 text-xs font-medium transition-all shadow-lg backdrop-blur-md cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400 hover:text-white transition-colors" />
                      <span>Remover</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
                      <Sparkles className="w-5 h-5 text-zinc-500" />
                    </div>
                    <p className="text-xs text-zinc-400 font-medium">Nenhum banner anexado</p>
                    <p className="text-[11px] text-zinc-600">Faça upload ou cole a URL de uma imagem no formato 16:9.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                <span>💡</span>
                <span>Dimensão recomendada: <strong>1280x720 px</strong> (proporção 16:9). Apenas imagens (JPG, PNG, WebP).</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
