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
    console.error(error);
  }, [error]);

  return (
    <div className="w-full h-[100vh] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-white">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado.</h2>
      <p className="text-zinc-400 mb-6 max-w-sm">
        Não foi possível carregar os dados desta página. Verifique sua conexão e tente novamente.
      </p>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition-colors"
      >
        Tentar Novamente
      </button>
    </div>
  );
}
