import { NextResponse } from "next/server";
import { db } from "@/db";
import { coupons, stores } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storeId, storeSlug, code, cartTotal } = body;

    if ((!storeId && !storeSlug) || !code) {
      return NextResponse.json(
        { success: false, error: "Loja e código do cupom são obrigatórios." },
        { status: 400 }
      );
    }

    let targetStoreId = storeId;
    if (!targetStoreId && storeSlug) {
      const s = await db.query.stores.findFirst({
        where: eq(stores.slug, storeSlug),
      });
      if (s) {
        targetStoreId = s.id;
      }
    }

    if (!targetStoreId) {
      return NextResponse.json(
        { success: false, error: "Loja não encontrada." },
        { status: 404 }
      );
    }

    const cleanCode = String(code).trim().toUpperCase();
    const total = parseFloat(cartTotal) || 0;

    // Fetch coupon from DB
    const list = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.storeId, targetStoreId),
          sql`UPPER(${coupons.code}) = ${cleanCode}`
        )
      );

    if (list.length === 0) {
      return NextResponse.json(
        { success: false, error: "Cupom inválido ou não encontrado." },
        { status: 404 }
      );
    }

    const coupon = list[0];

    if (coupon.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Este cupom não está ativo." },
        { status: 400 }
      );
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Este cupom já expirou." },
        { status: 400 }
      );
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { success: false, error: "Este cupom atingiu o limite máximo de utilizações." },
        { status: 400 }
      );
    }

    const minOrder = coupon.minOrderValue ? parseFloat(coupon.minOrderValue) : 0;
    if (minOrder > 0 && total < minOrder) {
      return NextResponse.json(
        {
          success: false,
          error: `Este cupom é válido apenas para compras a partir de R$ ${minOrder.toLocaleString(
            "pt-BR",
            { minimumFractionDigits: 2 }
          )}.`,
        },
        { status: 400 }
      );
    }

    const discountVal = parseFloat(coupon.discountValue);
    let discountAmount = 0;

    if (coupon.discountType === "percentage") {
      discountAmount = (total * discountVal) / 100;
    } else {
      discountAmount = Math.min(total, discountVal);
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;

    return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: discountVal,
        discountAmount,
      },
    });
  } catch (error: any) {
    console.error("Erro ao validar cupom:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao validar cupom." },
      { status: 500 }
    );
  }
}
