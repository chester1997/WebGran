"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { moveCarouselPositionAction } from "./actions";

interface ReorderCarouselButtonsProps {
  carouselId: string;
  index: number;
  total: number;
}

export function ReorderCarouselButtons({ carouselId, index, total }: ReorderCarouselButtonsProps) {
  const [isMoving, setIsMoving] = useState(false);

  const handleMove = async (direction: "up" | "down") => {
    setIsMoving(true);
    try {
      await moveCarouselPositionAction(carouselId, direction);
    } catch (error) {
      console.error("Erro ao reordenar carrossel:", error);
    } finally {
      setIsMoving(false);
    }
  };

  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="flex items-center gap-1 bg-[#1A1A1E] p-1 rounded-xl border border-white/5">
      <span className="text-[10px] font-bold text-zinc-400 px-2 select-none">
        {index + 1}º
      </span>

      <button
        type="button"
        disabled={isFirst || isMoving}
        onClick={() => handleMove("up")}
        className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        title="Mover para cima"
      >
        {isMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      <button
        type="button"
        disabled={isLast || isMoving}
        onClick={() => handleMove("down")}
        className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        title="Mover para baixo"
      >
        {isMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
