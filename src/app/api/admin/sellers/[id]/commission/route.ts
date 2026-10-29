import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  SellerCommissionService,
  SellerCommissionValidationError,
  SellerCommissionConcurrencyError,
} from "@/lib/commission/seller-commission-service";

/**
 * GET /api/admin/sellers/[id]/commission
 * Returns current commission configuration, effective fee, and immutable audit history.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id: sellerId } = await params;

    if (!sellerId || typeof sellerId !== "string") {
      return NextResponse.json(
        { success: false, error: "Identificador do vendedor é inválido." },
        { status: 400 }
      );
    }

    const seller = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!seller) {
      return NextResponse.json(
        { success: false, error: "Vendedor não encontrado." },
        { status: 404 }
      );
    }

    const [effectiveFee, setting, history] = await Promise.all([
      SellerCommissionService.resolveEffectiveFee(sellerId, new Date()),
      SellerCommissionService.getSellerCommissionSetting(sellerId),
      SellerCommissionService.getSellerCommissionHistory(sellerId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        seller,
        effectiveFee,
        setting,
        history,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Sessão não autenticada." },
        { status: 401 }
      );
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Acesso negado. Apenas administradores podem acessar." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao consultar taxa do vendedor." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/sellers/[id]/commission
 * Updates seller custom fee and/or exemption status with atomic versioning & audit trail.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePlatformAdmin();
    const { id: sellerId } = await params;

    if (!sellerId || typeof sellerId !== "string") {
      return NextResponse.json(
        { success: false, error: "Identificador do vendedor é inválido." },
        { status: 400 }
      );
    }

    const seller = await db.query.users.findFirst({
      where: eq(users.id, sellerId),
      columns: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!seller) {
      return NextResponse.json(
        { success: false, error: "Vendedor não encontrado." },
        { status: 404 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Corpo da requisição inválido (esperado JSON)." },
        { status: 400 }
      );
    }

    const {
      mode,
      customFeeCents,
      exemptionActive,
      exemptionStart,
      exemptionEnd,
      exemptionReason,
      expectedVersion,
      reason,
    } = body || {};

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: "A justificativa da alteração é obrigatória." },
        { status: 400 }
      );
    }

    // Determine payload based on explicit mode or direct fields
    let targetCustomFeeCents: number | null | undefined = customFeeCents;
    let targetExemptionActive: boolean | undefined = exemptionActive;
    let targetExemptionStart: any = exemptionStart;
    let targetExemptionEnd: any = exemptionEnd;
    let targetExemptionReason: string | null | undefined = exemptionReason;

    if (mode === "DEFAULT") {
      targetCustomFeeCents = null;
      targetExemptionActive = false;
      targetExemptionStart = null;
      targetExemptionEnd = null;
      targetExemptionReason = null;
    } else if (mode === "CUSTOM") {
      if (typeof customFeeCents !== "number" || isNaN(customFeeCents) || customFeeCents < 0 || customFeeCents > 50) {
        return NextResponse.json(
          { success: false, error: "Taxa personalizada deve ser um valor entre R$ 0,00 e R$ 0,50 (0 a 50 centavos)." },
          { status: 400 }
        );
      }
      targetCustomFeeCents = customFeeCents;
      targetExemptionActive = false;
      targetExemptionStart = null;
      targetExemptionEnd = null;
      targetExemptionReason = null;
    } else if (mode === "EXEMPTION") {
      targetExemptionActive = true;
      if (!exemptionReason || !String(exemptionReason).trim()) {
        return NextResponse.json(
          { success: false, error: "A justificativa da isenção temporária é obrigatória." },
          { status: 400 }
        );
      }
    }

    const updatedSetting = await SellerCommissionService.updateSellerCommission({
      sellerId,
      customFeeCents: targetCustomFeeCents,
      exemptionActive: targetExemptionActive,
      exemptionStart: targetExemptionStart,
      exemptionEnd: targetExemptionEnd,
      exemptionReason: targetExemptionReason,
      expectedVersion: typeof expectedVersion === "number" ? expectedVersion : undefined,
      reason: reason.trim(),
      adminUser: {
        id: adminUser.id,
        name: adminUser.name || null,
        email: adminUser.email || null,
      },
    });

    const newEffectiveFee = await SellerCommissionService.resolveEffectiveFee(sellerId, new Date());

    return NextResponse.json({
      success: true,
      message: "Taxa do vendedor atualizada com sucesso!",
      data: {
        setting: updatedSetting,
        effectiveFee: newEffectiveFee,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Sessão não autenticada." },
        { status: 401 }
      );
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Acesso negado. Apenas administradores podem modificar taxas." },
        { status: 403 }
      );
    }
    if (err instanceof SellerCommissionConcurrencyError || err?.name === "SellerCommissionConcurrencyError") {
      return NextResponse.json(
        { success: false, error: err.message, code: "CONCURRENCY_CONFLICT" },
        { status: 409 }
      );
    }
    if (err instanceof SellerCommissionValidationError || err?.name === "SellerCommissionValidationError") {
      return NextResponse.json(
        { success: false, error: err.message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao atualizar taxa do vendedor." },
      { status: 500 }
    );
  }
}

export const POST = PATCH;

