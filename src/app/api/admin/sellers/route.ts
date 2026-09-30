import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, subscriptions, subscriptionPlans, invoices, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { getDefaultPlan } from "@/lib/billing/subscription-service";

export async function GET() {
  try {
    const adminUser = await requireSuperAdmin();

    const sellersData = await db.query.users.findMany({
      where: eq(users.role, 'seller'),
      with: {
        stores: true
      },
      orderBy: [desc(users.createdAt)]
    });

    const sellersWithBilling = await Promise.all(
      sellersData.map(async (seller) => {
        const sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.sellerId, seller.id),
          with: {
            plan: true,
            invoices: {
              orderBy: [desc(invoices.createdAt)],
              limit: 5
            }
          }
        });

        const store = seller.stores[0] || null;

        // Calculate seller status
        let computedStatus = 'active';
        if (store?.status === 'suspended' || sub?.status === 'SUSPENDED') {
          computedStatus = 'suspended';
        } else if (store?.status === 'inactive') {
          computedStatus = 'inactive';
        } else if (sub?.status === 'PAST_DUE' || sub?.status === 'EXPIRED') {
          computedStatus = 'pending';
        }

        const now = new Date();
        const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
        const isExpired = periodEnd ? periodEnd < now : false;

        return {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          role: seller.role,
          createdAt: seller.createdAt ? new Date(seller.createdAt).toISOString() : new Date().toISOString(),
          status: computedStatus,
          store: store ? {
            id: store.id,
            name: store.name,
            slug: store.slug,
            status: store.status,
            createdAt: store.createdAt ? new Date(store.createdAt).toISOString() : new Date().toISOString()
          } : null,
          subscription: sub ? {
            id: sub.id,
            planName: sub.plan?.name || 'WebGran SaaS',
            price: sub.plan?.price ? Number(sub.plan.price) : 89.90,
            status: sub.status,
            currentPeriodStart: sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toISOString() : null,
            currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
            isExpired
          } : null,
          latestInvoice: sub?.invoices && sub.invoices.length > 0 ? {
            id: sub.invoices[0].id,
            amount: Number(sub.invoices[0].amount),
            status: sub.invoices[0].status,
            provider: sub.invoices[0].provider,
            externalId: sub.invoices[0].externalId,
            paidAt: sub.invoices[0].paidAt ? new Date(sub.invoices[0].paidAt).toISOString() : null,
            dueDate: sub.invoices[0].dueDate ? new Date(sub.invoices[0].dueDate).toISOString() : null
          } : null
        };
      })
    );

    return NextResponse.json({ sellers: sellersWithBilling });
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
    const adminUser = await requireSuperAdmin();
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
