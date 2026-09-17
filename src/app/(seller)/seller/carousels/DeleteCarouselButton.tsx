"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCarouselAction } from "./actions";

export function DeleteCarouselButton({ carouselId }: { carouselId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3000);
      return;
    }
    setLoading(true);
    try {
      await deleteCarouselAction(carouselId);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir carrossel");
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className={`h-8 px-2 text-xs transition-all ${
        confirm 
          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold" 
          : "text-zinc-400 hover:text-red-400 hover:bg-white/5"
      }`}
    >
      {confirm ? (
        <>
          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-400 animate-pulse" /> Confirmar
        </>
      ) : (
        <>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
        </>
      )}
    </Button>
  );
}
