"use client";

import React, { useState } from "react";
import { Boxes, Check, ShoppingCart, Sparkles, Package } from "lucide-react";
import { useCart, CartItem } from "@/components/miniapp/CartProvider";
import { ActiveComboDTO } from "@/lib/combos/combo-service";

interface ComboCardProps {
  combo: ActiveComboDTO;
  storeSlug: string;
}

export function ComboCard({ combo, storeSlug }: ComboCardProps) {
  const { items, addToCart } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const isAlreadyInCart = items.some((i) => i.id === combo.id) || justAdded;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const cartItem: CartItem = {
      id: combo.id,
      slug: combo.slug,
      title: combo.title,
      price: combo.price,
      quantity: 1,
      coverUrl: combo.coverUrl || null,
      storeId: combo.storeId,
      isCombo: true,
      comboId: combo.id,
    };

    try {
      addToCart(cartItem);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } catch (err) {
      console.error("[CART] Error adding combo to cart:", err);
    }
  };

  return (
    <div className="w-[260px] sm:w-[280px] shrink-0 bg-[#14141B] border border-white/10 hover:border-emerald-500/30 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-xl group">
      {/* Cover / Media Area */}
      <div className="relative h-36 bg-[#1A1A24] overflow-hidden flex items-center justify-center border-b border-white/5">
        {combo.coverUrl ? (
          <img
            src={combo.coverUrl}
            alt={combo.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-zinc-600">
            <Boxes className="w-10 h-10 text-emerald-500/70" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Combo VIP</span>
          </div>
        )}

        {/* Badge de Itens Inclusos */}
        <div className="absolute top-2.5 left-2.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10 flex items-center gap-1">
            <Boxes className="w-3 h-3 text-emerald-400" />
            {combo.products.length} itens
          </span>
        </div>

        {/* Badge de Desconto */}
        {combo.savingsPercentage > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-black shadow-lg">
              {combo.savingsPercentage}% OFF
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 className="font-bold text-white text-sm leading-snug line-clamp-1 group-hover:text-emerald-400 transition-colors">
            {combo.title}
          </h4>

          {combo.description && (
            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
              {combo.description}
            </p>
          )}

          {/* Lista Compacta de Produtos Inclusos */}
          <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              Incluso no pacote:
            </span>
            <div className="space-y-1 max-h-16 overflow-y-auto no-scrollbar">
              {combo.products.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-zinc-300 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{p.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing & Add Button */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 line-through block">
                R$ {combo.normalPrice.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-base font-extrabold text-emerald-400 leading-none">
                R$ {combo.price.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Poupe R$ {combo.savings.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md ${
              justAdded
                ? "bg-emerald-500 text-black border border-emerald-400"
                : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30"
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Adicionado!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>+ Adicionar Combo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
