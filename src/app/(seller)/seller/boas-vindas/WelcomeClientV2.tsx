"use client";

import React, { useState, useRef, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Sparkles,
  Send,
  Upload,
  Trash2,
  Loader2,
  Check,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Code2,
  Info,
  ExternalLink,
  Image as ImageIcon,
  RotateCcw,
  Save,
} from "lucide-react";

import {
  PageHeader,
  Card,
  Chip,
  Button,
  IconButton,
  UnsavedBar,
  Toast,
  SegmentedControl,
} from "@/components/seller-v2";

import { updateWelcomeSettingsAction } from "./actions";
import { parseSupportConfig } from "@/lib/support/support-helper";

export interface WelcomeSettings {
  welcomeMessage: string;
  welcomeBanners: string[];
  supportType: string;
  supportValue: string;
}

export interface WelcomeClientV2Props {
  initialSettings: WelcomeSettings;
  hideHeader?: boolean;
}

export default function WelcomeClientV2({ initialSettings, hideHeader = false }: WelcomeClientV2Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estado salvo de referência para detecção de alterações pendentes
  const [savedSettings, setSavedSettings] = useState<WelcomeSettings>(initialSettings);

  // Estados dos campos de edição
  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings.welcomeMessage || "");
  const [bannerUrl, setBannerUrl] = useState<string>(
    initialSettings.welcomeBanners && initialSettings.welcomeBanners.length > 0
      ? initialSettings.welcomeBanners[0]
      : ""
  );
  const [supportType, setSupportType] = useState<string>(initialSettings.supportType || "telegram");
  const [supportValue, setSupportValue] = useState<string>(initialSettings.supportValue || "");

  // Estados de upload, notificações e referências
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Validação dinâmica de suporte
  const supportParsed = useMemo(() => {
    return parseSupportConfig(supportType, supportValue);
  }, [supportType, supportValue]);

  // Regra de limites de caracteres (Telegram: 1024 com imagem / 4096 sem imagem)
  const hasBanner = useMemo(() => Boolean(bannerUrl.trim()), [bannerUrl]);
  const maxChars = hasBanner ? 1024 : 4096;
  const currentChars = welcomeMessage.length;
  const isOverLimit = currentChars > maxChars;

  // Detecção de alterações pendentes
  const hasChanges = useMemo(() => {
    const isMessageChanged = welcomeMessage !== savedSettings.welcomeMessage;
    const initialBanner = savedSettings.welcomeBanners?.[0] || "";
    const isBannerChanged = bannerUrl.trim() !== initialBanner.trim();
    const isSupportTypeChanged = supportType !== (savedSettings.supportType || "telegram");
    const isSupportValueChanged = supportValue.trim() !== (savedSettings.supportValue || "").trim();

    return isMessageChanged || isBannerChanged || isSupportTypeChanged || isSupportValueChanged;
  }, [welcomeMessage, bannerUrl, supportType, supportValue, savedSettings]);

  // Contagem de alterações pendentes
  const changeCount = useMemo(() => {
    let count = 0;
    if (welcomeMessage !== savedSettings.welcomeMessage) count++;
    if (bannerUrl.trim() !== (savedSettings.welcomeBanners?.[0] || "").trim()) count++;
    if (supportType !== (savedSettings.supportType || "telegram")) count++;
    if (supportValue.trim() !== (savedSettings.supportValue || "").trim()) count++;
    return count;
  }, [welcomeMessage, bannerUrl, supportType, supportValue, savedSettings]);

  // Inserção da variável {nome} na posição exata do cursor
  const handleInsertVariable = () => {
    const textarea = textareaRef.current;
    const variable = "{nome}";

    if (!textarea) {
      setWelcomeMessage((prev) => prev + variable);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const text = textarea.value;

    const newText = text.substring(0, start) + variable + text.substring(end);
    setWelcomeMessage(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Descartar alterações (Reset)
  const handleReset = () => {
    setWelcomeMessage(savedSettings.welcomeMessage || "");
    setBannerUrl(savedSettings.welcomeBanners?.[0] || "");
    setSupportType(savedSettings.supportType || "telegram");
    setSupportValue(savedSettings.supportValue || "");
    setToast({ type: "success", message: "Alterações descartadas com sucesso." });
  };

  // Remoção do banner
  const handleRemoveBanner = () => {
    setBannerUrl("");
  };

  // Upload de banner para a API existente /api/upload
  const handleUploadBanner = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Falha no upload do arquivo.");
      }

      const data = await res.json();
      if (data.url) {
        setBannerUrl(data.url);
        setToast({ type: "success", message: "Banner carregado com sucesso!" });
      }
    } catch (err: any) {
      console.error("[WelcomeClientV2] Erro no upload:", err);
      setToast({
        type: "error",
        message: err?.message || "Erro ao fazer upload da imagem.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Salvar configurações via updateWelcomeSettingsAction
  const handleSave = () => {
    if (isOverLimit) {
      setToast({
        type: "error",
        message: `A mensagem ultrapassou o limite de ${maxChars} caracteres.`,
      });
      return;
    }

    if (supportValue.trim() && !supportParsed.isValid) {
      setToast({
        type: "error",
        message: supportParsed.errorMessage || "Configuração de suporte inválida.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const cleanBanners = bannerUrl.trim() ? [bannerUrl.trim()] : [];
        await updateWelcomeSettingsAction({
          welcomeMessage,
          welcomeBanners: cleanBanners,
          supportType,
          supportValue,
        });

        const newSettings: WelcomeSettings = {
          welcomeMessage,
          welcomeBanners: cleanBanners,
          supportType,
          supportValue,
        };

        setSavedSettings(newSettings);
        setToast({ type: "success", message: "Configurações salvas com sucesso!" });
        router.refresh();
      } catch (err: any) {
        console.error("[WelcomeClientV2] Erro ao salvar:", err);
        setToast({
          type: "error",
          message: err?.message || "Erro ao salvar configurações de boas-vindas.",
        });
      }
    });
  };

  const isConfigured = Boolean(
    savedSettings.welcomeMessage?.trim() || savedSettings.welcomeBanners?.length > 0
  );

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={3500}
        />
      )}

      {/* 1. Header Padronizado V2 */}
      {!hideHeader && (
        <PageHeader
          title="Mensagem de boas-vindas"
          subtitle="Configure a mensagem e banner automáticos enviados pelo bot aos clientes e exibidos no Mini App."
          badge={
            isConfigured ? (
              <Chip size="sm" variant="active" label="Configuração Ativa" />
            ) : (
              <Chip size="sm" variant="inactive" label="Não configurada" />
            )
          }
          actions={
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleReset}
                  disabled={isPending}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  className="text-xs text-[#9a9aa2] hover:text-[#f4f4f5]"
                >
                  Descartar
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                isLoading={isPending}
                disabled={!hasChanges || isOverLimit}
                leftIcon={<Save className="w-4 h-4 stroke-[2.5]" />}
              >
                Salvar alterações
              </Button>
            </div>
          }
        />
      )}

      {/* 2. Grid Principal Responsivo (12 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Mensagem Principal e Suporte (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card A: Mensagem de Boas-vindas */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#26262a]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#60a5fa] shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f4f4f5] tracking-tight">
                    Texto de Boas-vindas no Bot
                  </h2>
                  <p className="text-xs text-[#9a9aa2]">
                    Enviada automaticamente quando o cliente inicia ou conversa com o bot
                  </p>
                </div>
              </div>

              {/* Inserir Variável Dinâmica */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleInsertVariable}
                leftIcon={<Code2 className="w-3.5 h-3.5 text-[#60a5fa]" />}
                className="text-xs font-mono text-[#60a5fa] hover:text-white"
                title="Inserir {nome} na posição do cursor"
              >
                + Inserir {"{nome}"}
              </Button>
            </div>

            {/* Textarea e Contador de Caracteres */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="welcome_message_input" className="font-semibold text-[#f4f4f5]">
                  Texto da Mensagem
                </label>
                <div
                  className={`text-[11px] font-mono tabular-nums ${
                    isOverLimit ? "text-[#f87171] font-bold" : "text-[#71717a]"
                  }`}
                >
                  {currentChars} / {maxChars} caracteres
                </div>
              </div>

              <textarea
                id="welcome_message_input"
                ref={textareaRef}
                rows={9}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Olá {nome}, seja muito bem-vindo à nossa loja! 🛍️&#10;&#10;Explore nosso catálogo e aproveite as novidades exclusivas.&#10;&#10;Qualquer dúvida, estamos à disposição no suporte!"
                className={`w-full bg-[#16161a] border rounded-xl p-4 text-sm text-[#f4f4f5] placeholder:text-[#52525b] outline-none transition-colors font-sans leading-relaxed resize-y ${
                  isOverLimit
                    ? "border-[#ef4444] focus:border-[#ef4444]"
                    : "border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6]"
                }`}
              />

              {/* Alerta de Limite Excedido */}
              {isOverLimit && (
                <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl text-xs text-[#f87171] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    O texto excede o limite do Telegram de <strong>{maxChars} caracteres</strong>{" "}
                    {hasBanner ? "(legenda com banner anexado)" : "(mensagem de texto puro)"}.
                    Reduza {currentChars - maxChars} caracteres para salvar.
                  </span>
                </div>
              )}

              {/* Dicas e Informações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-[#9a9aa2]">
                <div className="flex items-start gap-2 bg-[#16161a] p-3 rounded-xl border border-[#26262a]">
                  <Code2 className="w-4 h-4 text-[#60a5fa] shrink-0 mt-0.5" />
                  <span>
                    A variável <code className="bg-[#3b82f6]/10 text-[#60a5fa] px-1 py-0.5 rounded font-mono">{"{nome}"}</code> é substituída pelo primeiro nome do usuário no Telegram.
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-[#16161a] p-3 rounded-xl border border-[#26262a]">
                  <ImageIcon className="w-4 h-4 text-[#c084fc] shrink-0 mt-0.5" />
                  <span>
                    {hasBanner
                      ? "Com banner anexado, o Telegram envia a imagem com este texto como legenda (máx. 1024 caracteres)."
                      : "Sem banner anexado, o Telegram envia a mensagem em texto puro (máx. 4096 caracteres)."}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card C: Atendimento e Suporte */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#26262a]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center text-[#c084fc] shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f4f4f5] tracking-tight">
                    Botão de Suporte no Mini App
                  </h2>
                  <p className="text-xs text-[#9a9aa2]">
                    Exibe um botão flutuante de atendimento para os clientes na vitrine
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Seletor Segmentado de Tipo de Suporte */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#f4f4f5]">Canal de Atendimento</label>
                <SegmentedControl
                  value={supportType}
                  onChange={(val) => setSupportType(val)}
                  fullWidth
                  options={[
                    { id: "telegram", label: "Telegram", icon: <Send className="w-3.5 h-3.5" /> },
                    { id: "whatsapp", label: "WhatsApp" },
                    { id: "link", label: "Link Externo", icon: <ExternalLink className="w-3.5 h-3.5" /> },
                  ]}
                />
              </div>

              {/* Campo de Entrada do Suporte */}
              <div className="space-y-1.5">
                <label htmlFor="support_value_input" className="text-xs font-semibold text-[#f4f4f5]">
                  {supportType === "whatsapp"
                    ? "Número do WhatsApp (com DDI e DDD)"
                    : supportType === "link"
                    ? "URL de Suporte (HTTPS)"
                    : "Usuário do Telegram (@username ou sem @)"}
                </label>
                <input
                  id="support_value_input"
                  type="text"
                  value={supportValue}
                  onChange={(e) => setSupportValue(e.target.value)}
                  placeholder={
                    supportType === "whatsapp"
                      ? "5511999999999"
                      : supportType === "link"
                      ? "https://suporte.seusite.com"
                      : "Hexafiretv"
                  }
                  className="w-full bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] rounded-xl px-4 py-2.5 text-xs text-[#f4f4f5] placeholder:text-[#52525b] outline-none transition-colors"
                />
              </div>

              {/* Feedback e Validação em Tempo Real */}
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-[#71717a] leading-relaxed">
                  {supportType === "whatsapp"
                    ? "Informe o telefone completo com DDI e DDD (ex: 5511999999999). Espaços e caracteres são formatados automaticamente."
                    : supportType === "link"
                    ? "Informe a URL completa do seu suporte (ex: https://suporte.seusite.com)."
                    : "Informe o username do Telegram com ou sem @ (ex: @Hexafiretv). O link abrirá o chat diretamente."}
                </p>

                {supportValue.trim() && (
                  supportParsed.isValid ? (
                    <div className="text-xs text-[#4ade80] flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/20 px-3 py-2 rounded-xl">
                      <Check className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        Configuração válida:{" "}
                        <strong className="underline underline-offset-2 break-all">{supportParsed.url}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-[#fbbf24] flex items-center gap-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-3 py-2 rounded-xl">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{supportParsed.errorMessage || "Valor de suporte inválido."}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Coluna Direita: Banners e Resumo (5 colunas) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card B: Banners de Boas-vindas */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#26262a]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#60a5fa] shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#f4f4f5] tracking-tight">
                    Banner de Boas-vindas
                  </h2>
                  <p className="text-xs text-[#9a9aa2]">Imagem enviada no Telegram com a mensagem</p>
                </div>
              </div>

              {hasBanner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveBanner}
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-[#f87171]" />}
                  className="text-xs text-[#f87171] hover:bg-[#ef4444]/10"
                >
                  Remover
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {/* URL do Banner e Botão Upload */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://exemplo.com/banner.webp"
                  className="flex-1 bg-[#16161a] border border-[#26262a] hover:border-[#3a3a40] focus:border-[#3b82f6] rounded-xl px-3.5 py-2 text-xs text-[#f4f4f5] placeholder:text-[#52525b] outline-none font-mono transition-colors"
                />

                <label className="cursor-pointer bg-[#16161a] hover:bg-[#1f1f24] border border-[#26262a] hover:border-[#3a3a40] rounded-xl px-3.5 py-2 text-xs text-[#f4f4f5] font-semibold flex items-center gap-1.5 transition-all shrink-0">
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3b82f6]" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploading ? "Enviando..." : "Upload"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadBanner(file);
                    }}
                  />
                </label>
              </div>

              {/* Preview 16:9 */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[#26262a] bg-[#16161a] flex items-center justify-center group">
                {bannerUrl ? (
                  <>
                    <img
                      src={bannerUrl}
                      alt="Banner de boas-vindas"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      aria-label="Remover banner de boas-vindas"
                      className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-[#ef4444] text-white border border-[#26262a] text-xs font-medium transition-all backdrop-blur-md cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-[#26262a] flex items-center justify-center mx-auto text-[#71717a]">
                      <Sparkles className="w-5 h-5 text-[#52525b]" />
                    </div>
                    <p className="text-xs text-[#9a9aa2] font-medium">Nenhum banner anexado</p>
                    <p className="text-[11px] text-[#71717a]">
                      Insira uma URL direta ou faça upload de imagem 16:9 (1280x720 px).
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#71717a] bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Formatos suportados: PNG, JPG, WebP. Proporção recomendada: 16:9.</span>
              </div>
            </div>
          </Card>

          {/* Card D: Prévia ao vivo de como a mensagem chega no Telegram */}
          <Card padding="md" className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
              Prévia no Telegram
            </h3>
            <div className="rounded-2xl bg-[#17212b] border border-[#22303c] p-3 space-y-1.5">
              <div className="rounded-xl bg-[#182533] overflow-hidden">
                {hasBanner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerUrl}
                    alt="Banner de boas-vindas"
                    className="w-full aspect-video object-cover bg-[#1f2e3d]"
                  />
                )}
                <p className="px-3 py-2.5 text-[13px] leading-relaxed text-[#e9eef2] whitespace-pre-line break-words">
                  {welcomeMessage.trim()
                    ? welcomeMessage.replace(/\{nome\}/gi, "Ana").replace(/\{name\}/gi, "Ana")
                    : "Olá Ana! Bem-vindo(a) à loja.\n\nClique no botão abaixo para abrir nossa loja e conferir os produtos!"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[12px] text-center">
                <span className="col-span-2 rounded-lg bg-[#2b5278] text-white py-2">🛍️ ABRIR LOJA</span>
                <span className="rounded-lg bg-[#22303c] text-[#e9eef2] py-2">🛒 Carrinho</span>
                <span className="rounded-lg bg-[#22303c] text-[#e9eef2] py-2">📺 Meus Acessos</span>
                <span className="col-span-2 rounded-lg bg-[#22303c] text-[#e9eef2] py-2">📚 Catálogo</span>
                <span className="col-span-2 rounded-lg bg-[#22303c] text-[#e9eef2] py-2">💬 Suporte</span>
              </div>
            </div>
            <p className="text-[11px] text-[#71717a]">
              {"{nome}"} aparece como “Ana” só nesta prévia. Sem texto salvo, o bot usa a mensagem padrão da loja.
            </p>
          </Card>
        </div>
      </div>

      {/* 3. Barra Flutuante de Alterações Pendentes (UnsavedBar) */}
      <UnsavedBar
        hasChanges={hasChanges}
        changeCount={changeCount}
        isSaving={isPending}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Salvar alterações"
        resetLabel="Descartar"
        errorMessage={isOverLimit ? `Limite excedido: máx ${maxChars} caracteres` : null}
      />
    </div>
  );
}

