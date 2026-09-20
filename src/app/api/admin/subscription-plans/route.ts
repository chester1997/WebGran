import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const plans = await db.query.subscriptionPlans.findMany({
      orderBy: [desc(subscriptionPlans.createdAt)]
    });
    return NextResponse.json({ plans });
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao buscar planos de assinatura." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { id, name, slug, price, description, billingInterval } = await req.json();

    if (!name || !price) {
      return NextResponse.json({ error: "Nome e preço são obrigatórios." }, { status: 400 });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }

    const planSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    if (id) {
      // Update existing plan
      const updated = await db
        .update(subscriptionPlans)
        .set({
          name,
          price: numericPrice.toFixed(2),
          description: description || null,
          billingInterval: billingInterval || 'month',
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, id))
        .returning();

      return NextResponse.json({ success: true, plan: updated[0] });
    } else {
      // Create new plan
      const created = await db
        .insert(subscriptionPlans)
        .values({
          name,
          slug: planSlug,
          price: numericPrice.toFixed(2),
          description: description || null,
          billingInterval: billingInterval || 'month',
          active: true
        })
        .returning();

      return NextResponse.json({ success: true, plan: created[0] });
    }
  } catch (error: any) {
    console.error("ADMIN PLAN SAVE ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar plano de assinatura." }, { status: 500 });
  }
}
