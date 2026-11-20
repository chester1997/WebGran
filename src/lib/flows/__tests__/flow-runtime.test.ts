import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/telegram/client", () => ({ telegramFetch: vi.fn() }));

import { buildTestStartParam, getBasicFlowForBot, greeting, parseTestStartParam, pixCodeHtml, renderFlowText } from "../flow-runtime";

describe("renderFlowText", () => {
  it("keeps allowed tags, escapes everything else and fills variables", () => {
    const html = renderFlowText("<b>Oi</b> {nome} <script>x</script> & {plano}", { "{nome}": "Ana", "{plano}": "VIP" });
    expect(html).toBe("<b>Oi</b> Ana &lt;script&gt;x&lt;/script&gt; &amp; VIP");
  });

  it("escapes variable values so a customer name cannot break the HTML", () => {
    expect(renderFlowText("Olá {nome}", { "{nome}": "<b>Zé" })).toBe("Olá &lt;b&gt;Zé");
  });

  it("removes known variables that have no value", () => {
    expect(renderFlowText("Oi {nome}, de {localizacao}!", { "{nome}": "Ana" })).toBe("Oi Ana, de !");
  });
});

describe("pixCodeHtml", () => {
  it("formats the Pix code in the three styles", () => {
    expect(pixCodeHtml("000201<x>", "caixa")).toBe("<blockquote><code>000201&lt;x&gt;</code></blockquote>");
    expect(pixCodeHtml("0002", "pre")).toBe("<pre>0002</pre>");
    expect(pixCodeHtml("0002", "code")).toBe("<code>0002</code>");
  });
});

describe("test start link", () => {
  const flowId = "6b004217-72a1-f853-efeb-93c0aa11bb22";

  it("round-trips and fits Telegram's 64-char start param", () => {
    const p = buildTestStartParam(flowId);
    expect(p.length).toBeLessThanOrEqual(64);
    expect(/^[A-Za-z0-9_-]+$/.test(p)).toBe(true);
    expect(parseTestStartParam(p)).toBe(flowId);
  });

  it("rejects forged or altered links", () => {
    const p = buildTestStartParam(flowId);
    expect(parseTestStartParam(p.slice(0, -1) + (p.endsWith("0") ? "1" : "0"))).toBeNull();
    expect(parseTestStartParam("fltest_" + "a".repeat(32) + "_" + "b".repeat(12))).toBeNull();
    expect(parseTestStartParam("v_abc")).toBeNull();
  });
});

describe("greeting", () => {
  it("uses Brasília time", () => {
    expect(greeting(new Date("2026-11-20T12:00:00Z"))).toBe("Bom dia"); // 09h
    expect(greeting(new Date("2026-11-20T18:00:00Z"))).toBe("Boa tarde"); // 15h
    expect(greeting(new Date("2026-11-21T01:00:00Z"))).toBe("Boa noite"); // 22h
  });
});

describe("getBasicFlowForBot", () => {
  it("fails open (null) when the database is unavailable", async () => {
    await expect(getBasicFlowForBot("bot-1")).resolves.toBeNull();
  });
});
