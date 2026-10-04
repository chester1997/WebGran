"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Seller Error Boundary caught error]:", error);
  }, [error]);

  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500 shadow-xl">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Ocorreu um erro ao carregar a página</h2>
      <p className="text-zinc-400 max-w-md text-xs mb-6">
        {error?.message || "Ocorreu um erro inesperado no painel do vendedor."}
      </p>
      {error?.digest && (
        <p className="text-[10px] font-mono text-zinc-600 mb-6">Digest: {error.digest}</p>
      )}
      <Button
        onClick={() => reset()}
        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl px-5 py-2.5 shadow-lg shadow-red-600/20"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Tentar novamente
      </Button>
    </div>
  );
}
