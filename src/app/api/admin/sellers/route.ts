import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, subscriptions, subscriptionPlans, invoices, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { getDefaultPlan } from "@/lib/billing/subscription-service";
import { loadAdminSellersList } from "@/lib/commission/seller-admin-query";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const sellers = await loadAdminSellersList();
    return NextResponse.json({ sellers });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN GET SELLERS ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao buscar vendedores." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requirePlatformAdmin();
    const body = await req.json();

    const { name, email, password, storeName, storeSlug, status = 'active', daysActive = 30 } = body;

    // 1. Validations
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nome do vendedor é obrigatório." }, { status: 400 });
    }

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: "E-mail válido é obrigatório." }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    if (!storeName || !storeName.trim()) {
      return NextResponse.json({ error: "Nome da loja é obrigatório." }, { status: 400 });
    }

    const cleanSlug = (storeSlug || storeName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) {
      return NextResponse.json({ error: "Slug da loja inválido." }, { status: 400 });
    }

    // Check email uniqueness
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.trim().toLowerCase())
    });

    if (existingUser) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado no sistema." }, { status: 400 });
    }

    // Check store slug uniqueness
    const existingStore = await db.query.stores.findFirst({
      where: eq(stores.slug, cleanSlug)
    });

    if (existingStore) {
      return NextResponse.json({ error: "Este slug de loja já está em uso por outro vendedor." }, { status: 400 });
    }

    // 2. Create User
    const hashedPassword = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: 'seller'
    }).returning();

    // 3. Create Subscription
    const plan = await getDefaultPlan();
    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + (Number(daysActive) || 30) * 24 * 60 * 60 * 1000);

    const initialSubStatus = status === 'suspended' ? 'SUSPENDED' : 'ACTIVE';

    const [newSubscription] = await db.insert(subscriptions).values({
      sellerId: newUser.id,
      planId: plan.id,
      status: initialSubStatus,
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd
    }).returning();

    // 4. Create Store
    const { checkLimit } = await import("@/lib/entitlements/entitlement-service");
    const storeCheck = await checkLimit(newUser.id, "max_stores", 0);
    if (!storeCheck.allowed) {
      return NextResponse.json({ error: "A criação de lojas para este vendedor excede a quota permitida." }, { status: 403 });
    }

    const initialStoreStatus = status === 'suspended' ? 'suspended' : 'active';
    const [newStore] = await db.insert(stores).values({
      ownerId: newUser.id,
      name: storeName.trim(),
      slug: cleanSlug,
      status: initialStoreStatus
    }).returning();

    // 5. Audit Log
    console.log("[ADMIN_AUDIT]", JSON.stringify({
      adminId: adminUser.id,
      action: "CREATE_SELLER",
      sellerId: newUser.id,
      storeId: newStore.id,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: "Vendedor e loja criados com sucesso!",
      seller: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        store: {
          id: newStore.id,
          name: newStore.name,
          slug: newStore.slug,
          status: newStore.status
        }
      }
    });

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN POST SELLER ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar vendedor." }, { status: 500 });
  }
}
