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
    const summary = {
      ok: true,
      expiredAccesses: {
        processed: result.processedCount,
        revocationErrors: result.results.filter((r) => r.error).length,
      },
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
