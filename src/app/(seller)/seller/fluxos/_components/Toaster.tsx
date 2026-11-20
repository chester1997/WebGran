"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/** Aviso flutuante das telas de fluxos (disparado por useToast). */
export default function Toaster() {
  const [t, setT] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { msg: string; kind: "ok" | "err" };
      setT(d);
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), 4000);
    };
    window.addEventListener("flows-toast", on);
    return () => {
      window.removeEventListener("flows-toast", on);
      clearTimeout(timer);
    };
  }, []);
  if (!t) return null;
  return (
    <div role="status" className="fixed z-[60] bottom-5 left-1/2 -translate-x-1/2 max-w-[calc(100%-32px)] flex items-center gap-2.5 bg-[#1f2026] border border-white/[0.13] px-4 py-3 rounded-xl text-[13.5px] text-white shadow-2xl">
      {t.kind === "err" ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
      <span>{t.msg}</span>
    </div>
  );
}
