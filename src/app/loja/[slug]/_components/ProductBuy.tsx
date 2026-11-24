"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayCircle, ShoppingBag, Zap } from "lucide-react";
import { useCart } from "./cart";
import { BTN_GHOST, BTN_PRIMARY } from "./ui";

export function ProductBuy({ slug, productId, owned }: { slug: string; productId: string; owned: boolean }) {
  const { add, lines } = useCart();
  const router = useRouter();
  if (owned) {
    return (
      <Link href={`/loja/${slug}/conta/produto/${productId}`} className={`${BTN_PRIMARY} h-12 text-[15px]`}>
        <PlayCircle className="w-5 h-5" /> Você já tem este produto. Acessar
      </Link>
    );
  }
  const inCart = lines.some((l) => l.id === productId);
  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      <button
        type="button"
        className={`${BTN_PRIMARY} h-12 text-[15px]`}
        onClick={() => {
          if (!inCart) add(productId);
          router.push(`/loja/${slug}/carrinho`);
        }}
      >
        <Zap className="w-5 h-5" /> Comprar agora
      </button>
      <button type="button" className={`${BTN_GHOST} h-12 text-[15px]`} onClick={() => add(productId)}>
        <ShoppingBag className="w-5 h-5" /> {inCart ? "Adicionar mais um" : "Adicionar ao carrinho"}
      </button>
    </div>
  );
}
