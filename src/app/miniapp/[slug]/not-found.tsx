"use client";

import React from "react";
import Link from "next/link";
import { PackageX } from "lucide-react";

export default function MiniAppNotFound() {
  return (
    <div className="w-full h-[100vh] bg-[#161616] flex flex-col items-center justify-center p-6 text-center text-white">
      <PackageX className="w-12 h-12 text-zinc-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Página não encontrada</h2>
      <p className="text-zinc-400 mb-6 max-w-sm">
        O item que você está procurando não existe ou foi removido desta loja.
      </p>
      <Link 
        href="#"
        onClick={(e) => {
          e.preventDefault();
          window.history.back();
        }}
        className="px-6 py-2 bg-zinc-800 text-white font-medium rounded hover:bg-zinc-700 transition-colors"
      >
        Voltar
      </Link>
    </div>
  );
}
