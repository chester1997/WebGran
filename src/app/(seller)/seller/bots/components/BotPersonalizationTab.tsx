"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Heart,
  Home,
  ImagePlus,
  Library,
  Loader2,
  Headphones,
  PlayCircle,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  Play,
  Share2,
  Plus,
} from "lucide-react";
import { saveBotAppearanceAction } from "../actions";
import { ACCENT_COLORS, DEFAULT_ACCENT } from "@/lib/miniapp/appearance-colors";
import type { BotPersonalizationData } from "../[id]/SingleBotClient";

const CARD = "bg-[#171717] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl";
const INPUT =
  "w-full h-11 bg-[#1F1F24] border border-white/10 rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#3b82f6]";

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/** Aba Personalização do bot: topo do Mini App (logo + nome), cor principal e botões da mensagem de boas-vindas. */
export default function BotPersonalizationTab({
  botId,
  botUsername,
  storeName,
  buttonText,
  data,
  showNotification,
}: {
  botId: string;
  botUsername: string;
  storeName: string;
  buttonText: string;
  data: BotPersonalizationData;
  showNotification: (type: "success" | "error", message: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(data.appearance.displayName || "");
  const [logo, setLogo] = useState(data.appearance.logoUrl || "");
  const [color, setColor] = useState(data.appearance.accentColor || DEFAULT_ACCENT);
  const [extra, setExtra] = useState(data.appearance.showExtraButtons);
  const [openLabel, setOpenLabel] = useState(data.appearance.welcomeButtonText || "");
  const [uploading, setUploading] = useState(false);

  const shownName = name.trim() || storeName;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "profiles", { maxWidth: 512, maxHeight: 512, quality: 0.9 });
      setLogo(res.url);
      showNotification("success", "Logo enviada. Clique em Salvar para aplicar no Mini App.");
    } catch (e) {
      showNotification("error", (e as Error).message || "Não foi possível enviar a logo.");
    } finally {
      setUploading(false);
    }
  };

  const save = () =>
    start(async () => {
      const r = await saveBotAppearanceAction(botId, { displayName: name, logoUrl: logo || null, accentColor: color, showExtraButtons: extra, welcomeButtonText: openLabel });
      if (!r.success) return showNotification("error", r.error || "Não foi possível salvar.");
      showNotification("success", "Personalização salva. Abra o Mini App de novo para ver.");
      router.refresh();
    });

  return (
    <div className="w-full space-y-5">
      {!data.ready && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-[13px] text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Falta rodar a migration <b>0036_bot_miniapp_appearance.sql</b> no Neon. Até lá nada muda no Mini App e o salvar não funciona.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
        {/* ------------------------------ Configurações ------------------------------ */}
        <div className="space-y-5 min-w-0">
          <section className={CARD}>
            <div className="flex flex-wrap items-start gap-3 mb-5">
              <div className="mr-auto">
                <h3 className="text-[15px] font-bold text-white">Topo do Mini App</h3>
                <p className="text-[12.5px] text-zinc-400 mt-0.5">No lugar da foto, nome e ID do cliente, o Mini App mostra a logo e o nome que você escolher.</p>
              </div>
              <button
                type="button"
                onClick={save}
                disabled={pending || !data.ready}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[13px] font-bold disabled:opacity-50"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <div className="shrink-0">
                <span className="block text-[12px] font-semibold text-zinc-400 mb-2">Logo</span>
                <label className="relative w-[96px] h-[96px] rounded-2xl border border-dashed border-white/15 bg-[#1F1F24] hover:border-[#3b82f6]/70 cursor-pointer overflow-hidden flex items-center justify-center">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Logo" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[11px] text-zinc-500">
                      <ImagePlus className="w-5 h-5" /> Enviar
                    </span>
                  )}
                  {uploading && (
                    <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    </span>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
                {logo && (
                  <button type="button" onClick={() => setLogo("")} className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-zinc-500 hover:text-red-300">
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="block">
                  <span className="block text-[12px] font-semibold text-zinc-400 mb-2">Nome exibido no Mini App</span>
                  <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={storeName} className={INPUT} />
                </label>
                <p className="text-[11.5px] text-zinc-500 mt-2">
                  Em branco, usa o nome da loja (<b className="text-zinc-300">{storeName}</b>). Logo quadrada, de preferência 512×512. Sem logo, aparece a inicial do nome.
                </p>
              </div>
            </div>
          </section>

          <section className={CARD}>
            <h3 className="text-[15px] font-bold text-white">Cor principal do Mini App</h3>
            <p className="text-[12.5px] text-zinc-400 mt-0.5 mb-4">
              Muda os botões de compra e de carrinho, o “Ver mais”, o ícone da entrega do produto, o número do carrinho e o item ativo do menu de baixo.
            </p>
            <div role="radiogroup" aria-label="Cor principal" className="flex flex-wrap items-center gap-2.5">
              {ACCENT_COLORS.map((c) => {
                const on = color.toUpperCase() === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => setColor(c.hex)}
                    className={`relative w-10 h-10 rounded-xl border-2 transition-transform ${on ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {on && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
              <label className="relative h-10 px-3 rounded-xl border border-white/10 bg-[#1F1F24] flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="w-6 h-6 rounded border-0 bg-transparent p-0 cursor-pointer" aria-label="Outra cor" />
                Outra cor <span className="font-mono text-zinc-500">{color.toUpperCase()}</span>
              </label>
            </div>
          </section>

          <section className={CARD}>
            <h3 className="text-[15px] font-bold text-white">Botões da mensagem de boas-vindas</h3>
            <label className="block mt-4">
              <span className="block text-[12px] font-semibold text-zinc-400 mb-2">Texto do botão que abre a loja</span>
              <input value={openLabel} maxLength={30} onChange={(e) => setOpenLabel(e.target.value)} placeholder="🛍️ ABRIR LOJA" className={INPUT} />
              <span className="block text-[11.5px] text-zinc-500 mt-1.5">
                Vai junto com a mensagem de boas-vindas, ex.: <b className="text-zinc-300">🎬 Abrir App Studio</b>. Até 30 caracteres; emoji é opcional. Em branco, fica “🛍️ ABRIR LOJA”.
              </span>
            </label>
            <div className="flex items-start gap-4 mt-5 pt-5 border-t border-white/[0.06]">
              <div className="mr-auto">
                <p className="text-[13.5px] font-semibold text-white">Mostrar os outros botões</p>
                <p className="text-[12.5px] text-zinc-400 mt-0.5">
                  Desligado, o bot mostra só o botão acima. Ligado, aparecem também Carrinho, Meus Acessos, Catálogo e Suporte.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={extra}
                aria-label="Mostrar botões extras"
                onClick={() => setExtra((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${extra ? "bg-[#3b82f6]" : "bg-white/[0.14]"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-[left] ${extra ? "left-6" : "left-1"}`} />
              </button>
            </div>
          </section>
        </div>

        {/* ------------------------------ Prévia ------------------------------ */}
        <div className="space-y-5 xl:sticky xl:top-4">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">Prévia no Mini App</p>
          <MiniAppPreview name={shownName} logo={logo} color={color} products={data.sampleProducts} />
          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">Prévia no Telegram</p>
          <TelegramPreview botUsername={botUsername} text={data.welcomeText} banner={data.welcomeBanner} extra={extra} buttonText={buttonText} openLabel={openLabel.trim() || "🛍️ ABRIR LOJA"} />
        </div>
      </div>
    </div>
  );
}

function MiniAppPreview({
  name,
  logo,
  color,
  products,
}: {
  name: string;
  logo: string;
  color: string;
  products: { title: string; coverUrl: string | null; price: number }[];
}) {
  const items = products.length ? products.slice(0, 2) : [{ title: "Título de exemplo", coverUrl: null, price: 5 }, { title: "Outro título", coverUrl: null, price: 5 }];
  const price = items[0]?.price || 5;
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[28px] border border-white/10 bg-[#0d0e10] p-3 shadow-2xl">
      {/* topo */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#111214] border border-white/10">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/20" />
        ) : (
          <span className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/20 flex items-center justify-center text-xs font-bold text-white">{name.charAt(0).toUpperCase()}</span>
        )}
        <span className="text-[13px] font-bold text-white truncate">{name}</span>
      </div>

      {/* cards */}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        {items.map((p, k) => (
          <div key={k} className="rounded-xl overflow-hidden bg-[#16171b] border border-white/[0.06]">
            <div className="relative aspect-[3/4] bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.coverUrl && <img src={p.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
              <span className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg text-white border border-white/20" style={{ backgroundColor: color }}>
                <ShoppingCart className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="p-2 space-y-1.5">
              <p className="text-[10.5px] font-bold text-white truncate uppercase">{p.title}</p>
              <p className="text-[10px] font-semibold text-emerald-400">{brl(p.price)}</p>
              <div className="flex gap-1">
                <span className="flex-1 py-1 rounded-md text-center text-[9.5px] font-semibold text-white" style={{ backgroundColor: color }}>
                  Ver mais
                </span>
                <span className="flex-1 py-1 rounded-md text-center text-[9.5px] font-semibold text-zinc-300 bg-white/[0.08] inline-flex items-center justify-center gap-0.5">
                  <Plus className="w-2.5 h-2.5" /> Carrinho
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* página do produto */}
      <div className="mt-3 space-y-2">
        <span className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-[12px] font-bold" style={{ backgroundColor: color }}>
          <Play className="w-3.5 h-3.5 fill-current" /> Comprar agora por {brl(price)}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <span className="py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] text-zinc-200 text-center">+ Favoritos</span>
          <span className="py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] text-zinc-200 text-center inline-flex items-center justify-center gap-1">
            <Share2 className="w-3 h-3" /> Compartilhar
          </span>
        </div>
        <p className="flex items-center gap-2 pt-1 text-[11px] font-bold text-white uppercase">
          <PlayCircle className="w-4 h-4" style={{ color }} /> Entrega do produto
        </p>
      </div>

      {/* menu de baixo */}
      <div className="mt-3 grid grid-cols-6 rounded-2xl bg-[#07080a] border border-white/10 py-2">
        {[
          { i: Home, l: "Início", on: true },
          { i: Heart, l: "Favoritos" },
          { i: Library, l: "Acessos" },
          { i: Search, l: "Busca" },
          { i: ShoppingCart, l: "Carrinho", badge: true },
          { i: Headphones, l: "Suporte" },
        ].map((t) => (
          <span key={t.l} className="relative flex flex-col items-center gap-0.5 text-[8.5px]" style={{ color: t.on ? color : "#a1a1aa" }}>
            <t.i className="w-4 h-4" />
            {t.l}
            {t.badge && (
              <span className="absolute -top-1 right-1 w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center" style={{ backgroundColor: color }}>
                3
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function TelegramPreview({
  botUsername,
  text,
  banner,
  extra,
  buttonText,
  openLabel,
}: {
  botUsername: string;
  text: string | null;
  banner: string | null;
  extra: boolean;
  buttonText: string;
  openLabel: string;
}) {
  const body = (text || "Olá {nome}! Bem-vindo(a).\n\nClique no botão abaixo para abrir nossa loja e conferir os produtos!").replace(/\{nome\}|\{name\}/gi, "Fernando");
  const btn = "w-full py-2 rounded-lg bg-[#2b5278]/70 text-white text-[12px] font-semibold text-center";
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[20px] border border-white/10 bg-[#0e1621] p-3 shadow-2xl">
      <p className="text-[11px] text-zinc-500 mb-2">@{botUsername}</p>
      <div className="rounded-xl bg-[#182533] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {banner && <img src={banner} alt="" className="w-full max-h-[160px] object-cover" />}
        <p className="p-3 text-[12px] text-zinc-100 whitespace-pre-line line-clamp-[10]">{body}</p>
      </div>
      <div className="mt-1.5 space-y-1.5">
        <span className={`${btn} block truncate px-2`}>{openLabel}</span>
        {extra && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <span className={btn}>🛒 Carrinho</span>
              <span className={btn}>📺 Meus Acessos</span>
            </div>
            <span className={`${btn} block`}>📚 Catálogo</span>
            <span className={`${btn} block`}>💬 Suporte</span>
          </>
        )}
      </div>
      <p className="mt-2 text-[10.5px] text-zinc-500 text-center">Botão do menu do Telegram: “{buttonText}”</p>
    </div>
  );
}
