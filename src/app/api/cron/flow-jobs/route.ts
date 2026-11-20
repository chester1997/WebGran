import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Fila do Fluxo Básico (downsell, upsell, disparo) e vencimento dos planos dos fluxos.
// Feito para um agendador externo chamar a cada minuto com "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 60;

function isAuthorized(header: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (!isAuthorized(authHeader)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const { processFlowJobs } = await import("@/lib/flows/flow-jobs");
    const result = await processFlowJobs({ budgetMs: 50_000 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/flow-jobs] Falhou:", (err as Error)?.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
