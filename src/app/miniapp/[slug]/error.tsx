"use client";

import React, { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function MiniAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MiniAppError Boundary caught error]:", error);
  }, [error]);

  return (
    <div className="w-full h-[100vh] bg-[#161616] flex flex-col items-center justify-center p-6 text-center text-white">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado.</h2>
      <p className="text-zinc-400 mb-2 max-w-sm">
        Não foi possível carregar os dados desta página. Verifique sua conexão e tente novamente.
      </p>
      <div className="bg-red-950/70 border border-red-800 text-red-200 text-xs p-3 rounded-lg mb-4 max-w-sm text-left font-mono break-all space-y-1">
        <p className="font-bold">Detalhes do erro:</p>
        <p>{error?.message || error?.toString() || "Erro de renderização desconhecido"}</p>
        {error?.digest && <p className="text-[10px] text-red-400">Digest: {error.digest}</p>}
      </div>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition-colors text-sm"
      >
        Tentar Novamente
      </button>
    </div>
  );
}
