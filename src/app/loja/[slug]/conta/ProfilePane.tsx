"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { avatarAction, passwordAction, profileAction } from "../actions";
import { BTN_GHOST, BTN_PRIMARY, ErrorBox, INPUT, Label } from "../_components/ui";

import { thumb } from "@/lib/webstore/img";
const PANEL = "rounded-[10px] border border-white/[0.07] bg-[#0f1014]";

export function Avatar({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumb(url, 240)} alt="" width={size} height={size} className="rounded-full object-cover ring-1 ring-white/10 shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-[#3b82f6] text-white font-bold flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function ProfilePane({
  slug,
  customer,
}: {
  slug: string;
  customer: { name: string; email: string; whatsapp: string | null; telegram: string | null; avatarUrl: string | null };
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(customer.avatarUrl);
  const [f, setF] = useState({ name: customer.name, whatsapp: customer.whatsapp || "", telegram: customer.telegram ? `@${customer.telegram}` : "" });
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ k: "perfil" | "senha" | "foto"; ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"perfil" | "senha" | "foto" | null>(null);
  const [, start] = useTransition();

  const pickPhoto = async (file: File) => {
    setBusy("foto");
    setMsg(null);
    try {
      const { optimizeBannerImage } = await import("@/lib/image-optimizer");
      const img = await optimizeBannerImage(file, { maxWidth: 320, maxHeight: 320, quality: 0.85, format: "image/webp" });
      const r = await avatarAction(slug, img.dataUrl);
      if (!r.ok) setMsg({ k: "foto", ok: false, text: r.error });
      else {
        setAvatar(r.url);
        router.refresh();
      }
    } catch (e) {
      setMsg({ k: "foto", ok: false, text: (e as Error).message || "Não foi possível usar essa imagem." });
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = () =>
    start(async () => {
      setBusy("foto");
      const r = await avatarAction(slug, null);
      setBusy(null);
      if (r.ok) {
        setAvatar(null);
        router.refresh();
      }
    });

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setBusy("perfil");
      setMsg(null);
      const r = await profileAction(slug, f);
      setBusy(null);
      setMsg(r.ok ? { k: "perfil", ok: true, text: "Dados salvos." } : { k: "perfil", ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) {
      setMsg({ k: "senha", ok: false, text: "As duas senhas novas não são iguais." });
      return;
    }
    start(async () => {
      setBusy("senha");
      setMsg(null);
      const r = await passwordAction(slug, pw.current, pw.next);
      setBusy(null);
      if (r.ok) setPw({ current: "", next: "", again: "" });
      setMsg(r.ok ? { k: "senha", ok: true, text: "Senha alterada." } : { k: "senha", ok: false, text: r.error });
    });
  };

  const note = (k: "perfil" | "senha" | "foto") =>
    msg && msg.k === k ? (
      msg.ok ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-[#9cc2ff]">
          <Check className="w-4 h-4" /> {msg.text}
        </p>
      ) : (
        <ErrorBox>{msg.text}</ErrorBox>
      )
    ) : null;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
      <section className={`${PANEL} p-5 sm:p-6`}>
        <h2 className="text-[16px] font-semibold">Seus dados</h2>
        <p className="text-[13px] text-zinc-500 mt-0.5">A loja usa estes contatos para falar com você no suporte.</p>

        <div className="mt-5 flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative group rounded-full" aria-label="Trocar foto de perfil">
            <Avatar url={avatar} name={f.name || customer.name} size={72} />
            <span className="absolute inset-0 rounded-full bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {busy === "foto" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            </span>
          </button>
          <div className="min-w-0">
            <p className="text-[14px] font-medium">Foto de perfil</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px]">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "foto"} className="text-[#7fb0ff] hover:underline disabled:opacity-50">
                {avatar ? "Trocar foto" : "Enviar foto"}
              </button>
              {avatar && (
                <button type="button" onClick={removePhoto} disabled={busy === "foto"} className="text-zinc-500 hover:text-red-300">
                  Remover
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pickPhoto(file);
            }}
          />
        </div>
        <div className="mt-3">
          {note("foto")}
        </div>

        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <label className="block">
            <Label>Nome</Label>
            <input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} className={INPUT} autoComplete="name" maxLength={80} required />
          </label>
          <label className="block">
            <Label hint="não dá para trocar">E-mail</Label>
            <input value={customer.email} readOnly disabled className={`${INPUT} opacity-60`} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <Label>WhatsApp</Label>
              <input value={f.whatsapp} onChange={(e) => setF((s) => ({ ...s, whatsapp: e.target.value }))} inputMode="tel" className={INPUT} autoComplete="tel" maxLength={20} placeholder="(11) 99999-9999" />
            </label>
            <label className="block">
              <Label>Telegram</Label>
              <input value={f.telegram} onChange={(e) => setF((s) => ({ ...s, telegram: e.target.value }))} className={INPUT} maxLength={33} placeholder="@usuario" />
            </label>
          </div>
          {note("perfil")}
          <button type="submit" className={BTN_PRIMARY} disabled={busy === "perfil"}>
            {busy === "perfil" ? "Salvando..." : "Salvar dados"}
          </button>
        </form>
      </section>

      <section className={`${PANEL} p-5 sm:p-6`}>
        <h2 className="text-[16px] font-semibold">Senha</h2>
        <p className="text-[13px] text-zinc-500 mt-0.5">Troque sua senha quando quiser. Se esquecer, use “Esqueci minha senha” na tela de entrar.</p>
        <form onSubmit={savePassword} className="mt-5 space-y-4">
          <label className="block">
            <Label>Senha atual</Label>
            <span className="relative block">
              <input type={show ? "text" : "password"} value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className={`${INPUT} pr-11`} autoComplete="current-password" required maxLength={100} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Esconder senhas" : "Mostrar senhas"} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[6px] flex items-center justify-center text-zinc-500 hover:text-white">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>
          <label className="block">
            <Label hint="mínimo 6 caracteres">Nova senha</Label>
            <input type={show ? "text" : "password"} value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className={INPUT} autoComplete="new-password" required minLength={6} maxLength={100} />
          </label>
          <label className="block">
            <Label>Repita a nova senha</Label>
            <input type={show ? "text" : "password"} value={pw.again} onChange={(e) => setPw((s) => ({ ...s, again: e.target.value }))} className={INPUT} autoComplete="new-password" required minLength={6} maxLength={100} />
          </label>
          {note("senha")}
          <button type="submit" className={BTN_GHOST} disabled={busy === "senha"}>
            {busy === "senha" ? "Salvando..." : "Trocar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}
