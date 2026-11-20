import { describe, it, expect } from "vitest";
import { basicStepStatus, blankBasicConfig, blankPlan, normalizeBasicConfig, planDelivery, planPeriodLabel, planProductDuration, stripSecrets, templateBasicConfig } from "../basic-config";
import { blankGraph, graphChecklist, nodeOutputs, normalizeGraph } from "../advanced-graph";

describe("normalizeBasicConfig", () => {
  it("fills defaults for empty or junk input", () => {
    expect(normalizeBasicConfig(null)).toEqual(blankBasicConfig());
    expect(normalizeBasicConfig("x")).toEqual(blankBasicConfig());
    expect(normalizeBasicConfig({ version: 2, inicio: 5, planos: [] })).toEqual(blankBasicConfig());
  });

  it("keeps valid plans defined in the flow and clamps numbers", () => {
    const c = normalizeBasicConfig({
      version: 2,
      inicio: { msg: "Ola", btn: "Ver", antiClone: true, sendMode: "seq" },
      planos: {
        varCents: 500,
        varDir: "cima",
        items: [
          { id: "plan1", name: "Mensal", price: "29,90", unit: "meses", amount: 1, color: "none" },
          { id: "plan2", name: "Vida", price: 97, unit: "vitalicio", color: "green", vipExclusive: true, deliveryType: "group", groupId: "-1001234567890" },
          { name: "Hack", price: 10, unit: "decadas", groupId: "abc" },
        ],
      },
      pix: { proofInterval: 1, fmt: "pre", qrMode: "nope" },
      expiracao: { discount: 99 },
    });
    expect(c.inicio).toMatchObject({ msg: "Ola", btn: "Ver", antiClone: true, sendMode: "seq" });
    expect(c.planos.varCents).toBe(99);
    expect(c.planos.varDir).toBe("cima");
    expect(c.planos.items[0]).toMatchObject({ id: "plan1", name: "Mensal", price: 29.9, unit: "meses", amount: 1, color: "none" });
    expect(c.planos.items[1]).toMatchObject({ unit: "vitalicio", color: "green", vipExclusive: true, groupId: "-1001234567890" });
    expect(c.planos.items[2]).toMatchObject({ unit: "meses", groupId: "" });
    expect(c.pix.proofInterval).toBe(3);
    expect(c.pix.fmt).toBe("pre");
    expect(c.pix.qrMode).toBe("botao");
    expect(c.expiracao.discount).toBe(75);
  });

  it("drops the old product-based plans and moves v1 sections", () => {
    const c = normalizeBasicConfig({
      planos: { items: [{ productId: "p1", on: true }] },
      entrega: { tipo: "link", link: "https://t.me/+abc123", msg: "Obrigado" },
      renov: { msg: "Renove" },
    });
    expect(c.planos.items).toEqual([]);
    expect(c.vip).toMatchObject({ deliveryType: "link", link: "https://t.me/+abc123", msg: "Obrigado" });
    expect(c.expiracao.msg).toBe("Renove");
  });

  it("drops non-https media and caps lists", () => {
    const c = normalizeBasicConfig({
      version: 2,
      inicio: { media: ["https://cdn/a.webp", "javascript:alert(1)", "http://x", "https://b", "https://c", "https://d", "https://e", "https://f"] },
      upsell: { items: Array.from({ length: 30 }, () => ({ name: "u", price: 1 })) },
    });
    expect(c.inicio.media).toEqual(["https://cdn/a.webp", "https://b", "https://c", "https://d", "https://e"]);
    expect(c.upsell.items).toHaveLength(25);
  });

  it("keeps only digits in the Facebook pixel id and strips secrets on export", () => {
    const c = normalizeBasicConfig({ version: 2, rastreio: { fbPixelId: "12a34-5", fbToken: "secret", utmToken: "t" } });
    expect(c.rastreio.fbPixelId).toBe("12345");
    expect(stripSecrets(c).rastreio).toMatchObject({ fbPixelId: "12345", fbToken: "", utmToken: "" });
  });
});

describe("plans", () => {
  it("labels periods and maps them to product durations", () => {
    expect(planPeriodLabel({ unit: "meses", amount: 1 })).toBe("1 mês");
    expect(planPeriodLabel({ unit: "meses", amount: 3 })).toBe("3 meses");
    expect(planPeriodLabel({ unit: "vitalicio", amount: 1 })).toBe("Vitalício");
    expect(planProductDuration({ unit: "dias", amount: 7 })).toBe("custom:7:dias");
    expect(planProductDuration({ unit: "vitalicio", amount: 1 })).toBe("lifetime");
  });

  it("uses the VIP default delivery unless the plan has its own", () => {
    const c = blankBasicConfig();
    c.vip.groupId = "-1001111111111";
    const shared = { ...blankPlan(), name: "A", price: 10 };
    const own = { ...blankPlan(), name: "B", price: 10, vipExclusive: true, deliveryType: "link" as const, link: "https://t.me/+vip" };
    expect(planDelivery(shared, c)).toEqual({ type: "group", value: "-1001111111111" });
    expect(planDelivery(own, c)).toEqual({ type: "link", value: "https://t.me/+vip" });
  });
});

describe("basicStepStatus", () => {
  it("flags missing required steps on a blank flow", () => {
    const c = blankBasicConfig();
    expect(basicStepStatus("inicio", c)[0]).toBe("pend");
    expect(basicStepStatus("planos", c)[0]).toBe("pend");
    expect(basicStepStatus("vip", c)[0]).toBe("pend");
    expect(basicStepStatus("bump", c)[0]).toBe("off");
  });

  it("template flow has welcome, a plan and a downsell ready", () => {
    const c = templateBasicConfig();
    expect(basicStepStatus("inicio", c)[0]).toBe("ok");
    expect(basicStepStatus("planos", c)).toEqual(["ok", "1 plano"]);
    expect(basicStepStatus("downsell", c)[0]).toBe("ok");
    c.vip.deliveryType = "link";
    c.vip.link = "https://t.me/+abc123";
    expect(basicStepStatus("vip", c)[0]).toBe("ok");
  });
});

describe("normalizeGraph", () => {
  it("always has exactly one start block", () => {
    const g = normalizeGraph({ nodes: [{ id: "a", type: "texto", x: 1, y: 1 }] });
    expect(g.nodes.filter((n) => n.type === "inicio")).toHaveLength(1);
    const two = normalizeGraph({ nodes: [{ id: "s1", type: "inicio" }, { id: "s2", type: "inicio" }] });
    expect(two.nodes.map((n) => n.id)).toEqual(["s1"]);
  });

  it("drops unknown types, duplicate ids and invalid edges", () => {
    const g = normalizeGraph({
      nodes: [
        { id: "s", type: "inicio", x: 0, y: 0 },
        { id: "p", type: "pix", x: 10, y: 10, data: { wait: "45", productId: "abc", evil: "x" } },
        { id: "p", type: "texto" },
        { id: "z", type: "hack" },
        { id: "e", type: "entrega" },
      ],
      edges: [
        { from: "s", out: "out", to: "p" },
        { from: "p", out: "pago", to: "e" },
        { from: "p", out: "pago", to: "s" },
        { from: "p", out: "nope", to: "e" },
        { from: "p", out: "nao", to: "s" },
        { from: "p", out: "nao", to: "ghost" },
        { from: "e", out: "out", to: "e" },
      ],
    });
    expect(g.nodes.map((n) => n.id)).toEqual(["s", "p", "e"]);
    expect(g.nodes[1].data).toEqual({ productId: "abc", wait: 45, qr: "Por botão" });
    expect(g.edges).toEqual([
      { from: "s", out: "out", to: "p" },
      { from: "p", out: "pago", to: "e" },
    ]);
  });

  it("button blocks get one output per line", () => {
    expect(nodeOutputs({ type: "botoes", data: { buttons: "A\n\nB\n" } })).toEqual([["b0", "A"], ["b1", "B"]]);
  });
});

describe("graphChecklist", () => {
  it("blank graph is not publishable", () => {
    const required = graphChecklist(blankGraph()).filter((c) => c.required);
    expect(required.every((c) => c.ok)).toBe(false);
  });

  it("start → pix → delivery passes the required checks", () => {
    const g = normalizeGraph({
      nodes: [{ id: "s", type: "inicio" }, { id: "p", type: "pix" }, { id: "e", type: "entrega" }],
      edges: [{ from: "s", out: "out", to: "p" }, { from: "p", out: "pago", to: "e" }],
    });
    expect(graphChecklist(g).every((c) => c.ok)).toBe(true);
  });
});

describe("planos na boas-vindas", () => {
  it("is on by default and only needs the CTA text when off", () => {
    expect(normalizeBasicConfig({ version: 2, inicio: { msg: "Oi" } }).inicio.showPlans).toBe(true);
    const c = normalizeBasicConfig({ version: 2, inicio: { msg: "Oi", btn: "", showPlans: true } });
    expect(basicStepStatus("inicio", c)[0]).toBe("ok");
    c.inicio.showPlans = false;
    c.inicio.btn = "";
    expect(basicStepStatus("inicio", c)[0]).toBe("pend");
  });
});
