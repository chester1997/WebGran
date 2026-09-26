"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditCategoryModal } from "./EditCategoryModal";
import { deleteCategoryAction } from "./actions";

export function CategoryActionsMenu({ category, storeProducts = [] }: { category: any; storeProducts?: any[] }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await deleteCategoryAction(category.id);
      setOpen(false);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir categoria");
      setDeleting(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen(!open);
          setConfirmDelete(false);
        }}
        className="text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-lg cursor-pointer"
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {open && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              setOpen(false);
              setConfirmDelete(false);
            }} 
          />
          <div className="absolute right-0 bottom-full mb-1 w-44 bg-[#1A1A1E] border border-white/10 rounded-xl shadow-2xl z-50 p-1 space-y-1">
            <div onClick={() => setOpen(false)}>
              <EditCategoryModal category={category} storeProducts={storeProducts} />
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 rounded-md transition-colors cursor-pointer ${
                confirmDelete 
                  ? "bg-red-500/20 text-red-400 font-bold" 
                  : "text-red-400 hover:bg-red-500/10"
              }`}
            >
              {confirmDelete ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" /> Confirmar Exclusão
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" /> Excluir Categoria
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
