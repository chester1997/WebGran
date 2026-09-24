import React from "react";
import Link from "next/link";
import { PackageX, Home } from "lucide-react";

export default function MiniAppNotFound() {
  return (
    <div className="min-h-screen bg-[#272727] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 shadow-xl">
        <PackageX className="w-8 h-8 text-zinc-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Página não encontrada</h2>
        <p className="text-xs text-zinc-400 max-w-xs">
          O conteúdo que você procurou não existe ou foi movido.
        </p>
      </div>
      <Link
        href="/miniapp"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all"
      >
        <Home className="w-4 h-4" />
        <span>Ir para o Início</span>
      </Link>
    </div>
  );
}
