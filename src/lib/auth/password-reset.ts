import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isOwnerUser } from "@/lib/bots/owner-guard";

/**
 * "Esqueci minha senha" dos lojistas: confirma o e-mail cadastrado e grava a nova senha na hora.
 * Contas admin/super admin e a conta proprietária ficam de fora (trocam só pelo painel).
 */
export async function findSellerForReset(email: string) {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const [u] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${e}`)
    .limit(1);
  if (!u) return null;
  const role = (u.role || "").toLowerCase();
  if (role === "admin" || role === "super_admin" || isOwnerUser(u)) return { ...u, blocked: true as const };
  return { ...u, blocked: false as const };
}

export async function setNewPassword(userId: string, password: string) {
  const hash = await bcrypt.hash(password, 10);
  await db.update(users).set({ password: hash, updatedAt: new Date() }).where(eq(users.id, userId));
}
