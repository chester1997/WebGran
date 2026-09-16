"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function SearchInput({ storeSlug, initialQuery }: { storeSlug: string, initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/miniapp/${storeSlug}/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/miniapp/${storeSlug}/search`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar séries, dramas..." 
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md py-3 pl-10 pr-4 text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
      />
    </form>
  );
}
