import React from "react";
import { PlayCircle } from "lucide-react";

export function StudioAccesses({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="p-4 pt-8">
      <h1 className="text-2xl font-bold mb-6">Minha Lista</h1>
      
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <PlayCircle className="w-16 h-16 text-zinc-800 mb-4" />
        <p className="text-zinc-500 max-w-[250px]">
          Seus conteúdos comprados aparecerão aqui para acesso rápido.
        </p>
      </div>
    </div>
  );
}
