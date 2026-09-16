import React from "react";
import { Settings, HelpCircle, LogOut, ChevronRight } from "lucide-react";

export function StudioProfile({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="p-4 pt-8 pb-24">
      <h1 className="text-2xl font-bold mb-6">Perfil</h1>
      
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-md bg-zinc-800 flex items-center justify-center text-xl font-bold">
          U
        </div>
        <div>
          <h2 className="font-bold text-lg">Usuário Telegram</h2>
          <p className="text-zinc-500 text-sm">@username</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="bg-zinc-900 rounded-md p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-zinc-400" />
            <span className="font-medium">Configurações</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </div>
        
        <div className="bg-zinc-900 rounded-md p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-zinc-400" />
            <span className="font-medium">Ajuda & Suporte</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
    </div>
  );
}
