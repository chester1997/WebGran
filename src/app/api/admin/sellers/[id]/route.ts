import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, subscriptions, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireSuperAdmin();
    const { id: sellerId } = await params;
    const body = await req.json();
    const { action } = body;

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
    }

    const targetStore = await db.query.stores.findFirst({
      where: eq(stores.ownerId, sellerId),
    });

    let targetSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.sellerId, sellerId),
    });

    const now = new Date();

    // ----------------------------------------------------
    // ACTION: EDIT USER
    // ----------------------------------------------------
    if (action === "edit_user") {
      const { name, email } = body;
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Nome não pode ficar em branco." }, { status: 400 });
      }
      if (!email || !email.trim() || !email.includes("@")) {
        return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== targetUser.email) {
        const existingEmail = await db.query.users.findFirst({
          where: eq(users.email, cleanEmail),
        });
        if (existingEmail) {
          return NextResponse.json({ error: "Este e-mail já pertence a outro usuário." }, { status: 400 });
        }
      }

      await db
        .update(users)
        .set({
          name: name.trim(),
          email: cleanEmail,
          updatedAt: now,
        })
        .where(eq(users.id, sellerId));

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "EDIT_USER",
        sellerId,
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({ success: true, message: "Dados do usuário atualizados com sucesso!" });
    }

    // ----------------------------------------------------
    // ACTION: EDIT STORE
    // ----------------------------------------------------
    if (action === "edit_store") {
      const { name, slug, status } = body;
      if (!targetStore) {
        return NextResponse.json({ error: "Vendedor não possui loja associada." }, { status: 404 });
      }
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Nome da loja não pode ser vazio." }, { status: 400 });
      }

      const cleanSlug = (slug || name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!cleanSlug) {
        return NextResponse.json({ error: "Slug da loja inválido." }, { status: 400 });
      }

      if (cleanSlug !== targetStore.slug) {
        const existingSlug = await db.query.stores.findFirst({
          where: eq(stores.slug, cleanSlug),
        });
        if (existingSlug) {
          return NextResponse.json({ error: "Este slug de loja já está em uso por outro vendedor." }, { status: 400 });
        }
      }

      await db
        .update(stores)
        .set({
          name: name.trim(),
          slug: cleanSlug,
          status: status || targetStore.status,
          updatedAt: now,
        })
        .where(eq(stores.id, targetStore.id));

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "EDIT_STORE",
        sellerId,
        storeId: targetStore.id,
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({ success: true, message: "Loja atualizada com sucesso!" });
    }

    // ----------------------------------------------------
    // ACTION: SUSPEND
    // ----------------------------------------------------
    if (action === "suspend") {
      if (targetStore) {
        await db
          .update(stores)
          .set({ status: "suspended", updatedAt: now })
          .where(eq(stores.id, targetStore.id));
      }

      if (targetSub) {
        await db
          .update(subscriptions)
          .set({ status: "SUSPENDED", updatedAt: now })
          .where(eq(subscriptions.id, targetSub.id));
      }

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "SUSPEND_SELLER",
        sellerId,
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({ success: true, message: "Acesso do vendedor suspenso com sucesso!" });
    }

    // ----------------------------------------------------
    // ACTION: REACTIVATE
    // ----------------------------------------------------
    if (action === "reactivate") {
      if (targetStore) {
        await db
          .update(stores)
          .set({ status: "active", updatedAt: now })
          .where(eq(stores.id, targetStore.id));
      }

      if (targetSub) {
        await db
          .update(subscriptions)
          .set({ status: "ACTIVE", updatedAt: now })
          .where(eq(subscriptions.id, targetSub.id));
      }

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "REACTIVATE_SELLER",
        sellerId,
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({ success: true, message: "Acesso do vendedor reativado com sucesso!" });
    }

    // ----------------------------------------------------
    // ACTION: RESET PASSWORD
    // ----------------------------------------------------
    if (action === "reset_password") {
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db
        .update(users)
        .set({ password: hashedPassword, updatedAt: now })
        .where(eq(users.id, sellerId));

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "RESET_SELLER_PASSWORD",
        sellerId,
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({ success: true, message: "Senha redefinida com sucesso!" });
    }

    // ----------------------------------------------------
    // ACTION: RELEASE SUBSCRIPTION (LIBERAR MENSALIDADE)
    // ----------------------------------------------------
    if (action === "release_subscription") {
      const { daysToExtend = 30 } = body;
      const daysNum = Math.max(1, Number(daysToExtend) || 30);

      const baseDate = targetSub && targetSub.currentPeriodEnd && new Date(targetSub.currentPeriodEnd) > now
        ? new Date(targetSub.currentPeriodEnd)
        : now;

      const newPeriodEnd = new Date(baseDate.getTime() + daysNum * 24 * 60 * 60 * 1000);

      if (targetSub) {
        await db
          .update(subscriptions)
          .set({
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: newPeriodEnd,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, targetSub.id));
      }

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "RELEASE_SUBSCRIPTION",
        sellerId,
        daysToExtend: daysNum,
        newPeriodEnd: newPeriodEnd.toISOString(),
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({
        success: true,
        message: `Mensalidade liberada com sucesso por ${daysNum} dias!`,
        newPeriodEnd: newPeriodEnd.toISOString(),
      });
    }

    return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN PATCH SELLER ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao atualizar vendedor." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireSuperAdmin();
    const { id: sellerId } = await params;

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
    }

    const targetStore = await db.query.stores.findFirst({
      where: eq(stores.ownerId, sellerId),
    });

    // Check if store has any orders
    let hasOrders = false;
    if (targetStore) {
      const storeOrders = await db.query.orders.findMany({
        where: eq(orders.storeId, targetStore.id),
        limit: 1,
      });
      if (storeOrders.length > 0) {
        hasOrders = true;
      }
    }

    const now = new Date();

    if (hasOrders) {
      // Perform Soft Delete / Deactivation to preserve historical financial and order logs
      if (targetStore) {
        await db
          .update(stores)
          .set({ status: "inactive", updatedAt: now })
          .where(eq(stores.id, targetStore.id));
      }

      await db
        .update(users)
        .set({
          email: `deactivated_${Date.now()}_${targetUser.email}`,
          updatedAt: now,
        })
        .where(eq(users.id, sellerId));

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "SOFT_DELETE_SELLER",
        sellerId,
        reason: "Seller has historic orders; deactivated instead of hard delete.",
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({
        success: true,
        message: "Vendedor desativado com sucesso (registros históricos de pedidos e financeiro preservados).",
        softDelete: true,
      });
    } else {
      // Hard delete if no orders exist
      if (targetStore) {
        await db.delete(stores).where(eq(stores.id, targetStore.id));
      }
      await db.delete(subscriptions).where(eq(subscriptions.sellerId, sellerId));
      await db.delete(users).where(eq(users.id, sellerId));

      console.log("[ADMIN_AUDIT]", JSON.stringify({
        adminId: adminUser.id,
        action: "HARD_DELETE_SELLER",
        sellerId,
        timestamp: now.toISOString(),
      }));

      return NextResponse.json({
        success: true,
        message: "Vendedor e loja removidos permanentemente.",
        softDelete: false,
      });
    }
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado. Requer nível SUPER_ADMIN." }, { status: 403 });
    }
    console.error("ADMIN DELETE SELLER ERROR:", error);
    return NextResponse.json({ error: error.message || "Erro ao excluir vendedor." }, { status: 500 });
  }
}
