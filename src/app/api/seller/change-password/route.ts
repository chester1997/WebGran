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
        { success: false, error: "Todos os campos de senha sÃ£o obrigatÃ³rios." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "A nova senha deve ter no mÃ­nimo 6 caracteres." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "A confirmaÃ§Ã£o da nova senha nÃ£o confere." },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: "A nova senha nÃ£o pode ser igual Ã  senha atual." },
        { status: 400 }
      );
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, seller.id),
    });

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "UsuÃ¡rio nÃ£o encontrado." },
        { status: 404 }
      );
    }

    // Verify current password with bcrypt
    const isCurrentValid = await bcrypt.compare(currentPassword, userRecord.password);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "A senha atual informada estÃ¡ incorreta." },
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
      return NextResponse.json({ success: false, error: "NÃ£o autorizado." }, { status: 401 });
    }
    console.error("[ChangePassword Error]:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao processar alteraÃ§Ã£o de senha." },
      { status: 500 }
    );
  }
}
