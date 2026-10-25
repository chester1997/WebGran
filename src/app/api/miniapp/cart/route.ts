import { NextRequest, NextResponse } from "next/server";
import { getMiniAppSession, resolveMiniAppCustomerSession } from "@/lib/telegram/session";
import { CartService } from "@/lib/cart/cart-service";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

async function authenticateSession(req: NextRequest, storeSlugParam?: string | null) {
  let session = await getMiniAppSession();
  if (!session?.customerId || !session?.storeId) {
    session = await resolveMiniAppCustomerSession(req);
  }

  if (!session?.customerId || !session?.storeId) {
    return { error: "Não autenticado. Sessão do Mini App inválida ou expirada.", status: 401 };
  }

  if (storeSlugParam) {
    const store = await db.query.stores.findFirst({
      where: eq(stores.slug, storeSlugParam.trim()),
    });

    if (!store) {
      return { error: "Loja não encontrada.", status: 404 };
    }

    if (store.id !== session.storeId) {
      return { error: "Acesso negado: a sessão atual não pertence a esta loja.", status: 403 };
    }
  }

  return { session };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storeSlug = searchParams.get("storeSlug") || req.headers.get("x-store-slug");

    const auth = await authenticateSession(req, storeSlug);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { session } = auth;
    const cart = await CartService.getCart(session.storeId, session.customerId);

    return NextResponse.json({ success: true, cart });
  } catch (error: any) {
    console.error("[API MiniApp Cart GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar o carrinho." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, storeSlug, productId, comboId, isCombo, quantity, items } = body;

    const auth = await authenticateSession(req, storeSlug);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { session } = auth;

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { success: false, error: "Ação não especificada." },
        { status: 400 }
      );
    }

    let updatedCart;

    switch (action.toLowerCase().trim()) {
      case "add": {
        const targetComboId = comboId || (isCombo ? productId : null);
        const targetProductId = !targetComboId ? productId : null;

        if (!targetComboId && !targetProductId) {
          return NextResponse.json(
            { success: false, error: "productId ou comboId é obrigatório para adicionar ao carrinho." },
            { status: 400 }
          );
        }

        const qty = quantity !== undefined ? Number(quantity) : 1;
        if (targetComboId) {
          updatedCart = await CartService.addComboItem(
            session.storeId,
            session.customerId,
            targetComboId,
            qty
          );
        } else {
          updatedCart = await CartService.addItem(
            session.storeId,
            session.customerId,
            targetProductId!,
            qty
          );
        }
        break;
      }

      case "update": {
        const itemId = productId || comboId;
        if (!itemId || typeof itemId !== "string") {
          return NextResponse.json(
            { success: false, error: "productId ou comboId é obrigatório para atualizar o carrinho." },
            { status: 400 }
          );
        }
        if (quantity === undefined || !Number.isFinite(Number(quantity))) {
          return NextResponse.json(
            { success: false, error: "quantity válida é obrigatória para atualizar o carrinho." },
            { status: 400 }
          );
        }
        updatedCart = await CartService.updateItemQuantity(
          session.storeId,
          session.customerId,
          itemId,
          Number(quantity)
        );
        break;
      }

      case "remove": {
        const itemId = productId || comboId;
        if (!itemId || typeof itemId !== "string") {
          return NextResponse.json(
            { success: false, error: "productId ou comboId é obrigatório para remover do carrinho." },
            { status: 400 }
          );
        }
        updatedCart = await CartService.removeItem(session.storeId, session.customerId, itemId);
        break;
      }

      case "clear": {
        updatedCart = await CartService.clearCart(session.storeId, session.customerId);
        break;
      }

      case "sync": {
        const localList = Array.isArray(items) ? items : [];
        updatedCart = await CartService.syncLocalItems(session.storeId, session.customerId, localList);
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Ação '${action}' não reconhecida.` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, cart: updatedCart });
  } catch (error: any) {
    console.error("[API MiniApp Cart POST Error]:", error);
    const isClientError =
      error.message?.includes("inválida") ||
      error.message?.includes("não encontrado") ||
      error.message?.includes("máxima permitida") ||
      error.message?.includes("disponível") ||
      error.message?.includes("pertencente") ||
      error.message?.includes("obrigatório");

    return NextResponse.json(
      { success: false, error: error.message || "Erro ao processar alteração no carrinho." },
      { status: isClientError ? 400 : 500 }
    );
  }
}
