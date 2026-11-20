import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/telegram/client", () => ({ telegramFetch: vi.fn() }));
vi.mock("@/lib/encryption", () => ({ decrypt: (v: string) => v }));

import { discountedPrice, planRows } from "../flow-runtime";
import { delayMs } from "../flow-jobs";
import { parseStartTracking } from "../flow-tracking";
import { blankDownsell, blankPlan, normalizeBasicConfig } from "../basic-config";

const config = () => {
  const c = normalizeBasicConfig({ version: 2 });
  c.planos.items = [
    { ...blankPlan(), id: "mensal1234ab", name: "Mensal", price: 20 },
    { ...blankPlan(), id: "anual12345ab", name: "Anual", price: 100, color: "green" },
  ];
  c.expiracao.discount = 20;
  c.downsell.items = [
    { ...blankDownsell(), id: "dpct", discountType: "percent", discount: 50, planIds: [] },
    { ...blankDownsell(), id: "dfix", discountType: "fixed", discount: 30, planIds: ["mensal1234ab"] },
  ];
  return c;
};

describe("discountedPrice", () => {
  it("keeps the full price without a tag", () => {
    expect(discountedPrice(config(), config().planos.items[0])).toBe(20);
  });
  it("applies the renewal discount", () => {
    expect(discountedPrice(config(), config().planos.items[1], "r")).toBe(80);
  });
  it("applies percent and fixed downsell discounts, never below R$ 1", () => {
    const c = config();
    expect(discountedPrice(c, c.planos.items[1], "ddpct")).toBe(50);
    expect(discountedPrice(c, c.planos.items[0], "ddfix")).toBe(1);
  });
  it("ignores a downsell that does not cover the plan", () => {
    const c = config();
    expect(discountedPrice(c, c.planos.items[1], "ddfix")).toBe(100);
  });
});

describe("planRows", () => {
  it("builds one button per plan with colors and the discount tag", () => {
    const c = config();
    c.botoes.comprar = "blue";
    const rows = planRows(c, "fl");
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({ callback_data: "fl:buy:mensal1234ab", style: "primary" });
    expect(rows[1][0]).toMatchObject({ style: "success" }); // a cor do plano vence a cor geral
    const disc = planRows(c, "ft", "r");
    expect(disc[1][0]).toMatchObject({ callback_data: "ft:buy:anual12345ab:r" });
    expect(String(disc[1][0].text)).toContain("R$ 80,00");
  });
});

describe("delayMs", () => {
  it("converts the configured delay", () => {
    expect(delayMs("imediato", 5)).toBe(0);
    expect(delayMs("minutos", 10)).toBe(600_000);
    expect(delayMs("dias", 1)).toBe(86_400_000);
  });
});

describe("parseStartTracking", () => {
  it("reads utm pairs from the start payload", () => {
    expect(parseStartTracking("utm_source-fb__utm_campaign-black")).toMatchObject({ utm_source: "fb", utm_campaign: "black", src: null });
  });
  it("uses free text as src and ignores test links", () => {
    expect(parseStartTracking("insta").src).toBe("insta");
    expect(parseStartTracking("fltest_abc").src).toBeNull();
  });
});
