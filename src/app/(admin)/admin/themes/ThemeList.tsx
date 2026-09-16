"use client";

import React, { useTransition } from "react";
import { toggleThemeStatus, setAsDefaultTheme } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ThemeList({ initialThemes }: { initialThemes: any[] }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleThemeStatus(id, !currentStatus);
      if (res.error) alert(res.error);
    });
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const res = await setAsDefaultTheme(id);
      if (res.error) alert(res.error);
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {initialThemes.map((theme) => (
        <div key={theme.id} className={`border rounded-lg overflow-hidden bg-card ${theme.isDefault ? 'ring-2 ring-primary' : ''}`}>
          <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground border-b">
            {theme.previewImageUrl ? (
              <img src={theme.previewImageUrl} alt={theme.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">Sem Preview</span>
            )}
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-lg">{theme.name}</h3>
                {theme.isDefault && <Badge variant="default">Padrão</Badge>}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                {theme.description || "Nenhuma descrição"}
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                slug: {theme.slug}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={theme.isActive ? "default" : "secondary"}>
                  {theme.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  disabled={isPending || theme.isDefault}
                  onClick={() => handleToggle(theme.id, theme.isActive)}
                >
                  {theme.isActive ? "Desativar" : "Ativar"}
                </Button>
                
                <Button 
                  variant="default" 
                  size="sm" 
                  className="w-full"
                  disabled={isPending || theme.isDefault || !theme.isActive}
                  onClick={() => handleSetDefault(theme.id)}
                >
                  Definir Padrão
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
