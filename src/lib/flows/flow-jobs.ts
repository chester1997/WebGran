/**
 * Fila de tarefas agendadas do Fluxo Básico (tabela flow_jobs, migration 0026).
 *
 *  - downsell:  oferta com desconto para quem deu /start ou gerou Pix e não pagou.
 *  - upsell:    oferta depois que o plano foi entregue.
 *  - broadcast: uma mensagem do Disparo para um lead.
 *
 * Quem processa: a rota /api/cron/flow-jobs (agendador externo a cada minuto), o cron diário
 * e, "de carona", cada interação com um bot de fluxo (after() no webhook).
 * Tudo é fail-open: sem a tabela, agendar e processar viram nada.
 */
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { flowBroadcasts, flowJobs, flowPurchases, orders, telegramBots, telegramCustomers } from "@/db/schema";
import { decrypt } from "@/lib/encryption";
import type { DelayUnit } from "./basic-config";

export type JobKind = "downsell" | "upsell" | "broadcast" | "adv_step" | "adv_wait" | "adv_pix";

function isMissing(err: unknown) {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code;
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`;
  return code === "42P01" || code === "42703" || /(relation|column) .* does not exist/i.test(msg);
}

/** Atraso configurado → milissegundos. */
export function delayMs(unit: DelayUnit, value: number): number {
  const n = Math.max(0, Math.round(Number(value) || 0));
  switch (unit) {
    case "imediato": return 0;
    case "segundos": return n * 1000;
    case "minutos": return n * 60_000;
    case "horas": return n * 3_600_000;
    case "dias": return n * 86_400_000;
    default: return 0;
  }
}

export interface ScheduleInput {
  storeId: string;
  botId: string;
  flowId: string | null;
  telegramUserId: string;
  kind: JobKind;
  ref: string;
  runAt: Date;
  payload?: Record<string, unknown>;
}

/** Agenda tarefas. Ignora repetidas (mesma pessoa, tipo e oferta ainda pendente). */
export async function scheduleFlowJobs(items: ScheduleInput[]): Promise<number> {
  if (!items.length) return 0;
  try {
    let n = 0;
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      const rows = await db
        .insert(flowJobs)
        .values(chunk.map((j) => ({ storeId: j.storeId, botId: j.botId, flowId: j.flowId, telegramUserId: String(j.telegramUserId), kind: j.kind, ref: j.ref, runAt: j.runAt, payload: j.payload || {} })))
        .onConflictDoNothing()
        .returning({ id: flowJobs.id });
      n += rows.length;
    }
    return n;
  } catch (err) {
    if (!isMissing(err)) console.error("[flow-jobs] Falha ao agendar:", (err as Error)?.message);
    return 0;
  }
}

/** Cancela tarefas pendentes de uma pessoa (ex.: ela pagou, então não recebe mais downsell). */
export async function cancelFlowJobs(botId: string, telegramUserId: string, kinds: JobKind[]) {
  try {
    await db
      .update(flowJobs)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(and(eq(flowJobs.botId, botId), eq(flowJobs.telegramUserId, String(telegramUserId)), eq(flowJobs.status, "pending"), inArray(flowJobs.kind, kinds)));
  } catch (err) {
    if (!isMissing(err)) console.warn("[flow-jobs] Falha ao cancelar:", (err as Error)?.message);
  }
}

/** A pessoa pagou alguma compra do fluxo neste bot depois de `since`? */
async function paidSince(botId: string, telegramUserId: string, since: Date): Promise<boolean> {
  const rows = await db
    .select({ id: flowPurchases.id })
    .from(flowPurchases)
    .innerJoin(orders, eq(orders.id, flowPurchases.orderId))
    .innerJoin(telegramCustomers, eq(telegramCustomers.id, flowPurchases.customerId))
    .where(and(eq(flowPurchases.botId, botId), eq(telegramCustomers.telegramUserId, String(telegramUserId)), eq(orders.status, "paid"), gt(orders.paidAt, since)))
    .limit(1);
  return rows.length > 0;
}

type Job = typeof flowJobs.$inferSelect;

let ticking = false;

/**
 * Processa as tarefas vencidas. Também vence planos expirados (assim planos curtos acabam na hora).
 * `budgetMs` limita o tempo total para caber na duração da função.
 */
export async function processFlowJobs(opts: { budgetMs?: number; limit?: number } = {}): Promise<{ done: number; failed: number; skipped: number }> {
  const out = { done: 0, failed: 0, skipped: 0 };
  if (ticking) return out; // mesma instância: uma passada por vez
  ticking = true;
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const limit = opts.limit ?? 400;
  const tokens = new Map<string, { token: string; tgBotId: string } | null>();
  const runtime = await import("./flow-runtime");
  const flows = new Map<string, Awaited<ReturnType<typeof runtime.getBasicFlowForBot>>>();

  try {
    try {
      const { processExpiredFlowPurchases } = await import("./flow-delivery");
      await processExpiredFlowPurchases(50);
    } catch (err) {
      console.warn("[flow-jobs] Expiração falhou:", (err as Error)?.message);
    }
    // Acessos vencidos dos produtos (Diário, Semanal, Mensal...): remove do grupo/canal logo após vencer
    try {
      const { tickExpiredAccesses } = await import("@/lib/orders/expiration-service");
      await tickExpiredAccesses();
    } catch (err) {
      console.warn("[flow-jobs] Expiração de acessos falhou:", (err as Error)?.message);
    }

    let processed = 0;
    while (Date.now() < deadline && processed < limit) {
      let due: Job[];
      try {
        due = await db
          .select()
          .from(flowJobs)
          .where(and(eq(flowJobs.status, "pending"), lte(flowJobs.runAt, new Date())))
          .orderBy(asc(flowJobs.runAt))
          .limit(Math.min(50, limit - processed));
      } catch (err) {
        if (!isMissing(err)) console.error("[flow-jobs] Falha ao ler a fila:", (err as Error)?.message);
        break;
      }
      if (!due.length) break;

      for (const job of due) {
        if (Date.now() >= deadline) break;
        // Trava: só um processo pega cada tarefa.
        const claimed = await db
          .update(flowJobs)
          .set({ status: "running", attempts: sql`${flowJobs.attempts} + 1`, updatedAt: new Date() })
          .where(and(eq(flowJobs.id, job.id), eq(flowJobs.status, "pending")))
          .returning({ id: flowJobs.id });
        if (!claimed.length) continue;
        processed++;

        let status: "done" | "failed" | "canceled" = "done";
        let error: string | null = null;
        try {
          if (!tokens.has(job.botId)) {
            const bot = await db.query.telegramBots.findFirst({ where: eq(telegramBots.id, job.botId), columns: { tokenEncrypted: true, botId: true } });
            tokens.set(job.botId, bot?.tokenEncrypted ? { token: decrypt(bot.tokenEncrypted), tgBotId: bot.botId } : null);
          }
          const tg = tokens.get(job.botId);
          if (job.kind.startsWith("adv_")) {
            // Fluxo avançado (espera, pergunta sem resposta, Pix não pago).
            if (!tg) {
              status = "canceled";
              error = "Bot sem token.";
            } else {
              const { runAdvancedJob } = await import("./advanced-runtime");
              status = await runAdvancedJob(job, tg.token);
            }
          } else {
            if (!flows.has(job.botId)) flows.set(job.botId, await runtime.getBasicFlowForBot(job.botId, { includeDraft: true }));
            const flow = flows.get(job.botId);
            if (!tg || !flow || (job.flowId && flow.flowId !== job.flowId)) {
              status = "canceled";
              error = "Bot ou fluxo não está mais ligado.";
            } else {
              const mode = flow.status === "published" ? "live" : "test";
              const ctx = { token: tg.token, storeId: job.storeId, storeSlug: "", botDbId: job.botId };
              const payload = (job.payload || {}) as Record<string, unknown>;

              if (job.kind === "downsell") {
                const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
                let skip = await paidSince(job.botId, job.telegramUserId, job.createdAt);
                if (!skip && orderId) {
                  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { status: true } });
                  skip = o?.status === "paid";
                }
                if (skip) status = "canceled";
                else if (!(await runtime.sendDownsellOffer(ctx, flow, mode, job.telegramUserId, job.ref, String(payload.firstName || "")))) status = "canceled";
              } else if (job.kind === "upsell") {
                if (!(await runtime.sendUpsellOffer(ctx, flow, mode, job.telegramUserId, job.ref))) status = "canceled";
              } else if (job.kind === "broadcast") {
                const ok = await sendBroadcastItem(ctx, flow, job);
                if (ok === null) status = "canceled";
                else if (!ok) { status = "failed"; error = "Não entregue (bloqueou o bot ou saiu)."; }
                await new Promise((r) => setTimeout(r, 40)); // ~25 mensagens/s, abaixo do limite do Telegram
              } else {
                status = "canceled";
              }
            }
          }
        } catch (err) {
          status = "failed";
          error = ((err as Error)?.message || "Falha").slice(0, 500);
        }

        await db.update(flowJobs).set({ status, error, updatedAt: new Date() }).where(eq(flowJobs.id, job.id));
        if (status === "done") out.done++;
        else if (status === "failed") out.failed++;
        else out.skipped++;
      }
    }

    // Disparos sem nada pendente terminam.
    try {
      await db.execute(sql`
        UPDATE flow_broadcasts b SET status = 'done', updated_at = NOW()
        WHERE b.status = 'running'
          AND NOT EXISTS (SELECT 1 FROM flow_jobs j WHERE j.kind = 'broadcast' AND j.ref = b.id::text AND j.status IN ('pending', 'running'))
      `);
    } catch (err) {
      if (!isMissing(err)) console.warn("[flow-jobs] Falha ao fechar disparos:", (err as Error)?.message);
    }
  } finally {
    ticking = false;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Disparo                                                             */
/* ------------------------------------------------------------------ */
export type BroadcastAudience = "all" | "nobuy" | "buyers";
export interface BroadcastButton {
  type: "none" | "plans" | "link";
  text?: string;
  url?: string;
}

/** Envia o disparo para uma pessoa. true = entregue, false = falhou, null = disparo cancelado. */
async function sendBroadcastItem(
  ctx: { token: string; storeId: string; storeSlug: string; botDbId: string },
  flow: NonNullable<Awaited<ReturnType<typeof import("./flow-runtime").getBasicFlowForBot>>>,
  job: Job
): Promise<boolean | null> {
  const b = await db.query.flowBroadcasts.findFirst({ where: eq(flowBroadcasts.id, job.ref) });
  if (!b || b.status === "canceled") return null;
  const runtime = await import("./flow-runtime");
  let ok = false;
  try {
    ok = await runtime.sendBroadcastMessage(ctx, flow, flow.status === "published" ? "live" : "test", job.telegramUserId, {
      message: b.message,
      mediaUrl: b.mediaUrl || "",
      button: (b.button || { type: "none" }) as BroadcastButton,
      firstName: String((job.payload as Record<string, unknown>)?.firstName || ""),
    });
  } catch {
    ok = false;
  }
  await db
    .update(flowBroadcasts)
    .set(ok ? { sent: sql`${flowBroadcasts.sent} + 1`, updatedAt: new Date() } : { failed: sql`${flowBroadcasts.failed} + 1`, updatedAt: new Date() })
    .where(eq(flowBroadcasts.id, b.id));
  return ok;
}

/** Leads do bot (quem deu /start), com o filtro do público. */
export async function broadcastAudience(storeId: string, botId: string, audience: BroadcastAudience): Promise<{ telegramUserId: string; firstName: string }[]> {
  const leads = (await db.execute(sql`
    SELECT DISTINCT ON (e.telegram_user_id) e.telegram_user_id AS uid, COALESCE(e.telegram_first_name, '') AS first_name
    FROM bot_start_events e
    WHERE e.store_id = ${storeId} AND e.bot_id = ${botId}
    ORDER BY e.telegram_user_id, e.created_at DESC
  `)) as unknown;
  const rows = (Array.isArray(leads) ? leads : (leads as { rows?: unknown[] })?.rows || []) as { uid: string; first_name: string }[];
  if (audience === "all") return rows.map((r) => ({ telegramUserId: String(r.uid), firstName: r.first_name }));

  const buyersRaw = (await db.execute(sql`
    SELECT DISTINCT c.telegram_user_id AS uid
    FROM flow_purchases p
    JOIN orders o ON o.id = p.order_id
    JOIN telegram_customers c ON c.id = p.customer_id
    WHERE p.bot_id = ${botId} AND o.status = 'paid'
  `)) as unknown;
  const buyers = new Set(((Array.isArray(buyersRaw) ? buyersRaw : (buyersRaw as { rows?: unknown[] })?.rows || []) as { uid: string }[]).map((r) => String(r.uid)));
  return rows
    .filter((r) => (audience === "buyers" ? buyers.has(String(r.uid)) : !buyers.has(String(r.uid))))
    .map((r) => ({ telegramUserId: String(r.uid), firstName: r.first_name }));
}
