"use client";

import { type Ref } from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Barra superior do celular — Redesign V2 (conta proprietária).
 * Menu em duas linhas, cartão da logo e foto de perfil com anel azul.
 */
export default function MobileTopBarV2({
  hidden,
  drawerOpen,
  onToggleDrawer,
  buttonRef,
  avatarUrl,
  initialLetter,
}: {
  hidden: boolean;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  avatarUrl?: string | null;
  initialLetter: string;
}) {
  return (
    <div className={`${hidden ? "hidden" : "lg:hidden flex"} items-center justify-between gap-3 px-4 py-3 bg-[var(--seller-bg,#0A0A0A)]`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={onToggleDrawer}
          className="group w-9 h-10 -ml-1 flex flex-col items-start justify-center gap-[5px] pl-1.5 rounded-lg active:scale-95 transition-transform cursor-pointer shrink-0"
          title={drawerOpen ? "Fechar menu" : "Abrir menu"}
          aria-label={drawerOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={drawerOpen}
        >
          <span className="block h-[2px] w-[18px] rounded-full bg-zinc-200" />
          <span className="block h-[2px] w-[12px] rounded-full bg-[#60a5fa] transition-all group-hover:w-[18px]" />
        </button>

        <Link href="/seller" className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/logo-webgran-icon.png"
            alt="WebGran"
            width={32}
            height={32}
            priority
            className="w-8 h-8 rounded-[10px] object-contain shrink-0 select-none"
          />
          <div className="flex flex-col min-w-0 leading-none">
            <span className="font-semibold text-[13.5px] text-white tracking-tight whitespace-nowrap">WebGran</span>
            <span className="mt-[3px] text-[10px] font-medium text-zinc-500 whitespace-nowrap">Painel do Vendedor</span>
          </div>
        </Link>
      </div>

      <Link
        href="/seller/settings"
        aria-label="Meu perfil"
        className="relative w-10 h-10 shrink-0 rounded-full p-[2px] active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #93c5fd 100%)" }}
      >
        <span className="w-full h-full rounded-full overflow-hidden bg-[#0f1117] border-2 border-[var(--seller-bg,#0A0A0A)] flex items-center justify-center font-bold text-[13px] text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initialLetter
          )}
        </span>
      </Link>
    </div>
  );
}
