import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/telegram/client", () => ({ telegramFetch: vi.fn() }));
vi.mock("@/lib/encryption", () => ({ decrypt: (v: string) => v }));

import { planExpiresAt, getFlowPurchaseByOrder, processExpiredFlowPurchases } from "../flow-delivery";
import { normalizeBasicConfig } from "../basic-config";

describe("planExpiresAt", () => {
  const from = new Date("2026-01-31T12:00:00Z");
  it("never expires a lifetime plan", () => {
    expect(planExpiresAt("vitalicio", 1, from)).toBeNull();
  });
  it("adds the plan period", () => {
    expect(planExpiresAt("dias", 7, from)?.toISOString()).toBe("2026-02-07T12:00:00.000Z");
    expect(planExpiresAt("semanas", 2, from)?.toISOString()).toBe("2026-02-14T12:00:00.000Z");
    expect(planExpiresAt("anos", 1, from)?.toISOString()).toBe("2027-01-31T12:00:00.000Z");
    expect(planExpiresAt("horas", 3, from)?.toISOString()).toBe("2026-01-31T15:00:00.000Z");
  });
  it("keeps month-end dates inside the target month", () => {
    const d = planExpiresAt("meses", 1, from)!;
    expect(d.getMonth()).toBe(1); // fevereiro, não março
  });
});

describe("fail-open without the flow_purchases table", () => {
  it("is not a flow order and expires nothing when the database is unavailable", async () => {
    await expect(getFlowPurchaseByOrder("o1")).rejects.toBeTruthy(); // erro que não é 42P01 sobe
    const missing = Object.assign(new Error('relation "flow_purchases" does not exist'), { code: "42P01" });
    const { db } = await import("@/db");
    (db as any).select = () => ({ from: () => ({ where: () => ({ limit: () => Promise.reject(missing) }) }) });
    await expect(getFlowPurchaseByOrder("o1")).resolves.toBeNull();
    await expect(processExpiredFlowPurchases()).resolves.toEqual({ processed: 0, removed: 0, failed: 0 });
  });
});

describe("delivery link", () => {
  it("only accepts Telegram invite links", () => {
    const c = normalizeBasicConfig({ version: 2, vip: { deliveryType: "link", link: "https://mega.nz/x" } });
    expect(c.vip.link).toBe("");
    expect(normalizeBasicConfig({ version: 2, vip: { link: "http://t.me/+AbC" } }).vip.link).toBe("https://t.me/+AbC");
  });
});
