import { describe, it, expect } from "vitest";
import { basicStepStatus, blankBasicConfig, normalizeBasicConfig, templateBasicConfig } from "../basic-config";
import { blankGraph, graphChecklist, nodeOutputs, normalizeGraph } from "../advanced-graph";

describe("normalizeBasicConfig", () => {
  it("fills defaults for empty or junk input", () => {
    expect(normalizeBasicConfig(null)).toEqual(blankBasicConfig());
    expect(normalizeBasicConfig("x")).toEqual(blankBasicConfig());
    expect(normalizeBasicConfig({ inicio: 5, planos: [] })).toEqual(blankBasicConfig());
  });

  it("keeps valid values and clamps numbers", () => {
    const c = normalizeBasicConfig({
      inicio: { msg: "Olá", btn: "Ver", antiClone: true, sendMode: "seq" },
      planos: { varCents: 500, varDir: "cima", items: [{ productId: "p1", on: true, color: "green" }, { productId: "", on: true }] },
      pix: { proofInterval: 1, fmt: "pre", qr: "nope" },
      renov: { discount: 99 },
      recup: { items: [{ name: "x", audience: "start", delay: "Imediato", discount: 200, msg: "m" }] },
    });
    expect(c.inicio).toMatchObject({ msg: "Olá", btn: "Ver", antiClone: true, sendMode: "seq" });
    expect(c.planos.varCents).toBe(99);
    expect(c.planos.varDir).toBe("cima");
    expect(c.planos.items).toEqual([{ productId: "p1", on: true, color: "green" }]);
    expect(c.pix.proofInterval).toBe(3);
    expect(c.pix.fmt).toBe("pre");
    expect(c.pix.qr).toBe("botao");
    expect(c.renov.discount).toBe(75);
    expect(c.recup.items[0]).toMatchObject({ audience: "start", delay: "5 minutos", discount: 90 });
  });

  it("drops non-https media and caps lists", () => {
    const c = normalizeBasicConfig({
      inicio: { media: ["https://cdn/a.webp", "javascript:alert(1)", "http://x", "https://b", "https://c", "https://d", "https://e", "https://f"] },
      upsell: { items: Array.from({ length: 9 }, () => ({ name: "u", price: 1, delay: "1 hora", msg: "" })) },
    });
    expect(c.inicio.media).toEqual(["https://cdn/a.webp", "https://b", "https://c"]);
    expect(c.upsell.items).toHaveLength(5);
  });

  it("keeps only digits in the Facebook pixel id", () => {
    expect(normalizeBasicConfig({ rastreio: { fb: true, fbPixelId: "12a34-5" } }).rastreio.fbPixelId).toBe("12345");
  });
});

describe("basicStepStatus", () => {
  it("flags missing required steps on a blank flow", () => {
    const c = blankBasicConfig();
    expect(basicStepStatus("inicio", c)[0]).toBe("pend");
    expect(basicStepStatus("planos", c)[0]).toBe("pend");
    expect(basicStepStatus("pix", c)[0]).toBe("pend");
    // destino vem dos produtos; a mensagem de entrega é opcional
    expect(basicStepStatus("entrega", c)).toEqual(["ok", "Mensagem padrão"]);
    expect(basicStepStatus("bump", c)[0]).toBe("off");
  });

  it("template flow has welcome, pix and a recovery message ready", () => {
    const c = templateBasicConfig();
    expect(basicStepStatus("inicio", c)[0]).toBe("ok");
    expect(basicStepStatus("pix", c)[0]).toBe("ok");
    expect(basicStepStatus("recup", c)).toEqual(["ok", "1 mensagem"]);
    c.entrega.tipo = "link";
    c.entrega.link = "https://mega.nz/x";
    expect(basicStepStatus("entrega", c)[0]).toBe("ok");
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
