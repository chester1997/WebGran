import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const seller = await requireSeller();

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Todos os campos de senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "A nova senha deve ter no mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "A confirmação da nova senha não confere." },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: "A nova senha não pode ser igual à senha atual." },
        { status: 400 }
      );
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    // Verify current password with bcrypt
    const isCurrentValid = await bcrypt.compare(currentPassword, userRecord.password);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "A senha atual informada está incorreta." },
        { status: 400 }
      );
    }

    // Hash the new password securely
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, seller.id));

    return NextResponse.json({
      success: true,
      message: "Senha alterada com sucesso!",
    });
  } catch (error: any) {
    if (error?.message === "Unauthorized" || error?.message?.includes("NEXT_REDIRECT")) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }
    console.error("[ChangePassword Error]:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao processar alteração de senha." },
      { status: 500 }
    );
  }
}
