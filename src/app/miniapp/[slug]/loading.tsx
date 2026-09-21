import React from "react";
import { Loader2 } from "lucide-react";

export default function MiniAppLoading() {
  return (
    <div className="w-full h-[100vh] bg-[#161616] flex flex-col items-center justify-center text-white">
      <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
      <p className="text-zinc-400 font-medium">Carregando loja...</p>
    </div>
  );
}
