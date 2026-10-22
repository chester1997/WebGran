import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { PlatformCommissionService, PlatformCommissionUnavailableError } from '@/lib/commission/platform-commission-service';
import { z } from 'zod';

const updateCommissionSchema = z.object({
  feeCents: z.number().int({ message: 'O valor deve ser um número inteiro de centavos.' }).min(0, { message: 'O valor da comissão não pode ser negativo.' }).max(100000, { message: 'Valor máximo permitido é R$ 1.000,00.' }),
  reason: z.string().max(255).optional(),
});

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Acesso negado: Administrador não autenticado.' }, { status: 401 });
    }

    const currentCommission = await PlatformCommissionService.getCurrentCommission();
    const history = await PlatformCommissionService.getAuditHistory(30);

    return NextResponse.json({
      success: true,
      data: {
        commission: currentCommission,
        history,
      },
    });
  } catch (err: any) {
    if (err instanceof PlatformCommissionUnavailableError || err?.name === 'PlatformCommissionUnavailableError') {
      return NextResponse.json({ success: false, error: 'Configuração da comissão da plataforma temporariamente indisponível no banco de dados.' }, { status: 503 });
    }
    const status = err.message?.includes('Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message || 'Erro ao carregar comissão da plataforma.' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Acesso negado: Administrador não autenticado.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateCommissionSchema.safeParse(body);

    if (!parsed.success) {
      const errMsg = parsed.error.issues[0]?.message || 'Dados inválidos.';
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    const updated = await PlatformCommissionService.updateCommission(
      parsed.data.feeCents,
      {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
      parsed.data.reason
    );

    const history = await PlatformCommissionService.getAuditHistory(30);

    return NextResponse.json({
      success: true,
      data: {
        commission: updated,
        history,
      },
    });
  } catch (err: any) {
    if (err instanceof PlatformCommissionUnavailableError || err?.name === 'PlatformCommissionUnavailableError') {
      return NextResponse.json({ success: false, error: 'Banco de dados indisponível para atualização da comissão.' }, { status: 503 });
    }
    const status = err.message?.includes('Admin') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message || 'Erro ao atualizar comissão da plataforma.' }, { status });
  }
}
