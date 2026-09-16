import React from "react";
import { Search } from "lucide-react";

export function StudioSearch({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="p-4 pt-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Buscar séries, dramas..." 
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-3 pl-10 pr-4 text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
        />
      </div>
      <div className="mt-8 text-center text-zinc-600 text-sm">
        Busca em desenvolvimento...
      </div>
    </div>
  );
}
