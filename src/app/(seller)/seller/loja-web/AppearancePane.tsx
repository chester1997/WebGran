"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { BTN_PRI, Callout, INPUT, useToast } from "../fluxos/_components/flow-ui";
import { saveBrandingAction } from "./actions";

const SURFACE =
  "relative rounded-[16px] border border-white/[0.07] bg-[linear-gradient(180deg,#191a1f_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_1px_2px_rgba(0,0,0,0.45),0_14px_30px_-16px_rgba(0,0,0,0.9)]";

export interface BrandingView {
  displayName: string | null;
  logoUrl: string | null;
  promoImageUrl: string | null;
}

export default function AppearancePane({ initial, ready, storeName }: { initial: BrandingView; ready: boolean; storeName: string }) {
  const [f, setF] = useState({ displayName: initial.displayName || "", logoUrl: initial.logoUrl || "", promoImageUrl: initial.promoImageUrl || "" });
  const [uploading, setUploading] = useState<"logo" | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const name = f.displayName.trim() || storeName;

  const upload = async (kind: "logo", file: File) => {
    setUploading(kind);
    try {
      const { uploadOptimizedImage } = await import("@/lib/image-optimizer");
      const res = await uploadOptimizedImage(file, "products");
      setF((s) => ({ ...s, logoUrl: res.url }));
    } catch (e) {
      toast((e as Error).message || "Não foi possível enviar a imagem.", "err");
    } finally {
      setUploading(null);
    }
  };

  const save = () =>
    start(async () => {
      const r = await saveBrandingAction(f);
      if (!r.ok) {
        toast(r.error, "err");
        return;
      }
      toast("Aparência da loja salva.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {!ready && (
        <Callout tone="warn">
          Para salvar a aparência, rode a migration <b>0030_web_store_settings.sql</b> no Neon. Enquanto isso, a loja usa o nome da sua loja.
        </Callout>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className={`${SURFACE} p-5 space-y-5`}>
          <div>
            <h3 className="text-[15px] font-semibold">Nome e logo</h3>
            <p className="text-[12.5px] text-zinc-500 mt-0.5">Aparecem no topo e no menu lateral da Loja Web. Não mudam nada no bot nem no Mini App.</p>
          </div>

          <label className="block">
            <span className="block text-[12.5px] font-medium text-zinc-400 mb-1.5">Nome da loja</span>
            <input value={f.displayName} onChange={(e) => setF((s) => ({ ...s, displayName: e.target.value }))} placeholder={storeName} maxLength={40} className={`${INPUT} w-full`} />
            <span className="block mt-1 text-[11.5px] text-zinc-500">Em branco, usa “{storeName}”.</span>
          </label>

          <div className="flex items-center gap-4">
            <label className="relative w-[84px] h-[84px] rounded-[18px] border border-dashed border-white/[0.16] bg-white/[0.02] hover:border-[#3b82f6]/60 cursor-pointer overflow-hidden shrink-0">
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-zinc-500">{uploading === "logo" ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}</span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("logo", e.target.files[0])} />
            </label>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium">Logo</p>
              <p className="text-[12px] text-zinc-500">Imagem quadrada, de preferência 512×512. Sem logo, a loja mostra a inicial do nome.</p>
              {f.logoUrl && (
                <button type="button" onClick={() => setF((s) => ({ ...s, logoUrl: "" }))} className="mt-1 text-[11.5px] text-zinc-500 hover:text-red-300">
                  Remover logo
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className={BTN_PRI} onClick={save} disabled={pending || !ready || uploading !== null}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar aparência
            </button>
          </div>
        </div>

        <div className={`${SURFACE} p-4`}>
          <p className="text-[12px] font-medium text-zinc-500 mb-3">Prévia do topo da loja</p>
          <div className="rounded-[12px] bg-[#07080a] border border-white/[0.06] overflow-hidden">
            <div className="flex items-center gap-2.5 h-14 px-3.5">
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoUrl} alt="" className="w-9 h-9 rounded-[10px] object-cover ring-1 ring-white/10" />
              ) : (
                <span className="w-9 h-9 rounded-[10px] bg-[#3b82f6] text-white font-black text-[15px] flex items-center justify-center">{name.charAt(0).toUpperCase()}</span>
              )}
              <span className="font-extrabold tracking-tight text-[16px] truncate">{name}</span>
            </div>
            <div className="h-24 bg-[radial-gradient(120%_120%_at_80%_0%,#1e2a44_0%,#07080a_60%)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
