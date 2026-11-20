import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processExpiredAccesses } from "@/lib/orders/expiration-service";

// Job diário disparado pelo Vercel Cron (ver vercel.json): expira acessos vencidos e remove o comprador do grupo/canal.
// Não apaga nenhuma mídia do Bunny.
// O Vercel envia "Authorization: Bearer <CRON_SECRET>" quando a variável CRON_SECRET está definida no projeto.
export const maxDuration = 60;

function isAuthorized(header: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(req: NextRequest) {
  // Ler o header primeiro torna a rota dinâmica e impede que o job rode durante o prerender do build.
  const authHeader = req.headers.get("authorization") || "";

  if (!process.env.CRON_SECRET) {
    console.error("[cron/maintenance] CRON_SECRET não configurado; job não executado.");
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  if (!isAuthorized(authHeader)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await processExpiredAccesses();
    // Planos dos fluxos (Meus Fluxos). Falha aqui não derruba o job dos acessos normais.
    let expiredFlowPlans: { processed: number; removed: number; failed: number } | { error: string };
    try {
      const { processExpiredFlowPurchases } = await import("@/lib/flows/flow-delivery");
      expiredFlowPlans = await processExpiredFlowPurchases();
    } catch (flowErr: any) {
      console.error("[cron/maintenance] processExpiredFlowPurchases falhou:", flowErr);
      expiredFlowPlans = { error: flowErr?.message || String(flowErr) };
    }
    // Fila do fluxo (downsell, upsell, disparo) também roda aqui, como rede de segurança.
    try {
      const { processFlowJobs } = await import("@/lib/flows/flow-jobs");
      await processFlowJobs({ budgetMs: 25_000 });
    } catch (jobsErr) {
      console.error("[cron/maintenance] processFlowJobs falhou:", (jobsErr as Error)?.message || jobsErr);
    }
    const summary = {
      ok: true,
      expiredAccesses: {
        processed: result.processedCount,
        revocationErrors: result.results.filter((r) => r.error).length,
      },
      expiredFlowPlans,
      durationMs: Date.now() - startedAt,
    };
    console.log("[cron/maintenance] concluído:", JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("[cron/maintenance] processExpiredAccesses falhou:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
