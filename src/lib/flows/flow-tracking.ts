/**
 * Rastreamento do Fluxo Básico (seção Rastreamento): envia eventos pelo servidor para
 * Facebook (Conversions API), TikTok (Events API v1.3) e UTMify.
 *
 *  - /start         → Lead
 *  - Pix gerado     → InitiateCheckout (UTMify: pedido "waiting_payment")
 *  - Pagamento ok   → Purchase / CompletePayment (UTMify: pedido "paid")
 *
 * Nunca derruba o fluxo: cada envio tem tempo-limite e qualquer erro só vai para o log.
 */
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { botStartEvents } from "@/db/schema";
import type { BasicFlowConfig } from "./basic-config";

export type TrackEvent = "lead" | "checkout" | "purchase";

export interface TrackInput {
  rastreio: BasicFlowConfig["rastreio"];
  event: TrackEvent;
  storeId: string;
  botDbId?: string | null;
  telegramUserId: string;
  firstName?: string | null;
  lastName?: string | null;
  /** Pedido (Pix): id, valor e nome do plano. Não existe no Lead. */
  orderId?: string;
  value?: number;
  itemId?: string;
  itemName?: string;
  createdAt?: Date;
  paidAt?: Date | null;
}

const sha256 = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) console.warn(`[flow-tracking] ${new URL(url).host} respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.warn(`[flow-tracking] Falha ao enviar para ${new URL(url).host}:`, (err as Error)?.message);
  } finally {
    clearTimeout(t);
  }
}

/** UTMs vindas do link de /start (?start=...). Formato aceito: "utm_source-xxx__utm_campaign-yyy" ou texto livre (vira src). */
export function parseStartTracking(payload: string | null | undefined): Record<string, string | null> {
  const out: Record<string, string | null> = { src: null, sck: null, utm_source: null, utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null };
  const raw = (payload || "").trim();
  if (!raw || /^(fltest_|v_)/.test(raw)) return out;
  const parts = raw.split("__");
  let matched = false;
  for (const part of parts) {
    const m = /^(utm_source|utm_campaign|utm_medium|utm_content|utm_term|src|sck)-(.+)$/.exec(part);
    if (m) { out[m[1]] = m[2]; matched = true; }
  }
  if (!matched) out.src = raw.slice(0, 64);
  return out;
}

const utcStamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

/** Envia o evento para as integrações configuradas. Não lança erro. */
export async function trackFlowEvent(input: TrackInput): Promise<void> {
  const r = input.rastreio;
  if (!r || (!r.fbPixelId && !r.ttPixelId && !r.utmToken)) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    const eventId = input.orderId ? `${input.event}-${input.orderId}` : `lead-${input.storeId}-${input.telegramUserId}-${Math.floor(now / 3600)}`;
    const externalId = sha256(String(input.telegramUserId));
    const value = Math.round((input.value || 0) * 100) / 100;
    const jobs: Promise<void>[] = [];

    if (r.fbPixelId && r.fbToken) {
      const name = input.event === "lead" ? "Lead" : input.event === "checkout" ? "InitiateCheckout" : "Purchase";
      jobs.push(
        post(`https://graph.facebook.com/v19.0/${encodeURIComponent(r.fbPixelId)}/events?access_token=${encodeURIComponent(r.fbToken)}`, {
          data: [{
            event_name: name,
            event_time: now,
            event_id: eventId,
            action_source: "chat",
            user_data: {
              external_id: [externalId],
              ...(input.firstName ? { fn: [sha256(input.firstName)] } : {}),
              ...(input.lastName ? { ln: [sha256(input.lastName)] } : {}),
            },
            ...(input.event === "lead" ? {} : { custom_data: { currency: "BRL", value, content_name: input.itemName, content_ids: input.itemId ? [input.itemId] : undefined, content_type: "product" } }),
          }],
        })
      );
    }

    if (r.ttPixelId && r.ttToken) {
      const name = input.event === "lead" ? "Lead" : input.event === "checkout" ? "InitiateCheckout" : "CompletePayment";
      jobs.push(
        post("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          event_source: "web",
          event_source_id: r.ttPixelId,
          data: [{
            event: name,
            event_time: now,
            event_id: eventId,
            user: { external_id: externalId },
            ...(input.event === "lead" ? {} : { properties: { currency: "BRL", value, content_type: "product", contents: input.itemId ? [{ content_id: input.itemId, content_name: input.itemName, price: value, quantity: 1 }] : undefined } }),
          }],
        }, { "Access-Token": r.ttToken })
      );
    }

    if (r.utmToken && input.orderId && input.event !== "lead") {
      let startPayload: string | null = null;
      try {
        const rows = await db
          .select({ payload: botStartEvents.startPayload })
          .from(botStartEvents)
          .where(and(eq(botStartEvents.storeId, input.storeId), eq(botStartEvents.telegramUserId, String(input.telegramUserId))))
          .orderBy(desc(botStartEvents.createdAt))
          .limit(1);
        startPayload = rows[0]?.payload ?? null;
      } catch {
        // sem origem: segue sem UTMs
      }
      const cents = Math.round(value * 100);
      jobs.push(
        post("https://api.utmify.com.br/api-credentials/orders", {
          orderId: input.orderId,
          platform: "WebGran",
          paymentMethod: "pix",
          status: input.event === "purchase" ? "paid" : "waiting_payment",
          createdAt: utcStamp(input.createdAt || new Date()),
          approvedDate: input.event === "purchase" ? utcStamp(input.paidAt || new Date()) : null,
          refundedAt: null,
          customer: {
            name: [input.firstName, input.lastName].filter(Boolean).join(" ") || "Cliente Telegram",
            email: `tg${input.telegramUserId}@telegram.webgran.app`,
            phone: null,
            document: null,
            country: "BR",
          },
          products: [{ id: input.itemId || "plano", name: input.itemName || "Plano", planId: input.itemId || null, planName: input.itemName || null, quantity: 1, priceInCents: cents }],
          trackingParameters: parseStartTracking(startPayload),
          commission: { totalPriceInCents: cents, gatewayFeeInCents: 0, userCommissionInCents: cents },
          isTest: false,
        }, { "x-api-token": r.utmToken })
      );
    }

    await Promise.all(jobs);
  } catch (err) {
    console.warn("[flow-tracking] Evento não enviado:", (err as Error)?.message);
  }
}
