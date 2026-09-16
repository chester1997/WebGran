"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createTheme } from "./actions";

export function ThemeForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTheme(formData);
      if (res.error) {
        alert(res.error);
      } else {
        setIsOpen(false);
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>+ Novo Tema</Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground w-full max-w-md p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-4">Cadastrar Tema</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input required name="name" className="w-full border rounded-md px-3 py-2 bg-background" placeholder="Ex: Studio" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (Identificador)</label>
                <input required name="slug" className="w-full border rounded-md px-3 py-2 bg-background font-mono text-sm" placeholder="Ex: studio" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea name="description" className="w-full border rounded-md px-3 py-2 bg-background" rows={3}></textarea>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isDefault" id="isDefault" />
                <label htmlFor="isDefault" className="text-sm font-medium">Definir como Padrão Global</label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>Salvar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
